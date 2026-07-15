// Diagnostic-only endpoint for confirming the Resend pipeline actually
// works end to end (key valid, domain/sender accepted, mail delivered) —
// NOT wired into any real app trigger. Deliberately not linked from
// anywhere in the UI; only reachable by a direct POST with a known
// recipient, same "manual curl to verify" role stripe-webhook.js's
// counterparts get exercised with during setup.
//
// Shared-secret gate, not real auth — proportionate to what this is: a
// temporary tool deleted once the pipeline is confirmed working (see
// send-test-email.js's own commit history), not a permanent surface that
// needs session/role checks like the rest of the app.
const sendEmail = require('./_email')
const { feedbackReceivedEmail, macroTargetsUpdatedEmail, newMessageEmail } = require('./_emailTemplates')

const TEMPLATES = {
  feedback: () => feedbackReceivedEmail({
    clientName: 'Alex',
    coachName: 'Coach Jamie',
    checkinUrl: 'https://purema.app/',
  }),
  macros: () => macroTargetsUpdatedEmail({
    clientName: 'Alex',
    coachName: 'Coach Jamie',
    appUrl: 'https://purema.app/',
  }),
  message: () => newMessageEmail({
    recipientName: 'Alex',
    senderName: 'Coach Jamie',
    appUrl: 'https://purema.app/',
  }),
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  const providedSecret = req.headers['x-test-secret']
  if (!process.env.TEST_EMAIL_SECRET || providedSecret !== process.env.TEST_EMAIL_SECRET) {
    res.status(401).json({ error: 'Unauthorized' })
    return
  }

  const { to, template } = req.body || {}
  const build = TEMPLATES[template]

  if (!to || !build) {
    res.status(400).json({ error: `Missing or invalid to/template. template must be one of: ${Object.keys(TEMPLATES).join(', ')}` })
    return
  }

  try {
    const { subject, html } = build()
    const result = await sendEmail({ to, subject, html })
    res.status(200).json({ ok: true, id: result.id })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}
