import { useState } from 'react'
import { supabase } from '../lib/supabase'
import {
  color as staticColor, appearance, font, type,
  labelStyleAppearance as labelStyle, inputStyleAppearance as inputStyle, displayStyle,
} from '../lib/theme'
import '../styles/purema-responsive.css'

// One of the four screens wired to the appearance toggle (profiles.appearance
// — see App.js and src/styles/tokens.css). Auth.js previously only ever
// rendered dark (per the explicit decision to add a light variant here,
// unlike AcceptInvite.jsx/ClientOnboarding.jsx/PublicApply.jsx, which stay
// permanently dark and are NOT touched by this shadow). Shadows the
// dark-named fields specifically, since that's what this file's JSX
// already references throughout — resolving through the SAME
// appearance-aware tokens ClientHome.js/CoachDashboard.js use, just mapped
// from their dark-side names instead of their light-side names.
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
  const [mode, setMode] = useState('signin') // signin | signup
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState('coach')
  const [fullName, setFullName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [successMsg, setSuccessMsg] = useState(null)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(null)
    setSuccessMsg(null)
    setLoading(true)

    if (mode === 'signin') {
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
      return
    }

    // Sign up
    const { data, error: signUpError } = await supabase.auth.signUp({ email, password })
    if (signUpError) {
      setError(signUpError.message)
      setLoading(false)
      return
    }

    // Insert profile
    if (data.user) {
      const { error: profileError } = await supabase.from('profiles').insert({
        id: data.user.id,
        role,
        full_name: fullName,
        email,
      })
      if (profileError) {
        setError(profileError.message)
        setLoading(false)
        return
      }
    }

    setLoading(false)
    setSuccessMsg('Account created — check your email to confirm, then sign in.')
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

        {/* Mode toggle */}
        <div style={{ display: 'flex', gap: 4, background: color.void,
          borderRadius: 10, padding: 4, marginBottom: 28 }}>
          {[
            { id: 'signin', label: 'Sign in' },
            { id: 'signup', label: 'Create account' },
          ].map(({ id, label }) => (
            <button key={id} onClick={() => { setMode(id); setError(null); setSuccessMsg(null) }}
              style={{ flex: 1, padding: '9px 0', borderRadius: 8, border: 'none',
                cursor: 'pointer', fontSize: type.body, fontWeight: mode === id ? 500 : 400,
                fontFamily: font.sans,
                background: mode === id ? color.forest : 'transparent',
                color: mode === id ? color.sage : color.textOnDark.secondary,
                transition: 'all 0.15s ease' }}>
              {label}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Name — signup only */}
          {mode === 'signup' && (
            <div>
              <label style={labelStyle()}>Full name</label>
              <input
                type="text"
                required
                placeholder="First and last name"
                value={fullName}
                onChange={e => setFullName(e.target.value)}
                style={inputStyle}
                onFocus={e => e.target.style.borderColor = color.forest}
                onBlur={e => e.target.style.borderColor = color.borderDark}
              />
            </div>
          )}

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

          {/* Password */}
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

          {/* Role — signup only */}
          {mode === 'signup' && (
            <div>
              <label style={labelStyle()}>I am a</label>
              <div style={{ display: 'flex', gap: 8 }}>
                {[
                  { id: 'coach', label: 'Coach' },
                  { id: 'client', label: 'Client' },
                ].map(({ id, label }) => (
                  <button key={id} type="button" onClick={() => setRole(id)}
                    style={{ flex: 1, padding: '10px 0', borderRadius: 8,
                      border: `1px solid ${role === id ? color.forest : color.borderDark}`,
                      background: role === id ? 'rgba(15,110,86,0.12)' : 'transparent',
                      color: role === id ? color.forest : color.textOnDark.secondary,
                      fontSize: type.body, fontWeight: role === id ? 500 : 400,
                      cursor: 'pointer', fontFamily: font.sans,
                      transition: 'all 0.15s ease' }}>
                    {label}
                  </button>
                ))}
              </div>
              {role === 'client' && (
                <div style={{ fontSize: type.label, color: color.textOnDark.faint, marginTop: 6, fontFamily: font.mono }}>
                  Clients typically join via an invite link from their coach.
                </div>
              )}
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
            {loading ? 'Please wait...' : mode === 'signin' ? 'Sign in' : 'Create account'}
          </button>

        </form>

        {/* Forgot password */}
        {mode === 'signin' && (
          <div style={{ textAlign: 'center', marginTop: 20 }}>
            <button onClick={async () => {
              if (!email) { setError('Enter your email above first.'); return }
              setError(null)
              await supabase.auth.resetPasswordForEmail(email, {
                redirectTo: `${window.location.origin}/reset-password`
              })
              setSuccessMsg('Password reset link sent — check your inbox.')
            }}
              style={{ background: 'none', border: 'none', color: color.textOnDark.faint,
                fontSize: type.body, cursor: 'pointer', fontFamily: font.sans,
                textDecoration: 'underline', textDecorationColor: color.borderDark }}>
              Forgot your password?
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