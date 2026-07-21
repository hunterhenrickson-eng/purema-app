// Shared notification-email endpoint for the 3 wired triggers (coach
// feedback, macro target updates, new message). One file rather than
// three — the shared shape (auth → look up recipient → check their
// preference → send) is identical, only the template differs per type.
//
// Same reasoning as admin-impersonate.js: does NOT trust a client-supplied
// id for who's calling. The caller is verified from their own session
// token, then checked server-side to actually be the coach-of/client-of
// the recipient before anything gets sent — otherwise any authenticated
// user could POST an arbitrary recipientId and spam another user's inbox,
// bypassing the RLS that already protects the underlying check_ins/
// messages/macro_adjustments writes.
const supabaseAdmin = require('./_supabaseAdmin')
const sendEmail = require('./_email')
const { feedbackReceivedEmail, macroTargetsUpdatedEmail, newMessageEmail } = require('./_emailTemplates')

const NOTIFY_FLAG = {
  feedback: 'notify_coach_feedback',
  macro: 'notify_macro_target_updates',
  message: 'notify_new_message',
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  const authHeader = req.headers.authorization || ''
  const callerToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null
  if (!callerToken) {
    res.status(401).json({ error: 'Missing Authorization header' })
    return
  }

  const { type, recipientId } = req.body || {}
  if (!type || !NOTIFY_FLAG[type] || !recipientId) {
    res.status(400).json({ error: `type (one of ${Object.keys(NOTIFY_FLAG).join(', ')}) and recipientId are required` })
    return
  }

  try {
    const admin = supabaseAdmin()

    const { data: { user: caller }, error: callerError } = await admin.auth.getUser(callerToken)
    if (callerError || !caller) {
      res.status(401).json({ error: 'Invalid or expired session' })
      return
    }

    const [{ data: callerProfile }, { data: recipient }] = await Promise.all([
      admin.from('profiles').select('id, full_name, coach_id').eq('id', caller.id).single(),
      admin.from('profiles').select('id, email, full_name, coach_id, notify_coach_feedback, notify_macro_target_updates, notify_new_message').eq('id', recipientId).single(),
    ])

    if (!callerProfile || !recipient) {
      res.status(404).json({ error: 'Caller or recipient profile not found' })
      return
    }

    // feedback/macro: coach -> client only (a client never leaves feedback
    // on themselves). message: either direction, since both parties can
    // message each other — caller is the recipient's coach, OR caller is
    // the recipient's client (i.e. the recipient is the caller's coach).
    const callerIsRecipientsCoach = recipient.coach_id === callerProfile.id
    const callerIsRecipientsClient = callerProfile.coach_id === recipient.id
    const authorized = type === 'message'
      ? (callerIsRecipientsCoach || callerIsRecipientsClient)
      : callerIsRecipientsCoach

    if (!authorized) {
      res.status(403).json({ error: 'Not authorized to notify this recipient' })
      return
    }

    if (!recipient[NOTIFY_FLAG[type]]) {
      res.status(200).json({ ok: true, sent: false, reason: 'recipient has this notification disabled' })
      return
    }

    if (!recipient.email) {
      res.status(200).json({ ok: true, sent: false, reason: 'recipient has no email on file' })
      return
    }

    // Not derived from req.headers.origin — that's caller-controlled (any
    // non-browser HTTP client can set it) and would otherwise let an
    // authorized-but-malicious sender point a real, correctly-triggered
    // notification email's CTA link at an arbitrary domain. There's no
    // legitimate reason this needs to vary per-request.
    const origin = 'https://purema.app'
    let subject, html
    if (type === 'feedback') {
      ({ subject, html } = feedbackReceivedEmail({ clientName: recipient.full_name, coachName: callerProfile.full_name, checkinUrl: origin }))
    } else if (type === 'macro') {
      ({ subject, html } = macroTargetsUpdatedEmail({ clientName: recipient.full_name, coachName: callerProfile.full_name, appUrl: origin }))
    } else {
      ({ subject, html } = newMessageEmail({ recipientName: recipient.full_name, senderName: callerProfile.full_name, appUrl: origin }))
    }

    const result = await sendEmail({ to: recipient.email, subject, html })
    res.status(200).json({ ok: true, sent: true, id: result.id })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}
