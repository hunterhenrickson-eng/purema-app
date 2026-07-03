const Stripe = require('stripe')
const supabaseAdmin = require('./_supabaseAdmin')

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)

const PRICE_IDS = {
  starter: 'price_1Tp8OFAg1pLVKN0rn9wBk5C5',
  pro: 'price_1Tp8OUAg1pLVKN0rrdyiw6E7',
  agency: 'price_1Tp8OrAg1pLVKN0rILd8ObRV',
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  const { tier, userId, email } = req.body || {}
  const priceId = PRICE_IDS[tier]

  if (!priceId || !userId || !email) {
    res.status(400).json({ error: 'Missing or invalid tier, userId, or email' })
    return
  }

  try {
    // Reuse an existing Stripe customer if this coach has subscribed before,
    // instead of creating a duplicate customer on every resubscribe.
    const admin = supabaseAdmin()
    const { data: profile } = await admin
      .from('profiles')
      .select('stripe_customer_id')
      .eq('id', userId)
      .single()

    const origin = req.headers.origin || `https://${req.headers.host}`

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      line_items: [{ price: priceId, quantity: 1 }],
      ...(profile?.stripe_customer_id
        ? { customer: profile.stripe_customer_id }
        : { customer_email: email }),
      client_reference_id: userId,
      metadata: { supabase_user_id: userId, tier },
      subscription_data: { metadata: { supabase_user_id: userId, tier } },
      success_url: `${origin}/?checkout=success`,
      cancel_url: `${origin}/?checkout=cancelled`,
    })

    res.status(200).json({ url: session.url })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}
