// Shared admin client for Vercel serverless functions. Uses the service
// role key (server-side only — never exposed to the browser bundle) so it
// can read/write profiles regardless of RLS, which is required here since
// these functions run outside any user's session (webhooks have no user
// at all; checkout-session creation happens before Stripe redirects back).
const { createClient } = require('@supabase/supabase-js')

module.exports = function supabaseAdmin() {
  return createClient(
    process.env.REACT_APP_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}
