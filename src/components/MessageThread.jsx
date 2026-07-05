import { useEffect, useRef, useState } from 'react'
import { color, font, type, inputStyle } from '../lib/theme'

function formatTime(ts) {
  return new Date(ts).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
}

function dayKey(ts) {
  const d = new Date(ts)
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
}

// "Today" / "Yesterday" / a full date — used as a divider between groups of
// messages from different days, the same shorthand most chat apps use.
function dayLabel(ts) {
  const d = new Date(ts)
  const now = new Date()
  const startOfDay = (date) => new Date(date.getFullYear(), date.getMonth(), date.getDate())
  const diffDays = Math.round((startOfDay(now) - startOfDay(d)) / (1000 * 60 * 60 * 24))
  if (diffDays === 0) return 'Today'
  if (diffDays === 1) return 'Yesterday'
  return d.toLocaleDateString('en-US', {
    month: 'long', day: 'numeric',
    year: d.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
  })
}

// Shared by the coach's per-client thread view and the client's single
// thread with their coach — just the message list + composer, the
// surrounding layout (client list, back button, etc.) is left to the caller.
const MAX_TEXTAREA_HEIGHT = 120

export default function MessageThread({ title, headerLeft, messages, currentUserId, onSend, emptyLabel }) {
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState(null)
  const scrollRef = useRef(null)
  const textareaRef = useRef(null)

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight
  }, [messages])

  // Autofocus whenever the open thread changes (title changes when the
  // coach switches clients) so typing can start immediately.
  useEffect(() => {
    textareaRef.current?.focus()
  }, [title])

  const autoGrow = (el) => {
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, MAX_TEXTAREA_HEIGHT)}px`
  }

  const handleSend = async (e) => {
    e.preventDefault()
    const body = draft.trim()
    if (!body || sending) return
    setSending(true)
    setError(null)
    const result = await onSend(body)
    setSending(false)
    if (!result?.ok) { setError(result?.message || 'Could not send message.'); return }
    setDraft('')
    if (textareaRef.current) textareaRef.current.style.height = 'auto'
  }

  // Enter sends, Shift+Enter inserts a newline — standard chat behavior.
  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend(e)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: color.surfaceLight,
      borderRadius: 12, border: `0.5px solid ${color.borderLight}`, overflow: 'hidden' }}>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '14px 16px',
        borderBottom: `0.5px solid ${color.borderLight}`, flexShrink: 0 }}>
        {headerLeft}
        <div style={{ fontSize: type.body, fontWeight: 500, color: color.textOnLight.primary }}>{title}</div>
      </div>

      <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', padding: 16, display: 'flex',
        flexDirection: 'column', gap: 10, minHeight: 0 }}>
        {messages.length === 0 ? (
          <div style={{ margin: 'auto', textAlign: 'center', color: color.textOnLight.faint, fontSize: type.body }}>
            {emptyLabel || 'No messages yet — say hello.'}
          </div>
        ) : messages.map((m, i) => {
          const mine = m.sender_id === currentUserId
          const prev = messages[i - 1]
          const showDayDivider = !prev || dayKey(prev.created_at) !== dayKey(m.created_at)
          return (
            <div key={m.id} style={{ display: 'flex', flexDirection: 'column' }}>
              {showDayDivider && (
                <div style={{ alignSelf: 'center', margin: '6px 0 4px', padding: '2px 10px',
                  borderRadius: 999, background: color.bone, fontSize: type.label,
                  color: color.textOnLight.faint, fontFamily: font.mono }}>
                  {dayLabel(m.created_at)}
                </div>
              )}
              <div style={{ display: 'flex', flexDirection: 'column', maxWidth: '75%',
                alignSelf: mine ? 'flex-end' : 'flex-start',
                background: mine ? color.forest : color.bone,
                color: mine ? color.sage : color.textOnLight.primary,
                padding: '8px 12px', borderRadius: 14 }}>
                <div style={{ fontSize: type.body, lineHeight: 1.5, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                  {m.body}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 3,
                  justifyContent: mine ? 'flex-end' : 'flex-start',
                  color: mine ? 'rgba(255,255,255,0.65)' : color.textOnLight.faint }}>
                  <span style={{ fontSize: type.label, fontFamily: font.mono }}>{formatTime(m.created_at)}</span>
                  {mine && (
                    <span style={{ fontSize: type.label, color: m.read_at ? color.sage : 'rgba(255,255,255,0.65)',
                      fontWeight: m.read_at ? 700 : 400 }}>
                      ✓ {m.read_at ? 'Read' : 'Sent'}
                    </span>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>

      <form onSubmit={handleSend} style={{ display: 'flex', gap: 8, padding: 12,
        borderTop: `0.5px solid ${color.borderLight}`, flexShrink: 0, alignItems: 'flex-end' }}>
        <textarea
          ref={textareaRef}
          value={draft}
          onChange={e => { setDraft(e.target.value); autoGrow(e.target) }}
          onKeyDown={handleKeyDown}
          placeholder="Type a message..."
          rows={1}
          style={{ ...inputStyle, flex: 1, background: color.surfaceLight, color: color.textOnLight.primary,
            border: `1px solid ${color.borderLight}`, resize: 'none', maxHeight: MAX_TEXTAREA_HEIGHT,
            overflowY: 'auto', lineHeight: 1.4, fontFamily: font.sans }} />
        <button type="submit" disabled={sending || !draft.trim()}
          style={{ padding: '10px 18px', borderRadius: 8, border: 'none', height: 40,
            background: sending || !draft.trim() ? color.textOnLight.faint : color.forest, color: color.sage,
            fontFamily: font.sans, fontSize: type.body, fontWeight: 500,
            cursor: sending || !draft.trim() ? 'not-allowed' : 'pointer' }}>
          Send
        </button>
      </form>
      {error && <div style={{ padding: '0 16px 12px', fontSize: type.label, color: color.alert }}>{error}</div>}
    </div>
  )
}
