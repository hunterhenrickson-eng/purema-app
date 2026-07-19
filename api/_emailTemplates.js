// Transactional email templates — deliberately simple (one-line summary +
// a link back into the app), not full marketing-style HTML email design.
// Matches the brand system used in Home.js/Pricing.js: Forest (#0F6E56)
// accent, DM Sans. Email clients strip <link>/@import font loading and
// often CSS custom properties too, so colors/fonts are hardcoded literal
// values here rather than routing through src/lib/theme.js — this can't
// share that file anyway since it runs in a separate (Node/Vercel) bundle
// from the React app.
const FOREST = '#0F6E56'
const BONE = '#FAFAFA'
const TEXT_PRIMARY = '#0D0D0D'
const TEXT_SECONDARY = '#5C5C5C'
const BORDER = '#E8E8E8'
const FONT_STACK = "'DM Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif"

function renderEmail({ heading, summary, ctaText, ctaUrl }) {
  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="color-scheme" content="light">
    <meta name="supported-color-schemes" content="light">
  </head>
  <body style="margin:0; padding:0; background:${BONE}; font-family:${FONT_STACK};">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${BONE}; padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" style="max-width:440px;" cellpadding="0" cellspacing="0">
            <tr>
              <td style="padding-bottom:24px;">
                <span style="font-size:18px; font-weight:300; letter-spacing:-0.03em; color:${TEXT_PRIMARY};">
                  purema<span style="color:${FOREST};">.</span>
                </span>
              </td>
            </tr>
            <tr>
              <td style="background:#FFFFFF; border:0.5px solid ${BORDER}; border-radius:12px; padding:28px;">
                <div style="font-size:17px; font-weight:500; color:${TEXT_PRIMARY}; margin-bottom:8px;">
                  ${heading}
                </div>
                <div style="font-size:14px; color:${TEXT_SECONDARY}; line-height:1.5; margin-bottom:24px;">
                  ${summary}
                </div>
                <a href="${ctaUrl}" style="display:inline-block; padding:14px 28px; background:${FOREST}; color:#EAF3DE; border-radius:8px; font-size:14px; font-weight:500; text-decoration:none;">
                  ${ctaText}
                </a>
              </td>
            </tr>
            <tr>
              <td style="padding-top:20px; font-size:12px; color:${TEXT_SECONDARY};">
                purema.app
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`
}

// clientName: the client whose check-in got feedback. coachName: who left
// it. checkinUrl: deep link back into the client's check-in history.
function feedbackReceivedEmail({ clientName, coachName, checkinUrl }) {
  return {
    subject: `${coachName} left feedback on your check-in`,
    html: renderEmail({
      heading: 'New feedback from your coach',
      summary: `${coachName} left feedback on ${clientName ? `${clientName}'s` : 'your'} latest check-in.`,
      ctaText: 'View feedback',
      ctaUrl: checkinUrl,
    }),
  }
}

// clientName: whose targets changed. coachName: who updated them.
function macroTargetsUpdatedEmail({ clientName, coachName, appUrl }) {
  return {
    subject: `${coachName} updated your macro targets`,
    html: renderEmail({
      heading: 'Your targets were updated',
      summary: `${coachName} updated ${clientName ? `${clientName}'s` : 'your'} macro targets.`,
      ctaText: 'View targets',
      ctaUrl: appUrl,
    }),
  }
}

// recipientName: who's receiving the notification. senderName: who sent
// the message.
function newMessageEmail({ recipientName, senderName, appUrl }) {
  return {
    subject: `New message from ${senderName}`,
    html: renderEmail({
      heading: 'You have a new message',
      summary: `${senderName} sent ${recipientName ? `${recipientName} ` : ''}a new message on Purema.`,
      ctaText: 'View message',
      ctaUrl: appUrl,
    }),
  }
}

module.exports = { feedbackReceivedEmail, macroTargetsUpdatedEmail, newMessageEmail }
