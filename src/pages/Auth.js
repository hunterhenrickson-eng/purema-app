import { useState } from 'react'
import { supabase } from '../lib/supabase'

const Mark = ({ size = 32 }) => (
  <svg width={size} height={size * 0.9} viewBox="0 0 52 48">
    <polyline points="6,10 18,24 6,38" fill="none" stroke="#0F6E56" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    <polyline points="19,10 31,24 19,38" fill="none" stroke="#0F6E56" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"/>
    <polyline points="32,10 46,24 32,38" fill="none" stroke="#0F6E56" strokeWidth="5.5" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
)

const inputStyle = {
  width: '100%',
  padding: '12px 14px',
  borderRadius: 8,
  border: '1px solid #2A2A2A',
  background: '#1A1A1A',
  color: '#F5F2ED',       // bright text — readable on dark bg
  fontSize: 14,
  fontFamily: 'DM Sans, sans-serif',
  outline: 'none',
  boxSizing: 'border-box',
  transition: 'border-color 0.15s ease',
}

const labelStyle = {
  fontSize: 10,
  fontWeight: 500,
  color: '#888',          // visible but subordinate
  letterSpacing: '0.1em',
  textTransform: 'uppercase',
  fontFamily: 'DM Mono, monospace',
  display: 'block',
  marginBottom: 6,
}

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
      if (error) setError(error.message)
      setLoading(false)
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
    <div style={{ minHeight: '100vh', background: '#0D0D0D', display: 'flex',
      flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      padding: 24, fontFamily: 'DM Sans, sans-serif' }}>

      {/* Logo */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 40 }}>
        <Mark size={40} />
        <div style={{ fontSize: 28, fontWeight: 300, letterSpacing: '-0.03em',
          color: '#F5F2ED', marginTop: 12 }}>
          purema<span style={{ color: '#0F6E56' }}>.</span>
        </div>
        <div style={{ fontSize: 11, color: '#555', letterSpacing: '0.18em',
          fontFamily: 'DM Mono, monospace', textTransform: 'uppercase', marginTop: 6 }}>
          Built for coaches who build athletes
        </div>
      </div>

      {/* Card */}
      <div style={{ width: '100%', maxWidth: 420, background: '#141414',
        borderRadius: 16, border: '0.5px solid #222', padding: 32 }}>

        {/* Mode toggle */}
        <div style={{ display: 'flex', gap: 4, background: '#0D0D0D',
          borderRadius: 10, padding: 4, marginBottom: 28 }}>
          {[
            { id: 'signin', label: 'Sign in' },
            { id: 'signup', label: 'Create account' },
          ].map(({ id, label }) => (
            <button key={id} onClick={() => { setMode(id); setError(null); setSuccessMsg(null) }}
              style={{ flex: 1, padding: '9px 0', borderRadius: 8, border: 'none',
                cursor: 'pointer', fontSize: 14, fontWeight: mode === id ? 500 : 400,
                fontFamily: 'DM Sans, sans-serif',
                background: mode === id ? '#0F6E56' : 'transparent',
                color: mode === id ? '#EAF3DE' : '#666',
                transition: 'all 0.15s ease' }}>
              {label}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Name — signup only */}
          {mode === 'signup' && (
            <div>
              <label style={labelStyle}>Full name</label>
              <input
                type="text"
                required
                placeholder="First and last name"
                value={fullName}
                onChange={e => setFullName(e.target.value)}
                style={inputStyle}
                onFocus={e => e.target.style.borderColor = '#0F6E56'}
                onBlur={e => e.target.style.borderColor = '#2A2A2A'}
              />
            </div>
          )}

          {/* Email */}
          <div>
            <label style={labelStyle}>Email</label>
            <input
              type="email"
              required
              placeholder="your@email.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              style={inputStyle}
              onFocus={e => e.target.style.borderColor = '#0F6E56'}
              onBlur={e => e.target.style.borderColor = '#2A2A2A'}
            />
          </div>

          {/* Password */}
          <div>
            <label style={labelStyle}>Password</label>
            <input
              type="password"
              required
              minLength={6}
              placeholder="Min 6 characters"
              value={password}
              onChange={e => setPassword(e.target.value)}
              style={inputStyle}
              onFocus={e => e.target.style.borderColor = '#0F6E56'}
              onBlur={e => e.target.style.borderColor = '#2A2A2A'}
            />
          </div>

          {/* Role — signup only */}
          {mode === 'signup' && (
            <div>
              <label style={labelStyle}>I am a</label>
              <div style={{ display: 'flex', gap: 8 }}>
                {[
                  { id: 'coach', label: 'Coach' },
                  { id: 'client', label: 'Client' },
                ].map(({ id, label }) => (
                  <button key={id} type="button" onClick={() => setRole(id)}
                    style={{ flex: 1, padding: '10px 0', borderRadius: 8,
                      border: `1px solid ${role === id ? '#0F6E56' : '#2A2A2A'}`,
                      background: role === id ? 'rgba(15,110,86,0.12)' : 'transparent',
                      color: role === id ? '#0F6E56' : '#666',
                      fontSize: 14, fontWeight: role === id ? 500 : 400,
                      cursor: 'pointer', fontFamily: 'DM Sans',
                      transition: 'all 0.15s ease' }}>
                    {label}
                  </button>
                ))}
              </div>
              {role === 'client' && (
                <div style={{ fontSize: 11, color: '#555', marginTop: 6, fontFamily: 'DM Mono, monospace' }}>
                  Clients typically join via an invite link from their coach.
                </div>
              )}
            </div>
          )}

          {/* Error */}
          {error && (
            <div style={{ padding: '10px 14px', background: '#2A1010',
              border: '1px solid #4A2020', borderRadius: 8,
              fontSize: 13, color: '#E24B4A', lineHeight: 1.5 }}>
              {error}
            </div>
          )}

          {/* Success */}
          {successMsg && (
            <div style={{ padding: '10px 14px', background: '#0A1F16',
              border: '1px solid #1A4A30', borderRadius: 8,
              fontSize: 13, color: '#0F6E56', lineHeight: 1.5 }}>
              {successMsg}
            </div>
          )}

          {/* Submit */}
          <button type="submit" disabled={loading}
            style={{ height: 48, background: loading ? '#1A1A1A' : '#0F6E56',
              border: 'none', borderRadius: 10, color: loading ? '#555' : '#EAF3DE',
              fontSize: 15, fontWeight: 500, cursor: loading ? 'not-allowed' : 'pointer',
              fontFamily: 'DM Sans', marginTop: 4,
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
              style={{ background: 'none', border: 'none', color: '#555',
                fontSize: 13, cursor: 'pointer', fontFamily: 'DM Sans',
                textDecoration: 'underline', textDecorationColor: '#333' }}>
              Forgot your password?
            </button>
          </div>
        )}
      </div>

      {/* Footer */}
      <div style={{ marginTop: 32, fontSize: 11, color: '#333',
        fontFamily: 'DM Mono, monospace', letterSpacing: '0.06em' }}>
        purema.app · Built for coaches who build athletes.
      </div>
    </div>
  )
}