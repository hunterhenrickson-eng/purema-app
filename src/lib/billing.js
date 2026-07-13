// Purema subscription plans.
// Price IDs are Stripe Price object ids — not secret, safe to ship to the
// client (Checkout Sessions are still created server-side, in /api).

// `recommended` marks the single plan whose Subscribe button renders as the
// filled primary action — every other plan's button is outlined, keeping
// the pricing screen to one filled button at a time.
//
// `free` has no `priceId` (nothing to check out for on Stripe) and isn't
// assigned automatically anywhere — an unsubscribed coach's
// `subscription_tier` stays null/unset, it does NOT get set to 'free'. This
// record exists so /pricing and the sidebar tier badge have a real plan to
// point at instead of an ad-hoc "Free" string; it does not change
// tierLimit()/isSubscribed() behavior for existing null-tier accounts.
export const PLANS = [
  { id: 'free', label: 'Free', price: 0, limit: 3, features: [
    'Full check-in form', 'All macros', '4 progress photos', '4 weeks of history',
    'Locked features visible with upgrade prompts',
  ] },
  { id: 'starter', label: 'Starter', price: 69, limit: 15, priceId: 'price_1Tp8OFAg1pLVKN0rn9wBk5C5', features: [
    'Full features', 'Peak week protocol', '8 themes',
  ] },
  { id: 'pro', label: 'Pro', price: 119, limit: 40, priceId: 'price_1Tp8OUAg1pLVKN0rrdyiw6E7', recommended: true, features: [
    'Full comp suite', 'Posing video', 'Reverse diet', '20+ themes',
  ] },
  { id: 'agency', label: 'Agency', price: 349, limit: Infinity, priceId: 'price_1Tp8OrAg1pLVKN0rILd8ObRV', features: [
    'Custom logo/domain/colors', '5 sub-coach seats', 'Business dashboard',
  ] },
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
