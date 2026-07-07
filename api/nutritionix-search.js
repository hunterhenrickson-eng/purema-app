// Instant/autocomplete search only — no macro data returned here. The
// coach picks a result, then the client calls nutritionix-nutrients.js to
// get the actual per-serving macros for that specific food. Keeps the
// credentials server-side (same reasoning as the Stripe secret key).
module.exports = async (req, res) => {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  const { query } = req.query || {}
  if (!query || query.trim().length < 2) {
    res.status(400).json({ error: 'query must be at least 2 characters' })
    return
  }

  try {
    const response = await fetch(
      `https://trackapi.nutritionix.com/v2/search/instant?query=${encodeURIComponent(query)}`,
      {
        headers: {
          'x-app-id': process.env.NUTRITIONIX_APP_ID,
          'x-app-key': process.env.NUTRITIONIX_APP_KEY,
        },
      }
    )

    if (!response.ok) {
      const text = await response.text()
      res.status(response.status).json({ error: `Nutritionix search failed: ${text}` })
      return
    }

    const data = await response.json()

    // Trim down to just what the picker UI needs — the full Nutritionix
    // payload carries a lot of fields (photo variants, tags, locale info)
    // the app has no use for.
    const common = (data.common || []).slice(0, 8).map(f => ({
      food_name: f.food_name,
      tag_id: f.tag_id,
      serving_unit: f.serving_unit,
      serving_qty: f.serving_qty,
      is_branded: false,
    }))
    const branded = (data.branded || []).slice(0, 8).map(f => ({
      food_name: f.food_name,
      brand_name: f.brand_name,
      nix_item_id: f.nix_item_id,
      serving_unit: f.serving_unit,
      serving_qty: f.serving_qty,
      is_branded: true,
    }))

    res.status(200).json({ common, branded })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}
