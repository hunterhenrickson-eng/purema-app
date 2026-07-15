// Shared email-sending helper for Vercel serverless functions — thin wrapper
// around Resend's REST API via plain fetch (same pattern as the Nutritionix
// functions), not the `resend` npm package, so this adds zero new
// dependencies for a single POST call.
//
// RESEND_FROM_EMAIL lets the sender address be swapped per-environment
// (e.g. a verified purema.app address in production) without a code change.
// Falls back to Resend's shared onboarding domain, which works without any
// domain verification — useful for early testing, not meant for real
// coach-facing sends long-term.
const DEFAULT_FROM = process.env.RESEND_FROM_EMAIL || 'Purema <onboarding@resend.dev>'

module.exports = async function sendEmail({ to, subject, html, from = DEFAULT_FROM }) {
  if (!process.env.RESEND_API_KEY) {
    throw new Error('RESEND_API_KEY is not set')
  }
  if (!to || !subject || !html) {
    throw new Error('sendEmail requires to, subject, and html')
  }

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ from, to, subject, html }),
  })

  const data = await response.json()
  if (!response.ok) {
    throw new Error(`Resend send failed (${response.status}): ${data.message || JSON.stringify(data)}`)
  }
  return data
}
