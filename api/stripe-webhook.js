const Stripe = require('stripe')
const supabaseAdmin = require('./_supabaseAdmin')

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)

// Stripe signature verification needs the exact raw request bytes — Vercel's
// default JSON body parser would re-serialize the body and break the
// signature check, so it's disabled here in favor of reading the raw stream.
module.exports.config = {
  api: { bodyParser: false },
}

const PRICE_TO_TIER = {
  price_1Tp8OFAg1pLVKN0rn9wBk5C5: 'starter',
  price_1Tp8OUAg1pLVKN0rrdyiw6E7: 'pro',
  price_1Tp8OrAg1pLVKN0rILd8ObRV: 'agency',
}

function buffer(readable) {
  return new Promise((resolve, reject) => {
    const chunks = []
    readable.on('data', (chunk) => chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk))
    readable.on('end', () => resolve(Buffer.concat(chunks)))
    readable.on('error', reject)
  })
}

// Derive tier from the subscription's actual current price rather than
// trusting stored metadata alone — self-heals if a coach changes plans
// through the Billing Portal.
function tierFromSubscription(sub) {
  const priceId = sub.items?.data?.[0]?.price?.id
  return PRICE_TO_TIER[priceId] || sub.metadata?.tier || null
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).end('Method not allowed')
    return
  }

  const sig = req.headers['stripe-signature']
  let event

  try {
    const rawBody = await buffer(req)
    event = stripe.webhooks.constructEvent(rawBody, sig, process.env.STRIPE_WEBHOOK_SECRET)
  } catch (err) {
    res.status(400).send(`Webhook signature verification failed: ${err.message}`)
    return
  }

  const admin = supabaseAdmin()

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object
        const userId = session.client_reference_id || session.metadata?.supabase_user_id
        if (userId) {
          await admin.from('profiles').update({
            stripe_customer_id: session.customer,
            stripe_subscription_id: session.subscription,
            subscription_tier: session.metadata?.tier || null,
            subscription_status: 'active',
          }).eq('id', userId)
        }
        break
      }

      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        const sub = event.data.object
        const userId = sub.metadata?.supabase_user_id
        const tier = tierFromSubscription(sub)
        const update = {
          stripe_subscription_id: sub.id,
          subscription_status: sub.status,
          subscription_tier: tier,
          // Derived straight from Stripe's own subscription status rather
          // than only reacting to invoice events — self-heals the dashboard
          // gate even if an invoice webhook is ever missed. 'unpaid' is what
          // Stripe lands on once Smart Retries are exhausted (exact status
          // depends on the account's subscription settings).
          payment_status: sub.status === 'unpaid' ? 'suspended' : sub.status === 'past_due' ? 'past_due' : 'active',
        }

        if (userId) {
          await admin.from('profiles').update(update).eq('id', userId)
        } else {
          // Metadata should always be set (subscription_data.metadata at
          // checkout time), but fall back to matching by customer id so a
          // missing/stripped metadata field doesn't silently drop the update.
          await admin.from('profiles').update(update).eq('stripe_customer_id', sub.customer)
        }
        break
      }

      case 'customer.subscription.deleted': {
        const sub = event.data.object
        const userId = sub.metadata?.supabase_user_id
        // A canceled subscription (e.g. retries exhausted and the account's
        // Stripe settings cancel instead of leaving it 'unpaid') gates
        // access the same way 'unpaid' does — no active plan either way.
        const update = { subscription_status: 'canceled', payment_status: 'suspended' }
        if (userId) {
          await admin.from('profiles').update(update).eq('id', userId)
        } else {
          await admin.from('profiles').update(update).eq('stripe_customer_id', sub.customer)
        }
        break
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object
        const userId = invoice.subscription_details?.metadata?.supabase_user_id
        const update = { payment_status: 'past_due', payment_failed_at: new Date().toISOString() }
        if (userId) {
          await admin.from('profiles').update(update).eq('id', userId)
        } else {
          await admin.from('profiles').update(update).eq('stripe_customer_id', invoice.customer)
        }
        break
      }

      case 'invoice.payment_succeeded': {
        const invoice = event.data.object
        const userId = invoice.subscription_details?.metadata?.supabase_user_id
        const update = { payment_status: 'active' }
        if (userId) {
          await admin.from('profiles').update(update).eq('id', userId)
        } else {
          await admin.from('profiles').update(update).eq('stripe_customer_id', invoice.customer)
        }
        break
      }

      default:
        break
    }

    res.status(200).json({ received: true })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}
