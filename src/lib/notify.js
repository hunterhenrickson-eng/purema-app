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

// Sibling to notify() above, for BookIntakeCall.jsx's anonymous booking
// flow — deliberately NOT session-gated, since a prospect booking a call
// has no session at all. Authorized server-side by the booking_token
// itself instead (see api/notify-intake-booking.js). Same fire-and-forget/
// never-throw philosophy: a failed confirmation email must not make an
// already-successful booking look broken.
export async function notifyIntakeBooking(token) {
  try {
    const res = await fetch('/api/notify-intake-booking', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    })
    const result = await res.json()
    if (!res.ok) console.error('notifyIntakeBooking failed:', result.error || res.status)
  } catch (err) {
    console.error('notifyIntakeBooking failed:', err.message)
  }
}
