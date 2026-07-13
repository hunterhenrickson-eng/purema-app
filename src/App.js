import { useState, useEffect } from 'react'
import { supabase } from './lib/supabase'
import { color, font, type, badge } from './lib/theme'
import { getImpersonationState, hydrateImpersonationGuard, exitImpersonation } from './lib/impersonation'
import Auth from './pages/Auth'
import Home from './pages/Home'
import Pricing from './pages/Pricing'
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

  // profiles.appearance ('light' | 'dark' | 'system') drives which values
  // src/styles/tokens.css's CSS custom properties resolve to. 'light'/'dark'
  // set an explicit [data-appearance] attribute (wins outright); 'system'
  // (the column default) or no profile at all REMOVES the attribute, so
  // tokens.css's @media (prefers-color-scheme) block takes over — no JS
  // matchMedia listener needed, since that's inherently reactive via CSS.
  // Known gap, not fixed here: this effect only runs inside AuthRoutes, so
  // a direct/no-session visit to /reset-password (rendered outside
  // AuthRoutes entirely) won't clear a stale attribute left over from an
  // earlier authenticated tab in the same browser that didn't sign out.
  // Narrow, low-severity (worst case: one of two legitimate-looking modes),
  // not addressed this phase.
  useEffect(() => {
    if (profile?.appearance === 'light' || profile?.appearance === 'dark') {
      document.documentElement.setAttribute('data-appearance', profile.appearance)
    } else {
      document.documentElement.removeAttribute('data-appearance')
    }
  }, [profile])

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
    // Auth itself only lives at /login now (see App() below) — a
    // logged-out visitor anywhere else (most commonly '/') sees the
    // marketing Home page instead, per the coach-signup-only decision.
    content = <Home />
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

  // Renders the sign-in/signup form directly, bypassing AuthRoutes'
  // session-gate branching entirely — an already-logged-in user hitting
  // /login just sees the form (no dashboard loop-back), same as any other
  // route here that's decided purely by pathname, not session state.
  if (path === '/login') {
    return <Auth />
  }

  // Same pattern as /login — a static marketing page, unaffected by
  // session state, so it's decided here rather than inside AuthRoutes.
  if (path === '/pricing') {
    return <Pricing />
  }

  if (path.startsWith('/apply/')) {
    const slug = path.split('/apply/')[1]
    return <PublicApply slug={slug} />
  }

  return <AuthRoutes />
}

export default App
