const Stripe = require('stripe')
const supabaseAdmin = require('./_supabaseAdmin')

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  const { userId } = req.body || {}
  if (!userId) {
    res.status(400).json({ error: 'Missing userId' })
    return
  }

  try {
    const admin = supabaseAdmin()
    const { data: profile } = await admin
      .from('profiles')
      .select('stripe_customer_id')
      .eq('id', userId)
      .single()

    if (!profile?.stripe_customer_id) {
      res.status(400).json({ error: 'No Stripe customer on file for this account yet.' })
      return
    }

    const origin = req.headers.origin || `https://${req.headers.host}`
    const session = await stripe.billingPortal.sessions.create({
      customer: profile.stripe_customer_id,
      return_url: `${origin}/`,
    })

    res.status(200).json({ url: session.url })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}
