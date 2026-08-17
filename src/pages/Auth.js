import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import {
  color as staticColor, appearance, font, type,
  labelStyleAppearance as labelStyle, inputStyleAppearance as inputStyle, displayStyle,
} from '../lib/theme'
import '../styles/purema-responsive.css'

// Forced light, same mechanism and reasoning as Home.js/Pricing.js/
// PublicApply.jsx (see PublicApply.jsx's top-of-file comment) — Auth.js
// renders at /login, outside AuthRoutes' own data-appearance-setting
// effect (that only runs once a session/profile is loaded), so without
// this it falls through to tokens.css's prefers-color-scheme fallback and
// renders dark on a dark-mode system. Still shadows `color` through the
// SAME appearance-aware tokens ClientHome.js/CoachDashboard.js use (just
// mapped from dark-side field names, since that's what this file's JSX
// already references throughout) — those names now always resolve to the
// LIGHT token values given the force below, not a live light/dark toggle.
const color = {
  ...staticColor,
  void: appearance.surfacePage,
  surfaceDark: appearance.surfaceCard,
  surfaceDarkRaised: appearance.surfaceRaised,
  borderDark: appearance.borderDefault,
  textOnDark: appearance.text,
}

const Mark = ({ size = 32 }) => (
  <svg width={size} height={size * 0.9} viewBox="0 0 52 48">
    <polyline points="6,10 18,24 6,38" fill="none" stroke={color.forest} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    <polyline points="19,10 31,24 19,38" fill="none" stroke={color.forest} strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"/>
    <polyline points="32,10 46,24 32,38" fill="none" stroke={color.forest} strokeWidth="5.5" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
)

export default function Auth() {
  // No unmount cleanup — every navigation away from this page (successful
  // sign-in, sign-up) is a real browser navigation via window.location.href,
  // same reasoning as Home.js/Pricing.js/PublicApply.jsx.
  useEffect(() => {
    document.documentElement.setAttribute('data-appearance', 'light')
  }, [])

  const [mode, setMode] = useState('signin') // signin | forgot
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [successMsg, setSuccessMsg] = useState(null)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(null)
    setSuccessMsg(null)
    setLoading(true)

    if (mode === 'forgot') {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`
      })
      setLoading(false)
      if (error) {
        setError(error.message)
        return
      }
      setSuccessMsg('Password reset link sent — check your inbox.')
      return
    }

    // Only mode left besides 'forgot' — signup no longer happens here at
    // all (see the top-of-file comment): every new account, coach or
    // client, is provisioned through AcceptInvite.jsx instead.
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }
    // Auth now only renders at /login (see App.js), outside AuthRoutes'
    // session listener — nothing else here would ever move a
    // successfully-signed-in user off this URL, so it has to happen
    // explicitly. '/' re-evaluates session/role and lands on the right
    // dashboard, same as it always has for any other logged-in visit.
    window.location.href = '/'
  }

  return (
    <div style={{ minHeight: '100vh', background: color.void, display: 'flex',
      flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      padding: 24, fontFamily: font.sans }}>

      {/* Logo */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 40 }}>
        <Mark size={40} />
        <div style={{ ...displayStyle, fontSize: type.display, color: color.textOnDark.primary, marginTop: 12 }}>
          purema<span style={{ color: color.forest }}>.</span>
        </div>
        <div style={{ fontSize: type.label, color: color.textOnDark.label, letterSpacing: '0.18em',
          fontFamily: font.mono, textTransform: 'uppercase', marginTop: 6 }}>
          Built for coaches who build athletes
        </div>
      </div>

      {/* Card */}
      <div className="purema-card" style={{ background: color.surfaceDark,
        borderRadius: 16, border: `0.5px solid ${color.borderDark}`, padding: 32 }}>

        {/* No more Sign in / Create account toggle — signup no longer
            happens on this page at all (see top-of-file comment), so
            there's nothing left to toggle to. This heading fills the
            same visual slot the pill switcher used to. */}
        {mode !== 'forgot' && (
          <div style={{ ...labelStyle(), marginBottom: 28, textAlign: 'center' }}>
            Sign in
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Email */}
          <div>
            <label style={labelStyle()}>Email</label>
            <input
              type="email"
              required
              placeholder="your@email.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              style={inputStyle}
              onFocus={e => e.target.style.borderColor = color.forest}
              onBlur={e => e.target.style.borderColor = color.borderDark}
            />
          </div>

          {/* Password — irrelevant to forgot-password (a reset link makes
              a typed-in password moot), so hidden there rather than just
              disabled. */}
          {mode !== 'forgot' && (
            <div>
              <label style={labelStyle()}>Password</label>
              <input
                type="password"
                required
                minLength={6}
                placeholder="Min 6 characters"
                value={password}
                onChange={e => setPassword(e.target.value)}
                style={inputStyle}
                onFocus={e => e.target.style.borderColor = color.forest}
                onBlur={e => e.target.style.borderColor = color.borderDark}
              />
            </div>
          )}

          {/* Error */}
          {error && (
            <div style={{ padding: '10px 14px', background: color.alertBanner.bg,
              border: `1px solid ${color.alertBanner.border}`, borderRadius: 8,
              fontSize: type.body, color: color.alertBanner.text, lineHeight: 1.5 }}>
              {error}
            </div>
          )}

          {/* Success */}
          {successMsg && (
            <div style={{ padding: '10px 14px', background: color.sage,
              border: `1px solid ${color.successBorder}`, borderRadius: 8,
              fontSize: type.body, color: color.forest, lineHeight: 1.5 }}>
              {successMsg}
            </div>
          )}

          {/* Submit */}
          <button type="submit" disabled={loading}
            style={{ height: 48, background: loading ? color.surfaceDarkRaised : color.forest,
              border: 'none', borderRadius: 10, color: loading ? color.textOnDark.faint : color.sage,
              fontSize: type.bodyLg, fontWeight: 500, cursor: loading ? 'not-allowed' : 'pointer',
              fontFamily: font.sans, marginTop: 4,
              transition: 'background 0.15s ease' }}>
            {loading ? 'Please wait...' : mode === 'forgot' ? 'Send reset link' : 'Sign in'}
          </button>

        </form>

        {/* Forgot password — a link into 'forgot' mode from signin, and
            back out of it again. */}
        {mode === 'signin' && (
          <div style={{ textAlign: 'center', marginTop: 20 }}>
            <button onClick={() => { setMode('forgot'); setError(null); setSuccessMsg(null) }}
              style={{ background: 'none', border: 'none', color: color.textOnDark.faint,
                fontSize: type.body, cursor: 'pointer', fontFamily: font.sans,
                textDecoration: 'underline', textDecorationColor: color.borderDark }}>
              Forgot your password?
            </button>
            {/* New accounts (coach or client) are provisioned only through
                AcceptInvite.jsx now — see this file's top-of-file comment
                and Auth.js's PART 2 history. This is a plain informational
                line, not a link — there's no public request-access form to
                send people to yet. */}
            <div style={{ fontSize: type.label, color: color.textOnDark.faint, marginTop: 10, fontFamily: font.mono }}>
              New accounts are created by invite only.
            </div>
          </div>
        )}
        {mode === 'forgot' && (
          <div style={{ textAlign: 'center', marginTop: 20 }}>
            <button onClick={() => { setMode('signin'); setError(null); setSuccessMsg(null) }}
              style={{ background: 'none', border: 'none', color: color.textOnDark.faint,
                fontSize: type.body, cursor: 'pointer', fontFamily: font.sans,
                textDecoration: 'underline', textDecorationColor: color.borderDark }}>
              Back to sign in
            </button>
          </div>
        )}
      </div>

      {/* Footer */}
      <div style={{ marginTop: 32, fontSize: type.label, color: color.textOnDark.faint,
        fontFamily: font.mono, letterSpacing: '0.06em' }}>
        purema.app · Built for coaches who build athletes.
      </div>
    </div>
  )
}