// Booking-confirmation email — a different trigger shape from api/notify.js's
// 3 existing types. Those fire from an authenticated client action (a coach
// or client with a real session), verified via Authorization: Bearer + the
// caller's own profile relationship to the recipient. This one fires from
// the anonymous prospect booking flow (BookIntakeCall.jsx calling
// book_intake_call, a SECURITY DEFINER RPC) — there's no session to speak
// of, so there's no caller to authorize against.
//
// Authorization here is the booking_token itself (same unguessable-secret
// property as /invite/:token), re-verified server-side against a REAL
// booking row via intake_booking_details_for_notify — a SECURITY DEFINER
// function granted only to service_role (never anon/authenticated, since
// it returns the coach's email). A request can't fabricate a booking or
// pick an arbitrary recipient; at most it can re-trigger the same real
// confirmation email for a booking that genuinely exists.
const supabaseAdmin = require('./_supabaseAdmin')
const sendEmail = require('./_email')
const { intakeCallBookedEmail } = require('./_emailTemplates')

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  const { token } = req.body || {}
  if (!token) {
    res.status(400).json({ error: 'token is required' })
    return
  }

  try {
    const admin = supabaseAdmin()

    const { data: rows, error: lookupError } = await admin.rpc('intake_booking_details_for_notify', { p_token: token })
    const details = Array.isArray(rows) ? rows[0] : rows
    if (lookupError || !details) {
      res.status(404).json({ error: 'No active booking found for this token' })
      return
    }

    // Not derived from req.headers.origin — same reasoning as api/notify.js.
    const origin = 'https://purema.app'
    const formattedDateTime = new Date(details.booked_at).toLocaleString('en-US', {
      timeZone: details.coach_timezone,
      weekday: 'long', month: 'short', day: 'numeric',
      hour: 'numeric', minute: '2-digit', timeZoneName: 'short',
    })

    const sends = []
    if (details.coach_email) {
      const { subject, html } = intakeCallBookedEmail({
        recipientName: details.coach_name, otherPartyName: details.prospect_name,
        formattedDateTime, appUrl: origin,
      })
      sends.push({ recipient: 'coach', to: details.coach_email, promise: sendEmail({ to: details.coach_email, subject, html }) })
    }
    if (details.prospect_email) {
      const { subject, html } = intakeCallBookedEmail({
        recipientName: details.prospect_name, otherPartyName: details.coach_name,
        formattedDateTime, appUrl: origin,
      })
      sends.push({ recipient: 'prospect', to: details.prospect_email, promise: sendEmail({ to: details.prospect_email, subject, html }) })
    }

    const settled = await Promise.allSettled(sends.map(s => s.promise))
    // Surfaces Resend's own message id per recipient (same as api/notify.js's
    // { ok, sent, id } shape) rather than just an aggregate count — this is
    // what actually proves a send reached Resend, not just that our own
    // fetch call didn't throw.
    const results = sends.map((s, i) => {
      const outcome = settled[i]
      return outcome.status === 'fulfilled'
        ? { recipient: s.recipient, to: s.to, ok: true, id: outcome.value.id }
        : { recipient: s.recipient, to: s.to, ok: false, error: outcome.reason?.message }
    })
    console.log('notify-intake-booking results:', JSON.stringify(results))

    const failures = results.filter(r => !r.ok)
    res.status(200).json({ ok: true, sent: results.length - failures.length, failed: failures.length, results })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}
