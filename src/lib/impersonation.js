import { supabase, setReadOnlyImpersonation } from './supabase'

const STORAGE_KEY = 'purema_impersonation'

export function getImpersonationState() {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

// Re-applies the read-only write guard after a page reload — the module-
// level flag in lib/supabase.js resets on every load, but a read-only
// impersonation session (and the swapped auth session itself) persists via
// sessionStorage/Supabase's own storage, so the guard has to be reasserted
// or a reload would silently leave writes unblocked mid-session.
export function hydrateImpersonationGuard() {
  const state = getImpersonationState()
  if (state?.mode === 'readonly') setReadOnlyImpersonation(true)
}

// Calls the admin-impersonate API, then swaps the browser's active session
// to the target coach via verifyOtp. This fully replaces the admin's own
// session in this client — there's no way to hold both at once — so the
// admin's original tokens are captured first and stashed for exitImpersonation
// to restore.
export async function startImpersonation(targetUserId, mode) {
  const { data: { session: adminSession } } = await supabase.auth.getSession()
  if (!adminSession) throw new Error('No active admin session to return to.')

  const res = await fetch('/api/admin-impersonate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminSession.access_token}` },
    body: JSON.stringify({ targetUserId, mode }),
  })
  const result = await res.json()
  if (!res.ok) throw new Error(result.error || 'Failed to start impersonation')

  const { error: verifyError } = await supabase.auth.verifyOtp({
    token_hash: result.tokenHash, type: 'magiclink',
  })
  if (verifyError) throw verifyError

  sessionStorage.setItem(STORAGE_KEY, JSON.stringify({
    mode,
    targetId: result.targetId,
    targetEmail: result.targetEmail,
    targetName: result.targetName,
    adminAccessToken: adminSession.access_token,
    adminRefreshToken: adminSession.refresh_token,
    startedAt: new Date().toISOString(),
  }))

  if (mode === 'readonly') setReadOnlyImpersonation(true)
}

// Restores the admin's own session before logging the "ended" audit entry,
// so that entry is attributed to the admin's real id, not the coach's.
export async function exitImpersonation() {
  const state = getImpersonationState()
  if (!state) return

  const { error } = await supabase.auth.setSession({
    access_token: state.adminAccessToken,
    refresh_token: state.adminRefreshToken,
  })

  setReadOnlyImpersonation(false)
  sessionStorage.removeItem(STORAGE_KEY)

  if (!error) {
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      await supabase.from('admin_audit_log').insert({
        actor_id: user.id, action: 'account.impersonate_ended',
        target_type: 'profile', target_id: state.targetId,
        after_value: { mode: state.mode, target_email: state.targetEmail, started_at: state.startedAt },
      })
    }
  }

  window.location.href = '/admin'
}
