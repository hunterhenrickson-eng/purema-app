import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

const Mark = ({ size = 24 }) => (
  <svg width={size} height={size * 0.9} viewBox="0 0 52 48">
    <polyline points="6,10 18,24 6,38" fill="none" stroke="#0F6E56" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    <polyline points="19,10 31,24 19,38" fill="none" stroke="#0F6E56" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"/>
    <polyline points="32,10 46,24 32,38" fill="none" stroke="#0F6E56" strokeWidth="5.5" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
)

export default function ResetPassword() {
  const [status, setStatus] = useState('loading') // loading | ready | saving | success | error | invalid
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [errorMsg, setErrorMsg] = useState(null)

  useEffect(() => {
    // Supabase sends the recovery token as a hash fragment:
    // http://localhost:3000/reset-password#access_token=...&type=recovery
    // onAuthStateChange fires a PASSWORD_RECOVERY event when it detects this
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setStatus('ready')
      }
    })

    // Also check if we already have a session from the hash
    // (in case the event fired before we subscribed)
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) setStatus('ready')
      else {
        // Give Supabase a moment to process the hash fragment
        setTimeout(() => {
          setStatus(prev => prev === 'loading' ? 'invalid' : prev)
        }, 2000)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  const handleReset = async (e) => {
    e.preventDefault()
    setErrorMsg(null)

    if (password !== confirm) {
      setErrorMsg('Passwords don\'t match.')
      return
    }
    if (password.length < 6) {
      setErrorMsg('Password must be at least 6 characters.')
      return
    }

    setStatus('saving')

    const { error } = await supabase.auth.updateUser({ password })

    if (error) {
      setErrorMsg(error.message)
      setStatus('ready')
      return
    }

    setStatus('success')
    // Redirect to home after short delay
    setTimeout(() => { window.location.href = '/' }, 2500)
  }

  const shell = (children) => (
    <div style={{ maxWidth: 420, margin: '0 auto', minHeight: '100vh', background: '#0D0D0D',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      padding: 32, textAlign: 'center', fontFamily: 'DM Sans, sans-serif' }}>
      <Mark size={40} />
      {children}
    </div>
  )

  if (status === 'loading') return shell(
    <div style={{ marginTop: 24, fontFamily: 'DM Mono, monospace', fontSize: 12,
      color: '#0F6E56', letterSpacing: '0.1em' }}>LOADING...</div>
  )

  if (status === 'invalid') return shell(
    <>
      <div style={{ marginTop: 24, fontSize: 18, fontWeight: 500, color: '#F5F2ED' }}>
        Link expired or invalid
      </div>
      <div style={{ marginTop: 8, fontSize: 13, color: '#888', lineHeight: 1.6 }}>
        Password reset links expire after a short time. Request a new one from the sign-in screen.
      </div>
      <button onClick={() => { window.location.href = '/' }}
        style={{ marginTop: 24, padding: '10px 24px', borderRadius: 8, border: '1px solid #333',
          background: 'transparent', color: '#AAA', fontSize: 13, cursor: 'pointer',
          fontFamily: 'DM Sans' }}>
        Back to sign in
      </button>
    </>
  )

  if (status === 'success') return shell(
    <>
      <div style={{ marginTop: 24, fontSize: 24, fontWeight: 300, color: '#F5F2ED', letterSpacing: '-0.02em' }}>
        Password updated.
      </div>
      <div style={{ marginTop: 8, fontSize: 13, color: '#888' }}>
        Taking you back to the app...
      </div>
    </>
  )

  return (
    <div style={{ maxWidth: 420, margin: '0 auto', minHeight: '100vh', background: '#0D0D0D',
      display: 'flex', flexDirection: 'column', justifyContent: 'center',
      padding: 32, fontFamily: 'DM Sans, sans-serif' }}>

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 40 }}>
        <Mark size={24} />
        <span style={{ fontSize: 20, fontWeight: 300, letterSpacing: '-0.03em', color: '#F5F2ED' }}>
          purema<span style={{ color: '#0F6E56' }}>.</span>
        </span>
      </div>

      <div style={{ fontSize: 26, fontWeight: 300, color: '#F5F2ED', letterSpacing: '-0.02em', marginBottom: 6 }}>
        Set a new password.
      </div>
      <div style={{ fontSize: 13, color: '#888', marginBottom: 32 }}>
        Choose something you'll remember.
      </div>

      <form onSubmit={handleReset} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div>
          <div style={{ fontSize: 10, color: '#555', fontFamily: 'DM Mono, monospace',
            letterSpacing: '0.08em', marginBottom: 6 }}>NEW PASSWORD</div>
          <input
            type="password"
            required
            minLength={6}
            placeholder="Min 6 characters"
            value={password}
            onChange={e => setPassword(e.target.value)}
            style={{ width: '100%', padding: '12px 14px', borderRadius: 8,
              border: '1px solid #2A2A2A', background: '#1A1A1A',
              color: '#F5F2ED', fontSize: 14, fontFamily: 'DM Sans',
              outline: 'none', boxSizing: 'border-box' }}
          />
        </div>
        <div>
          <div style={{ fontSize: 10, color: '#555', fontFamily: 'DM Mono, monospace',
            letterSpacing: '0.08em', marginBottom: 6 }}>CONFIRM PASSWORD</div>
          <input
            type="password"
            required
            minLength={6}
            placeholder="Same password again"
            value={confirm}
            onChange={e => setConfirm(e.target.value)}
            style={{ width: '100%', padding: '12px 14px', borderRadius: 8,
              border: '1px solid #2A2A2A', background: '#1A1A1A',
              color: '#F5F2ED', fontSize: 14, fontFamily: 'DM Sans',
              outline: 'none', boxSizing: 'border-box' }}
          />
        </div>

        {errorMsg && (
          <div style={{ padding: '10px 14px', background: '#2A1010',
            border: '1px solid #4A2020', borderRadius: 8,
            fontSize: 12, color: '#E24B4A', lineHeight: 1.5 }}>
            {errorMsg}
          </div>
        )}

        <button type="submit" disabled={status === 'saving'}
          style={{ marginTop: 4, padding: '14px', borderRadius: 8, border: 'none',
            background: status === 'saving' ? '#444' : '#0F6E56',
            color: '#F5F2ED', fontWeight: 500, fontSize: 14,
            cursor: status === 'saving' ? 'not-allowed' : 'pointer',
            fontFamily: 'DM Sans', transition: 'background 0.15s ease' }}>
          {status === 'saving' ? 'Updating...' : 'Update password'}
        </button>
      </form>
    </div>
  )
}
