import { useEffect } from 'react'
import { color as staticColor, appearance, font, type, displayStyle, badge } from '../lib/theme'
import { PLANS } from '../lib/billing'

// Pre-auth marketing page, same light-theme/token setup as Home.js (see
// that file's top-of-file comment for why this shadow exists and why it
// must ALWAYS render light regardless of system dark-mode preference).
// Monthly pricing only, straight from PLANS — no annual toggle/discount
// UI, since PLANS doesn't represent one.
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

export default function Pricing() {
  // Force light regardless of system preference — see Home.js's top-of-file
  // comment for the full mechanism/reasoning. No unmount cleanup needed for
  // the same reason as Home.js (no client-side routing in this app).
  useEffect(() => {
    document.documentElement.setAttribute('data-appearance', 'light')
  }, [])

  return (
    <div style={{ minHeight: '100vh', background: color.bone, fontFamily: font.sans }}>
      <div style={{ maxWidth: 1040, margin: '0 auto', padding: '28px 24px 80px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <a href="/" style={{ display: 'flex', alignItems: 'center', gap: 8, textDecoration: 'none' }}>
            <Mark size={22} />
            <span style={{ ...displayStyle, fontSize: 18, color: color.textOnLight.primary }}>
              purema<span style={{ color: color.forest }}>.</span>
            </span>
          </a>
        </div>

        <div style={{ maxWidth: 640, margin: '72px auto 0', textAlign: 'center' }}>
          <h1 style={{ ...displayStyle, fontSize: type.display, fontWeight: 300, lineHeight: 1.15,
            color: color.textOnLight.primary, margin: 0 }}>
            Simple pricing, built to grow with your roster.
          </h1>
          <p style={{ fontFamily: font.sans, fontSize: type.bodyLg, color: color.textOnLight.secondary,
            lineHeight: 1.6, margin: '20px 0 0' }}>
            Start free, upgrade as your client list grows.
          </p>
        </div>

        <div style={{ marginTop: 64, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))',
          gap: 20, alignItems: 'stretch' }}>
          {PLANS.map(plan => (
            <div key={plan.id} style={{ background: color.surfaceLight,
              border: plan.recommended ? `1.5px solid ${color.forest}` : `0.5px solid ${color.borderLight}`,
              borderRadius: 12, padding: 24, display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <div style={{ fontFamily: font.mono, fontSize: type.label, fontWeight: 500,
                  letterSpacing: '0.08em', textTransform: 'uppercase', color: color.forest }}>
                  {plan.label}
                </div>
                {plan.recommended && <span style={badge('info')}>Recommended</span>}
              </div>
              <div style={{ fontSize: 28, fontWeight: 500, color: color.textOnLight.primary, fontFamily: font.mono }}>
                ${plan.price}<span style={{ fontSize: 13, color: color.textOnLight.secondary }}>/mo</span>
              </div>
              <div style={{ fontSize: type.body, color: color.textOnLight.secondary, marginTop: 6, marginBottom: 20 }}>
                {plan.limit === Infinity ? 'Unlimited clients' : `Up to ${plan.limit} clients`}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 24, flexGrow: 1 }}>
                {plan.features.map(feature => (
                  <div key={feature} style={{ display: 'flex', alignItems: 'flex-start', gap: 8,
                    fontFamily: font.sans, fontSize: type.body, color: color.textOnLight.primary, lineHeight: 1.4 }}>
                    <span style={{ color: color.forest, flexShrink: 0 }}>✓</span>
                    {feature}
                  </div>
                ))}
              </div>
              <a href="/login" style={plan.recommended ? {
                display: 'block', textAlign: 'center', padding: '10px 0', borderRadius: 8, border: 'none',
                background: color.forest, color: color.sage, textDecoration: 'none',
                fontFamily: font.sans, fontSize: type.body, fontWeight: 500,
              } : {
                display: 'block', textAlign: 'center', padding: '10px 0', borderRadius: 8,
                border: `1px solid ${color.textOnLight.secondary}`, background: 'transparent',
                color: color.textOnLight.secondary, textDecoration: 'none',
                fontFamily: font.sans, fontSize: type.body, fontWeight: 500,
              }}>
                {plan.price === 0 ? 'Start free' : 'Start coaching with Purema'}
              </a>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
