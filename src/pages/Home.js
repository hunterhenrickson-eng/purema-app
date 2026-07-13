import { useEffect } from 'react'
import { color as staticColor, appearance, font, type, displayStyle } from '../lib/theme'

// Marketing landing page, shown at '/' only when there's no active session
// (see App.js / AuthRoutes) — logged-in users never see this. Light theme,
// wired to the same appearance token system as Auth.js/CoachDashboard.js/
// ClientHome.js via the light-side shadow, but this page must ALWAYS render
// light regardless of system/OS dark-mode preference — a deliberate
// exception from every other appearance-aware screen, which does follow the
// user's chosen or system appearance. Since this route bypasses
// AuthRoutes' own data-appearance effect entirely (see App.js), nothing
// pins that here otherwise, and tokens.css's prefers-color-scheme fallback
// would silently render it dark on a dark-mode system.
const color = {
  ...staticColor,
  bone: appearance.surfacePage,
  surfaceLight: appearance.surfaceCard,
  borderLight: appearance.borderDefault,
  textOnLight: appearance.text,
}

const Mark = ({ size = 32 }) => (
  <svg width={size} height={size * 0.9} viewBox="0 0 52 48">
    <polyline points="6,10 18,24 6,38" fill="none" stroke={color.forest} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    <polyline points="19,10 31,24 19,38" fill="none" stroke={color.forest} strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"/>
    <polyline points="32,10 46,24 32,38" fill="none" stroke={color.forest} strokeWidth="5.5" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
)

const FEATURES = [
  {
    title: "Check-ins that don't feel like homework",
    body: 'Weekly check-ins clients actually fill out, with photos, measurements, and compliance tracking built in.',
  },
  {
    title: 'Programming built for physique work',
    body: "Phase-based diet plans, macro adjustments, and targets that evolve with your athlete's prep.",
  },
  {
    title: 'One dashboard, your whole roster',
    body: 'See who needs attention, review check-ins, and leave feedback without digging through group chats.',
  },
  {
    title: 'Get paid without the chase',
    body: 'Built-in billing and client limits by plan, no manual invoicing.',
  },
  {
    title: 'Your brand, not ours',
    body: 'Custom themes, and on Agency, your own logo and domain.',
  },
]

export default function Home() {
  // Force light regardless of system preference — see top-of-file comment.
  // No cleanup on unmount: every navigation away from this page is a real
  // browser navigation (this app has no client-side routing), so the
  // attribute is naturally reset by the next page's own load, not left
  // dangling for a subsequent React remount.
  useEffect(() => {
    document.documentElement.setAttribute('data-appearance', 'light')
  }, [])

  return (
    <div style={{ minHeight: '100vh', background: color.bone, fontFamily: font.sans }}>
      <div style={{ maxWidth: 1040, margin: '0 auto', padding: '28px 24px 80px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Mark size={22} />
            <span style={{ ...displayStyle, fontSize: 18, color: color.textOnLight.primary }}>
              purema<span style={{ color: color.forest }}>.</span>
            </span>
          </div>
          <a href="/pricing" style={{ fontFamily: font.sans, fontSize: type.body, fontWeight: 500,
            color: color.textOnLight.secondary, textDecoration: 'none' }}>
            Pricing
          </a>
        </div>

        <div style={{ maxWidth: 640, margin: '96px auto 0', textAlign: 'center' }}>
          <h1 style={{ ...displayStyle, fontSize: type.display, fontWeight: 300, lineHeight: 1.15,
            color: color.textOnLight.primary, margin: 0 }}>
            Built for coaches who build athletes.
          </h1>
          <p style={{ fontFamily: font.sans, fontSize: type.bodyLg, color: color.textOnLight.secondary,
            lineHeight: 1.6, margin: '20px 0 0' }}>
            Purema is the platform for physique and bodybuilding coaches — manage your roster,
            program with precision, and run your business without the spreadsheet chaos.
          </p>
          <a href="/login" style={{ display: 'inline-block', marginTop: 32, padding: '14px 28px',
            borderRadius: 8, background: color.forest, color: color.sage, textDecoration: 'none',
            fontFamily: font.sans, fontSize: type.body, fontWeight: 500 }}>
            Start coaching with Purema
          </a>
        </div>

        <div style={{ marginTop: 120, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
          gap: 20 }}>
          {FEATURES.map(f => (
            <div key={f.title} style={{ background: color.surfaceLight, border: `0.5px solid ${color.borderLight}`,
              borderRadius: 12, padding: 24 }}>
              <div style={{ fontFamily: font.sans, fontSize: type.bodyLg, fontWeight: 500,
                color: color.textOnLight.primary, marginBottom: 8 }}>
                {f.title}
              </div>
              <div style={{ fontFamily: font.sans, fontSize: type.body, color: color.textOnLight.secondary,
                lineHeight: 1.55 }}>
                {f.body}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
