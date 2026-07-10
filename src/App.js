import { useState, useEffect } from 'react'
import { supabase } from './lib/supabase'
import { color, font, type, badge } from './lib/theme'
import { getImpersonationState, hydrateImpersonationGuard, exitImpersonation } from './lib/impersonation'
import Auth from './pages/Auth'
import CoachDashboard from './pages/CoachDashboard'
import AdminDashboard from './pages/AdminDashboard'
import ClientHome from './components/ClientHome'
import ClientOnboarding from './components/ClientOnboarding'
import AcceptInvite from './components/AcceptInvite'
import ResetPassword from './components/ResetPassword'
import PublicApply from './components/PublicApply'

// Shown above whatever page is active whenever an admin is impersonating a
// coach — visible regardless of which screen the swapped session lands on,
// since it's rendered here in AuthRoutes rather than inside CoachDashboard
// itself. Read-only mode is called out explicitly so it's never mistaken
// for full access.
function ImpersonationBanner() {
  const state = getImpersonationState()
  const [exiting, setExiting] = useState(false)
  if (!state) return null

  // Reuses the existing warning badge hue rather than a new ad-hoc color —
  // same "attention, not an error" register this app already uses badge()
  // for elsewhere (past-due billing, pending status, etc).
  const hue = badge('warning')

  return (
    <div style={{ position: 'sticky', top: 0, zIndex: 1000, background: hue.background,
      padding: '8px 16px', display: 'flex', alignItems: 'center', justifyContent: 'center',
      gap: 10, fontFamily: font.sans, fontSize: type.label, flexWrap: 'wrap' }}>
      <span style={{ color: hue.color, fontWeight: 500 }}>
        Impersonating {state.targetName || state.targetEmail}
        {state.mode === 'readonly' ? ' — read-only, writes are disabled' : ''}
      </span>
      <button disabled={exiting} onClick={async () => { setExiting(true); await exitImpersonation() }}
        style={{ padding: '3px 12px', borderRadius: 6, border: `1px solid ${hue.color}`,
          background: 'transparent', color: hue.color, fontFamily: font.mono, fontSize: type.label,
          cursor: exiting ? 'not-allowed' : 'pointer' }}>
        {exiting ? 'Exiting...' : 'Exit'}
      </button>
    </div>
  )
}

function AuthRoutes() {
  const [session, setSession] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    hydrateImpersonationGuard()

    // Local to this effect — nothing outside references it, so there's no
    // exhaustive-deps issue and no need for useCallback plumbing.
    async function fetchProfile(userId, attempt = 0) {
      const { data } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single()

      // On fresh signup, auth.signUp() resolving is what fires the session
      // change that lands here — but the profiles row insert (in Auth.js,
      // right after signUp) hasn't necessarily landed yet. Retry briefly
      // instead of treating "no row yet" as "this user must be a client".
      if (!data && attempt < 5) {
        setTimeout(() => fetchProfile(userId, attempt + 1), 400)
        return
      }

      setProfile(data)
      setLoading(false)
    }

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      if (session) fetchProfile(session.user.id)
      else setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      if (session) fetchProfile(session.user.id)
      else { setProfile(null); setLoading(false) }
    })

    return () => subscription.unsubscribe()
  }, [])

  let content

  if (loading) {
    content = (
      <div style={{ minHeight: '100vh', background: '#0D0D0D', display: 'flex',
        alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 12,
          color: '#0F6E56', letterSpacing: '0.1em' }}>LOADING...</div>
      </div>
    )
  } else if (!session) {
    content = <Auth />
  } else if (window.location.pathname.startsWith('/admin')) {
    // Same pathname-check pattern as every other route here — /admin needs
    // the session/profile already loaded above to decide access, so it's
    // gated here rather than in App()'s pre-auth path checks.
    if (profile?.role !== 'admin') {
      content = (
        <div style={{ minHeight: '100vh', background: color.bone, display: 'flex',
          flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
          <div style={{ fontFamily: font.sans, fontSize: type.bodyLg, color: color.textOnLight.primary }}>
            You don't have access to this area.
          </div>
          <a href="/" style={{ fontFamily: font.mono, fontSize: type.label,
            color: color.forest, letterSpacing: '0.1em' }}>← BACK TO PUREMA</a>
        </div>
      )
    } else {
      content = <AdminDashboard />
    }
  } else if (profile?.role === 'admin') {
    // An admin landing anywhere other than /admin (e.g. the post-signup
    // redirect to '/', or a bookmarked root URL) still belongs in the admin
    // area, not the client-onboarding/ClientHome fallback below — that
    // fallback is only meaningful for non-admin profiles.
    content = <AdminDashboard />
  } else if (profile?.role === 'coach') {
    content = <CoachDashboard />
  } else if (!profile?.onboarding_completed) {
    content = <ClientOnboarding profile={profile} onComplete={(updated) => setProfile(updated)} />
  } else {
    content = <ClientHome />
  }

  return (
    <>
      <ImpersonationBanner />
      {content}
    </>
  )
}

function App() {
  const path = window.location.pathname

  if (path.startsWith('/invite/')) {
    const token = path.split('/invite/')[1]
    return <AcceptInvite token={token} />
  }

  if (path === '/reset-password') {
    return <ResetPassword />
  }

  if (path.startsWith('/apply/')) {
    const slug = path.split('/apply/')[1]
    return <PublicApply slug={slug} />
  }

  return <AuthRoutes />
}

export default App
