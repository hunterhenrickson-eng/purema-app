import { supabase } from './supabase'

// Fire-and-forget notification-email trigger — calls api/notify.js after
// a feedback save / macro update / message send already succeeded. Never
// throws: a failed notification must not fail or block the action that
// triggered it, but failures still need to be visible, so they go to
// console.error rather than being swallowed silently.
export async function notify(type, recipientId) {
  try {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { console.error('notify: no active session, skipping', type, recipientId); return }

    const res = await fetch('/api/notify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify({ type, recipientId }),
    })
    const result = await res.json()
    if (!res.ok) console.error(`notify(${type}) failed:`, result.error || res.status)
  } catch (err) {
    console.error(`notify(${type}) failed:`, err.message)
  }
}
