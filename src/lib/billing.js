// Purema subscription plans.
// Price IDs are Stripe Price object ids — not secret, safe to ship to the
// client (Checkout Sessions are still created server-side, in /api).

export const PLANS = [
  { id: 'starter', label: 'Starter', price: 69, limit: 15, priceId: 'price_1Tp8OFAg1pLVKN0rn9wBk5C5' },
  { id: 'pro', label: 'Pro', price: 119, limit: 40, priceId: 'price_1Tp8OUAg1pLVKN0rrdyiw6E7' },
  { id: 'agency', label: 'Agency', price: 349, limit: Infinity, priceId: 'price_1Tp8OrAg1pLVKN0rILd8ObRV' },
]

export function planById(tier) {
  return PLANS.find(p => p.id === tier) || null
}

// A coach with no active subscription has a limit of 0 — they can't invite
// any clients until they pick a plan.
export function tierLimit(tier) {
  const plan = planById(tier)
  return plan ? plan.limit : 0
}

export function isSubscribed(profile) {
  return profile?.subscription_status === 'active' || profile?.subscription_status === 'trialing'
}

// Reflects Stripe dunning state, set by the webhook — not derived locally.
export function isPastDue(profile) {
  return profile?.payment_status === 'past_due'
}

export function isSuspended(profile) {
  return profile?.payment_status === 'suspended'
}
