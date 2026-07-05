import { useState, useEffect } from 'react'
import { supabase } from './lib/supabase'
import Auth from './pages/Auth'
import CoachDashboard from './pages/CoachDashboard'
import ClientHome from './components/ClientHome'
import ClientOnboarding from './components/ClientOnboarding'
import AcceptInvite from './components/AcceptInvite'
import ResetPassword from './components/ResetPassword'
import PublicApply from './components/PublicApply'

function AuthRoutes() {
  const [session, setSession] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
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

  if (loading) return (
    <div style={{ minHeight: '100vh', background: '#0D0D0D', display: 'flex',
      alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 12,
        color: '#0F6E56', letterSpacing: '0.1em' }}>LOADING...</div>
    </div>
  )

  if (!session) return <Auth />
  if (profile?.role === 'coach') return <CoachDashboard />
  if (!profile?.onboarding_completed) {
    return <ClientOnboarding profile={profile} onComplete={(updated) => setProfile(updated)} />
  }
  return <ClientHome />
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