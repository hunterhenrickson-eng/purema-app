// Returns per-serving macros for one food, for the coach's quantity/unit
// picker to scale from. Branded foods (have a nix_item_id) use the item
// lookup endpoint since their nutrition is fixed to the label's serving;
// common foods use the natural-language endpoint, which returns Nutritionix's
// standard reference serving when given just a food name with no quantity.
module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  const { food_name, nix_item_id } = req.body || {}
  if (!food_name && !nix_item_id) {
    res.status(400).json({ error: 'food_name or nix_item_id is required' })
    return
  }

  try {
    let item
    if (nix_item_id) {
      const response = await fetch(
        `https://trackapi.nutritionix.com/v2/search/item?nix_item_id=${encodeURIComponent(nix_item_id)}`,
        {
          headers: {
            'x-app-id': process.env.NUTRITIONIX_APP_ID,
            'x-app-key': process.env.NUTRITIONIX_APP_KEY,
          },
        }
      )
      if (!response.ok) {
        const text = await response.text()
        res.status(response.status).json({ error: `Nutritionix item lookup failed: ${text}` })
        return
      }
      const data = await response.json()
      item = data.foods?.[0]
    } else {
      const response = await fetch('https://trackapi.nutritionix.com/v2/natural/nutrients', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-app-id': process.env.NUTRITIONIX_APP_ID,
          'x-app-key': process.env.NUTRITIONIX_APP_KEY,
        },
        body: JSON.stringify({ query: food_name }),
      })
      if (!response.ok) {
        const text = await response.text()
        res.status(response.status).json({ error: `Nutritionix nutrients lookup failed: ${text}` })
        return
      }
      const data = await response.json()
      item = data.foods?.[0]
    }

    if (!item) {
      res.status(404).json({ error: 'No nutrient data found for this food' })
      return
    }

    res.status(200).json({
      food_name: item.food_name,
      serving_qty: item.serving_qty,
      serving_unit: item.serving_unit,
      calories: item.nf_calories,
      protein: item.nf_protein,
      carbs: item.nf_total_carbohydrate,
      fats: item.nf_total_fat,
      nutritionix_food_id: nix_item_id || item.nix_item_id || null,
    })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}
