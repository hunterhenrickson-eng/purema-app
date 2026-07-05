import { useState, useEffect, useMemo, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { color, font, type, labelStyle } from '../lib/theme'
import '../styles/purema-responsive.css'
import InviteClient from '../components/InviteClient'
import { PLANS, planById, tierLimit, isSubscribed, isPastDue, isSuspended } from '../lib/billing'
import { getActivePhase } from '../lib/dietPlan'
import ImportHistory from '../components/ImportHistory'
import MessageThread from '../components/MessageThread'

// ─── Icons ────────────────────────────────────────────────────────────────────

const Mark = ({ size = 24 }) => (
  <svg width={size} height={size * 0.9} viewBox="0 0 52 48">
    <polyline points="6,10 18,24 6,38" fill="none" stroke={color.forest} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    <polyline points="19,10 31,24 19,38" fill="none" stroke={color.forest} strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"/>
    <polyline points="32,10 46,24 32,38" fill="none" stroke={color.forest} strokeWidth="5.5" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
)

const SearchIcon = () => (
  <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
  </svg>
)

// ─── Shared styles ────────────────────────────────────────────────────────────

const S = {
  card: { background: color.surfaceLight, borderRadius: 12, border: `0.5px solid ${color.borderLight}`, padding: 20 },
  label: { ...labelStyle(false), letterSpacing: '0.1em' },
  sectionTitle: { ...labelStyle(false), letterSpacing: '0.1em', marginBottom: 14 },
}

// A transparency label, not a warning — backfilled history is real data,
// just not a live weekly submission, so this stays subtle/neutral rather
// than using an alert color.
const ImportedTag = ({ onDark }) => (
  <span style={{ fontSize: type.label, color: onDark ? color.textOnDark.faint : color.textOnLight.faint,
    border: `1px solid ${onDark ? color.borderDark : color.borderLight}`,
    padding: '1px 7px', borderRadius: 999, fontFamily: font.mono, whiteSpace: 'nowrap' }}>
    Imported
  </span>
)

// ─── Attention queue logic ────────────────────────────────────────────────────

function buildAttentionQueue(clients, checkins) {
  const now = new Date()
  const items = []
  const activeClients = clients.filter(c => !c.status || c.status === 'active')

  activeClients.forEach(client => {
    const clientCheckins = checkins
      .filter(c => c.client_id === client.id || c.client_name === client.full_name)
      .sort((a, b) => new Date(b.submitted_at) - new Date(a.submitted_at))
    const latest = clientCheckins[0]

    if (latest && !latest.coach_feedback) {
      const hoursAgo = (now - new Date(latest.submitted_at)) / (1000 * 60 * 60)
      if (hoursAgo >= 24) {
        items.push({
          type: 'feedback_needed', priority: 1, client, checkin: latest,
          label: 'Feedback needed',
          sublabel: `Submitted ${Math.floor(hoursAgo)}h ago · Week ${latest.week_number}`,
          color: color.gold, bg: '#FAEEDA', textColor: '#633806',
        })
        return
      }
    }

    const clientAge = (now - new Date(client.created_at)) / (1000 * 60 * 60 * 24)
    if (clientAge >= 8) {
      if (!latest || (now - new Date(latest.submitted_at)) / (1000 * 60 * 60 * 24) >= 8) {
        items.push({
          type: 'no_checkin', priority: 2, client, checkin: null,
          label: 'No recent check-in',
          sublabel: latest
            ? `Last seen ${Math.floor((now - new Date(latest.submitted_at)) / (1000 * 60 * 60 * 24))} days ago`
            : 'No check-ins yet',
          color: color.textOnLight.secondary, bg: '#F0EDE8', textColor: color.textOnLight.secondary,
        })
      }
    }
  })

  return items.sort((a, b) => a.priority - b.priority)
}

// ─── Search bar ───────────────────────────────────────────────────────────────

const SearchBar = ({ clients, checkins, onSelectCheckin, onSelectClient }) => {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const q = query.toLowerCase().trim()

  const matchedClients = q.length < 2 ? [] : clients.filter(c =>
    (c.full_name || '').toLowerCase().includes(q) ||
    (c.email || '').toLowerCase().includes(q)
  ).slice(0, 4)

  const matchedCheckins = q.length < 2 ? [] : checkins.filter(c =>
    (c.client_name || '').toLowerCase().includes(q)
  ).slice(0, 4)

  const hasResults = matchedClients.length > 0 || matchedCheckins.length > 0
  const showDropdown = open && q.length >= 2

  return (
    <div ref={ref} style={{ position: 'relative', width: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8,
        background: color.surfaceDarkRaised, borderRadius: 8, padding: '7px 12px',
        border: `1px solid ${color.borderDark}` }}>
        <span style={{ color: color.textOnDark.secondary }}><SearchIcon /></span>
        <input
          value={query}
          onChange={e => { setQuery(e.target.value); setOpen(true) }}
          onFocus={() => setOpen(true)}
          placeholder="Search clients or check-ins..."
          style={{ background: 'transparent', border: 'none', outline: 'none',
            color: color.textOnDark.primary, fontSize: type.body, fontFamily: font.sans, width: '100%' }}
        />
        {query && (
          <button onClick={() => { setQuery(''); setOpen(false) }}
            style={{ background: 'none', border: 'none', color: color.textOnDark.secondary, cursor: 'pointer', fontSize: 16, lineHeight: 1 }}>
            ×
          </button>
        )}
      </div>

      {showDropdown && (
        <div style={{ position: 'absolute', top: 'calc(100% + 6px)', left: 0, right: 0,
          background: color.surfaceLight, borderRadius: 10, border: `0.5px solid ${color.borderLight}`,
          boxShadow: '0 8px 24px rgba(0,0,0,0.12)', zIndex: 300, overflow: 'hidden' }}>
          {!hasResults && (
            <div style={{ padding: '14px 16px', fontSize: type.body, color: color.textOnLight.secondary, fontFamily: font.sans }}>
              No results for "{query}"
            </div>
          )}
          {matchedClients.length > 0 && (
            <>
              <div style={{ padding: '8px 16px 4px', ...S.label }}>Clients</div>
              {matchedClients.map(client => (
                <div key={client.id}
                  onClick={() => { onSelectClient(client); setQuery(''); setOpen(false) }}
                  style={{ padding: '10px 16px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10 }}
                  onMouseEnter={e => e.currentTarget.style.background = color.bone}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                  <div style={{ width: 28, height: 28, borderRadius: '50%', background: color.sage,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: type.label, fontWeight: 500, color: color.forest, flexShrink: 0 }}>
                    {(client.full_name || client.email || '?').charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <div style={{ fontSize: type.body, fontWeight: 500, color: color.textOnLight.primary }}>{client.full_name || '—'}</div>
                    <div style={{ fontSize: type.label, color: color.textOnLight.secondary }}>{client.email}</div>
                  </div>
                </div>
              ))}
            </>
          )}
          {matchedCheckins.length > 0 && (
            <>
              <div style={{ padding: '8px 16px 4px', ...S.label, borderTop: matchedClients.length > 0 ? '0.5px solid #F0F0F0' : 'none' }}>Check-ins</div>
              {matchedCheckins.map(checkin => (
                <div key={checkin.id}
                  onClick={() => { onSelectCheckin(checkin); setQuery(''); setOpen(false) }}
                  style={{ padding: '10px 16px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10 }}
                  onMouseEnter={e => e.currentTarget.style.background = color.bone}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                  <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#FAEEDA',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: type.label, fontWeight: 500, color: color.gold, flexShrink: 0 }}>
                    {checkin.client_name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <div style={{ fontSize: type.body, fontWeight: 500, color: color.textOnLight.primary }}>{checkin.client_name}</div>
                    <div style={{ fontSize: type.label, color: color.textOnLight.secondary }}>Week {checkin.week_number} · {new Date(checkin.submitted_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</div>
                  </div>
                  <span style={{ marginLeft: 'auto', fontSize: type.label, background: checkin.coach_feedback ? color.sage : '#FAEEDA',
                    color: checkin.coach_feedback ? '#1A5C0A' : '#633806',
                    padding: '2px 8px', borderRadius: 999, fontFamily: font.mono }}>
                    {checkin.coach_feedback ? 'Done' : 'Pending'}
                  </span>
                </div>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Attention card ───────────────────────────────────────────────────────────

const AttentionCard = ({ item, onSelectCheckin }) => {
  const initials = (item.client.full_name || item.client.email || '?')
    .split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)

  return (
    <div onClick={() => item.checkin && onSelectCheckin(item.checkin)}
      style={{ ...S.card, display: 'flex', alignItems: 'center', gap: 14,
        cursor: item.checkin ? 'pointer' : 'default' }}
      onMouseEnter={e => { if (item.checkin) e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.08)' }}
      onMouseLeave={e => e.currentTarget.style.boxShadow = 'none'}>
      <div style={{ width: 42, height: 42, borderRadius: '50%', background: item.bg,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 13, fontWeight: 500, color: item.color, flexShrink: 0 }}>
        {initials}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: type.body, fontWeight: 500, color: color.textOnLight.primary }}>
          {item.client.full_name || item.client.email}
        </div>
        <div style={{ fontSize: type.label, color: color.textOnLight.secondary, marginTop: 2 }}>{item.sublabel}</div>
      </div>
      <span style={{ fontSize: type.label, background: item.bg, color: item.textColor,
        padding: '3px 10px', borderRadius: 999, fontFamily: font.mono,
        fontWeight: 500, whiteSpace: 'nowrap', flexShrink: 0 }}>
        {item.label}
      </span>
      {item.checkin && <span style={{ color: color.textOnLight.faint, fontSize: 18, flexShrink: 0 }}>›</span>}
    </div>
  )
}

// ─── Check-in detail modal ────────────────────────────────────────────────────

const CheckInDetail = ({ checkin, onClose, onFeedbackSave, coachId }) => {
  const [feedback, setFeedback] = useState(checkin.coach_feedback || '')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [override, setOverride] = useState(null)
  const [overrideForm, setOverrideForm] = useState({ calories: '', protein: '', carbs: '', fats: '', note: '' })
  const [overrideLoading, setOverrideLoading] = useState(true)
  const [overrideSaving, setOverrideSaving] = useState(false)
  const [overrideSaved, setOverrideSaved] = useState(false)
  const [overrideError, setOverrideError] = useState(null)

  useEffect(() => {
    let cancelled = false
    async function loadOverride() {
      setOverrideLoading(true)
      const { data } = await supabase.from('weekly_target_overrides')
        .select('*').eq('client_id', checkin.client_id).eq('week_number', checkin.week_number).maybeSingle()
      if (cancelled) return
      setOverride(data || null)
      if (data) {
        setOverrideForm({
          calories: data.calories ?? '', protein: data.protein ?? '', carbs: data.carbs ?? '', fats: data.fats ?? '', note: '',
        })
      }
      setOverrideLoading(false)
    }
    loadOverride()
    return () => { cancelled = true }
  }, [checkin.client_id, checkin.week_number])

  const saveOverride = async () => {
    setOverrideSaving(true)
    setOverrideError(null)
    const values = {
      calories: overrideForm.calories === '' ? null : parseFloat(overrideForm.calories),
      protein: overrideForm.protein === '' ? null : parseFloat(overrideForm.protein),
      carbs: overrideForm.carbs === '' ? null : parseFloat(overrideForm.carbs),
      fats: overrideForm.fats === '' ? null : parseFloat(overrideForm.fats),
    }
    const { data, error } = await supabase.from('weekly_target_overrides')
      .upsert({
        client_id: checkin.client_id, coach_id: coachId, week_number: checkin.week_number, ...values,
      }, { onConflict: 'client_id,week_number' })
      .select().single()
    setOverrideSaving(false)
    if (error || !data) { setOverrideError(error?.message || "Couldn't save override."); return }
    setOverride(data)
    await supabase.from('macro_adjustments').insert({
      client_id: checkin.client_id, coach_id: coachId, phase_id: null, ...values, note: overrideForm.note || null,
    })
    setOverrideSaved(true)
    setTimeout(() => setOverrideSaved(false), 2000)
  }

  // Parse notes — could be JSON (new format) or plain text (old format)
  let parsedNotes = null
  try {
    if (checkin.notes) parsedNotes = JSON.parse(checkin.notes)
  } catch (e) {}

  const isNewFormat = parsedNotes && parsedNotes.daily_log
  const dailyLog = isNewFormat ? parsedNotes.daily_log : null
  const vitals = isNewFormat ? parsedNotes.vitals : null
  const reflection = isNewFormat ? parsedNotes.reflection : null

  const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

  const saveFeedback = async () => {
    setSaving(true)
    const feedbackAt = new Date().toISOString()
    const { error } = await supabase.from('check_ins').update({ coach_feedback: feedback, feedback_at: feedbackAt }).eq('id', checkin.id)
    setSaving(false)
    if (!error) { setSaved(true); onFeedbackSave(checkin.id, feedback, feedbackAt); setTimeout(() => setSaved(false), 2000) }
  }

  const Row = ({ label, value, unit }) => value ? (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '0.5px solid #F0F0F0' }}>
      <span style={{ fontSize: type.body, color: color.textOnLight.secondary }}>{label}</span>
      <span style={{ fontSize: type.body, fontWeight: 500, color: color.textOnLight.primary }}>{value}{unit ? ' ' + unit : ''}</span>
    </div>
  ) : null

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={onClose}>
      <div style={{ background: color.bone, borderRadius: 16, width: '100%', maxWidth: isNewFormat ? 1100 : 600, maxHeight: '92vh', overflowY: 'auto', margin: '0 20px' }} onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div style={{ position: 'sticky', top: 0, background: color.void, padding: '16px 24px', borderRadius: '16px 16px 0 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', zIndex: 10 }}>
          <div>
            <div style={{ fontSize: 17, fontWeight: 500, color: color.textOnDark.primary }}>{checkin.client_name}</div>
            <div style={{ fontSize: type.label, color: color.forest, fontFamily: font.mono, marginTop: 2, display: 'flex', alignItems: 'center', gap: 8 }}>
              WEEK {checkin.week_number}
              {checkin.imported_backfill && <ImportedTag onDark />}
            </div>
          </div>
          <button onClick={onClose} style={{ background: color.surfaceDarkRaised, border: 'none', color: color.textOnDark.secondary, width: 32, height: 32, borderRadius: '50%', cursor: 'pointer', fontSize: 16 }}>×</button>
        </div>

        <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* ── NEW FORMAT ─────────────────────────────────────── */}
          {isNewFormat && (
            <>
              {/* Weekly averages */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
                {[
                  { label: 'AVG WEIGHT', value: checkin.weight, unit: 'lbs' },
                  { label: 'AVG SLEEP', value: checkin.sleep, unit: 'hrs' },
                  { label: 'AVG STEPS', value: checkin.steps ? checkin.steps.toLocaleString() : null, unit: '' },
                  { label: 'WEEK', value: checkin.week_number, unit: '' },
                ].map(({ label, value, unit }) => value ? (
                  <div key={label} style={{ background: color.void, borderRadius: 10, padding: '12px 16px' }}>
                    <div style={{ fontSize: 20, fontWeight: 300, color: color.textOnDark.primary }}>{value}<span style={{ fontSize: type.label, color: color.textOnDark.faint, marginLeft: 3 }}>{unit}</span></div>
                    <div style={{ ...S.label, color: color.textOnDark.label, marginTop: 4 }}>{label}</div>
                  </div>
                ) : null)}
              </div>

              {/* Daily log */}
              <div style={{ background: color.surfaceLight, borderRadius: 12, border: `0.5px solid ${color.borderLight}`, padding: 16 }}>
                <div style={{ ...S.label, marginBottom: 14 }}>Daily log</div>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 800, fontSize: 13 }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid #F0F0F0' }}>
                        <td style={{ padding: '6px 10px', color: color.textOnLight.secondary, fontFamily: font.mono, fontSize: type.label, letterSpacing: '0.06em' }}>METRIC</td>
                        {DAYS.map(d => (
                          <td key={d} style={{ padding: '6px 10px', textAlign: 'center', fontWeight: 600, color: color.textOnLight.primary, fontFamily: font.mono, fontSize: type.label, letterSpacing: '0.04em' }}>{d}</td>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {[
                        { key: 'weight', label: 'Weight (lbs)', unit: '' },
                        { key: 'sleep', label: 'Sleep', unit: 'hrs' },
                        { key: 'steps', label: 'Steps', unit: '' },
                        { key: 'water', label: 'Water', unit: 'gal' },
                        { key: 'training', label: 'Training', unit: '' },
                        { key: 'performance', label: 'Performance', unit: '' },
                        { key: 'desire', label: 'Desire (0–5)', unit: '' },
                        { key: 'on_plan', label: 'On plan?', unit: '' },
                      ].map(({ key, label, unit }) => (
                        <tr key={key} style={{ borderBottom: '0.5px solid #F5F5F5' }}>
                          <td style={{ padding: '8px 10px', color: color.textOnLight.secondary, fontSize: 12, whiteSpace: 'nowrap' }}>{label}</td>
                          {dailyLog.map((day, i) => {
                            let val = day[key]
                            if (key === 'on_plan') val = val === true ? '✓' : val === false ? '✗' : '—'
                            else if (key === 'performance') {
                              const pMap = { 0: '↓', 1: '→', 2: '↑' }
                              val = val !== '' && val !== null && val !== undefined ? pMap[parseInt(val)] || '—' : '—'
                            }
                            else if (key === 'steps') val = val ? parseInt(val).toLocaleString() : '—'
                            else val = val || '—'
                            const isOnPlan = key === 'on_plan'
                            const cellColor = key === 'on_plan' ? (day.on_plan === true ? color.forest : day.on_plan === false ? color.alert : color.textOnLight.faint)
                              : key === 'performance' ? (day.performance === 2 ? color.forest : day.performance === 0 ? color.alert : color.textOnLight.secondary)
                              : color.textOnLight.primary
                            return (
                              <td key={i} style={{ padding: '8px 10px', textAlign: 'center', color: cellColor, fontWeight: isOnPlan ? 600 : 400 }}>
                                {val}{val !== '—' && unit ? ` ${unit}` : ''}
                              </td>
                            )
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Diet deviations */}
                {dailyLog.some(d => !d.on_plan && d.diet_notes) && (
                  <div style={{ marginTop: 14, paddingTop: 14, borderTop: '0.5px solid #F0F0F0' }}>
                    <div style={{ ...S.label, marginBottom: 8 }}>Diet deviations</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {dailyLog.map((d, i) => !d.on_plan && d.diet_notes ? (
                        <div key={i} style={{ display: 'flex', gap: 10, fontSize: 13 }}>
                          <span style={{ color: color.textOnLight.secondary, fontFamily: font.mono, fontSize: type.label, minWidth: 32 }}>{DAYS[i]}</span>
                          <span style={{ color: color.textOnLight.primary }}>{d.diet_notes}</span>
                        </div>
                      ) : null)}
                    </div>
                  </div>
                )}

                {/* Gut issues */}
                {dailyLog.some(d => d.digestive_issues && d.digestive_notes) && (
                  <div style={{ marginTop: 14, paddingTop: 14, borderTop: '0.5px solid #F0F0F0' }}>
                    <div style={{ ...S.label, marginBottom: 8 }}>Digestive issues</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {dailyLog.map((d, i) => d.digestive_issues && d.digestive_notes ? (
                        <div key={i} style={{ display: 'flex', gap: 10, fontSize: 13 }}>
                          <span style={{ color: color.textOnLight.secondary, fontFamily: font.mono, fontSize: type.label, minWidth: 32 }}>{DAYS[i]}</span>
                          <span style={{ color: color.textOnLight.primary }}>{d.digestive_notes}</span>
                        </div>
                      ) : null)}
                    </div>
                  </div>
                )}
              </div>

              {/* Lifts */}
              {dailyLog.some(d => d.lifts) && (
                <div style={{ background: color.surfaceLight, borderRadius: 12, border: `0.5px solid ${color.borderLight}`, padding: 16 }}>
                  <div style={{ ...S.label, marginBottom: 14 }}>Lift tracker</div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 12 }}>
                    {dailyLog.map((d, i) => d.lifts ? (
                      <div key={i}>
                        <div style={{ fontSize: type.label, fontWeight: 600, color: color.textOnLight.primary, fontFamily: font.mono, letterSpacing: '0.06em', marginBottom: 6 }}>{DAYS[i]}</div>
                        <div style={{ fontSize: 13, color: color.textOnLight.primary, lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>{d.lifts}</div>
                      </div>
                    ) : null)}
                  </div>
                </div>
              )}

              {/* Day notes */}
              {dailyLog.some(d => d.notes) && (
                <div style={{ background: color.surfaceLight, borderRadius: 12, border: `0.5px solid ${color.borderLight}`, padding: 16 }}>
                  <div style={{ ...S.label, marginBottom: 14 }}>Day notes</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {dailyLog.map((d, i) => d.notes ? (
                      <div key={i} style={{ display: 'flex', gap: 12 }}>
                        <div style={{ fontSize: type.label, fontWeight: 600, color: color.textOnLight.secondary, fontFamily: font.mono, minWidth: 32, paddingTop: 2 }}>{DAYS[i]}</div>
                        <div style={{ fontSize: 14, color: color.textOnLight.primary, lineHeight: 1.7 }}>{d.notes}</div>
                      </div>
                    ) : null)}
                  </div>
                </div>
              )}

              {/* Measurements */}
              {(checkin.waist || checkin.chest || checkin.hips || checkin.arms || checkin.thighs) && (
                <div style={{ background: color.surfaceLight, borderRadius: 12, border: `0.5px solid ${color.borderLight}`, padding: 16 }}>
                  <div style={{ ...S.label, marginBottom: 12 }}>Measurements</div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 10 }}>
                    {[['Waist', checkin.waist], ['Chest', checkin.chest], ['Hips', checkin.hips], ['Arms', checkin.arms], ['Thighs', checkin.thighs]].map(([label, val]) => val ? (
                      <div key={label} style={{ background: color.bone, borderRadius: 8, padding: '10px 12px', textAlign: 'center' }}>
                        <div style={{ fontSize: 16, fontWeight: 500, color: color.textOnLight.primary }}>{val}<span style={{ fontSize: type.label, color: color.textOnLight.faint, marginLeft: 2 }}>in</span></div>
                        <div style={{ ...S.label, marginTop: 4 }}>{label}</div>
                      </div>
                    ) : null)}
                  </div>
                </div>
              )}

              {/* Vitals */}
              {vitals && (vitals.resting_hr || vitals.blood_pressure || vitals.blood_glucose) && (
                <div style={{ background: color.surfaceLight, borderRadius: 12, border: `0.5px solid ${color.borderLight}`, padding: 16 }}>
                  <div style={{ ...S.label, marginBottom: 12 }}>Weekly vitals</div>
                  <div style={{ display: 'flex', gap: 20 }}>
                    {vitals.resting_hr && <div><span style={{ fontSize: type.body, color: color.textOnLight.secondary }}>Resting HR </span><span style={{ fontSize: type.body, fontWeight: 500, color: color.textOnLight.primary }}>{vitals.resting_hr} bpm</span></div>}
                    {vitals.blood_pressure && <div><span style={{ fontSize: type.body, color: color.textOnLight.secondary }}>BP </span><span style={{ fontSize: type.body, fontWeight: 500, color: color.textOnLight.primary }}>{vitals.blood_pressure}</span></div>}
                    {vitals.blood_glucose && <div><span style={{ fontSize: type.body, color: color.textOnLight.secondary }}>Glucose </span><span style={{ fontSize: type.body, fontWeight: 500, color: color.textOnLight.primary }}>{vitals.blood_glucose} mg/dL</span></div>}
                  </div>
                </div>
              )}

              {/* Reflection */}
              {reflection && (reflection.win || reflection.improve || reflection.notes) && (
                <div style={{ background: color.surfaceLight, borderRadius: 12, border: `0.5px solid ${color.borderLight}`, padding: 16 }}>
                  <div style={{ ...S.label, marginBottom: 14 }}>Weekly reflection</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                    {reflection.win && (
                      <div>
                        <div style={{ fontSize: type.label, color: color.forest, fontFamily: font.mono, letterSpacing: '0.06em', marginBottom: 4 }}>WIN OF THE WEEK</div>
                        <div style={{ fontSize: 14, color: color.textOnLight.primary, lineHeight: 1.7 }}>{reflection.win}</div>
                      </div>
                    )}
                    {reflection.improve && (
                      <div>
                        <div style={{ fontSize: type.label, color: color.gold, fontFamily: font.mono, letterSpacing: '0.06em', marginBottom: 4 }}>AREAS TO IMPROVE</div>
                        <div style={{ fontSize: 14, color: color.textOnLight.primary, lineHeight: 1.7 }}>{reflection.improve}</div>
                      </div>
                    )}
                    {reflection.notes && (
                      <div>
                        <div style={{ fontSize: type.label, color: color.textOnLight.secondary, fontFamily: font.mono, letterSpacing: '0.06em', marginBottom: 4 }}>ADDITIONAL NOTES</div>
                        <div style={{ fontSize: 14, color: color.textOnLight.primary, lineHeight: 1.7 }}>{reflection.notes}</div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </>
          )}

          {/* ── OLD FORMAT (backwards compatible) ─────────────── */}
          {!isNewFormat && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div style={{ background: color.surfaceLight, borderRadius: 12, padding: 16, border: `0.5px solid ${color.borderLight}` }}>
                <div style={{ ...S.label, marginBottom: 12 }}>Body metrics</div>
                <Row label="Weight" value={checkin.weight} unit="lbs" />
                <Row label="Waist" value={checkin.waist} unit="in" />
                <Row label="Chest" value={checkin.chest} unit="in" />
                <Row label="Hips" value={checkin.hips} unit="in" />
                <Row label="Arms" value={checkin.arms} unit="in" />
                <Row label="Thighs" value={checkin.thighs} unit="in" />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ background: color.surfaceLight, borderRadius: 12, padding: 16, border: `0.5px solid ${color.borderLight}` }}>
                  <div style={{ ...S.label, marginBottom: 12 }}>Nutrition</div>
                  <Row label="Calories" value={checkin.calories} unit="kcal" />
                  <Row label="Protein" value={checkin.protein} unit="g" />
                  <Row label="Carbs" value={checkin.carbs} unit="g" />
                  <Row label="Fats" value={checkin.fats} unit="g" />
                </div>
                <div style={{ background: color.surfaceLight, borderRadius: 12, padding: 16, border: `0.5px solid ${color.borderLight}` }}>
                  <div style={{ ...S.label, marginBottom: 12 }}>Lifestyle</div>
                  <Row label="Sleep" value={checkin.sleep} unit="hrs" />
                  <Row label="Steps" value={checkin.steps} />
                </div>
              </div>
              {checkin.notes && (
                <div style={{ gridColumn: '1 / -1', background: color.surfaceLight, borderRadius: 12, padding: 16, border: `0.5px solid ${color.borderLight}` }}>
                  <div style={{ ...S.label, marginBottom: 8 }}>Client notes</div>
                  <div style={{ fontSize: 14, color: color.textOnLight.primary, lineHeight: 1.6 }}>{checkin.notes}</div>
                </div>
              )}
            </div>
          )}

          {/* Override this week's targets — doesn't touch the underlying
              diet plan, just this one check-in's week */}
          <div style={{ background: color.surfaceLight, borderRadius: 12, border: `0.5px solid ${color.borderLight}`, padding: 16 }}>
            <div style={{ ...S.label, marginBottom: 4 }}>Override targets for week {checkin.week_number}</div>
            <div style={{ fontSize: type.label, color: color.textOnLight.secondary, marginBottom: 12 }}>
              Only affects this check-in — the client's diet plan stays unchanged.
            </div>
            {!overrideLoading && (
              <>
                <PhaseFieldsGrid values={overrideForm} onChange={(key, val) => setOverrideForm(v => ({ ...v, [key]: val }))} />
                <input type="text" placeholder="Note (optional) — why this week is different" value={overrideForm.note}
                  onChange={e => setOverrideForm(v => ({ ...v, note: e.target.value }))}
                  style={{ width: '100%', padding: '7px 10px', borderRadius: 6, border: `1px solid ${color.borderLight}`,
                    fontFamily: font.sans, fontSize: type.body, boxSizing: 'border-box', marginBottom: 8, color: color.textOnLight.primary }} />
                {overrideError && <div style={{ fontSize: type.body, color: color.alert, marginBottom: 8 }}>{overrideError}</div>}
                <button onClick={saveOverride} disabled={overrideSaving}
                  style={{ padding: '7px 16px', borderRadius: 6, border: 'none',
                    background: overrideSaved ? '#0D5E49' : color.forest, color: color.sage,
                    fontFamily: font.sans, fontSize: type.label, fontWeight: 500, cursor: overrideSaving ? 'not-allowed' : 'pointer' }}>
                  {overrideSaving ? 'Saving...' : overrideSaved ? 'Saved ✓' : override ? 'Update override' : 'Save override'}
                </button>
              </>
            )}
          </div>

          {/* Coach feedback — always shown */}
          <div style={{ background: color.void, borderRadius: 12, padding: 16 }}>
            <div style={{ ...S.label, color: color.forest, marginBottom: 8 }}>Coach feedback</div>
            <textarea value={feedback} onChange={e => setFeedback(e.target.value)}
              placeholder="Leave feedback for this client..." rows={5}
              style={{ width: '100%', background: color.surfaceDarkRaised, border: `1px solid ${color.borderDark}`, borderRadius: 8,
                color: color.textOnDark.primary, padding: '10px 12px', fontSize: type.body, fontFamily: font.sans,
                lineHeight: 1.6, resize: 'none', outline: 'none', boxSizing: 'border-box' }} />
            <button onClick={saveFeedback} disabled={saving}
              style={{ marginTop: 8, width: '100%', height: 44, background: saved ? '#0D5E49' : color.forest,
                border: 'none', borderRadius: 8, color: color.sage, fontSize: type.body, fontWeight: 500,
                cursor: 'pointer', fontFamily: font.sans }}>
              {saving ? 'Saving...' : saved ? 'Saved!' : 'Save feedback'}
            </button>
          </div>

        </div>
      </div>
    </div>
  )
}

// ─── Tab: Dashboard ───────────────────────────────────────────────────────────

// Rough estimate of how long a manual spreadsheet/DM-based review would take
// per check-in without Purema — not a measured value, just a reasonable
// assumption for the "time saved" framing. Named here so it's a one-line
// change if that assumption ever needs adjusting.
const MINUTES_SAVED_PER_REVIEW = 3

const TabDashboard = ({ checkins, clients, onSelectCheckin }) => {
  const attentionItems = useMemo(() => buildAttentionQueue(clients, checkins), [clients, checkins])
  const activeClients = clients.filter(c => !c.status || c.status === 'active')

  const weeklyRate = activeClients.length === 0 ? 0 : Math.round(
    (activeClients.filter(client =>
      checkins.some(c =>
        (c.client_id === client.id || c.client_name === client.full_name) &&
        (new Date() - new Date(c.submitted_at)) / (1000 * 60 * 60 * 24) <= 8
      )
    ).length / activeClients.length) * 100
  )

  // Only counts real reviews (feedback_at is set the moment a coach saves
  // feedback) on real submissions — backfilled history was never actually
  // reviewed by hand, so it shouldn't inflate this.
  const reviewedThisWeek = checkins.filter(c =>
    !c.imported_backfill && c.feedback_at &&
    (new Date() - new Date(c.feedback_at)) / (1000 * 60 * 60 * 24) <= 7
  ).length
  const minutesSaved = reviewedThisWeek * MINUTES_SAVED_PER_REVIEW

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
        {[
          { label: 'Active clients', value: activeClients.length, color: color.textOnDark.primary },
          { label: 'This week', value: `${weeklyRate}%`, color: weeklyRate >= 80 ? color.forest : weeklyRate >= 50 ? color.gold : activeClients.length === 0 ? color.textOnDark.secondary : color.alert },
          { label: 'Pending', value: checkins.filter(c => !c.coach_feedback).length, color: checkins.filter(c => !c.coach_feedback).length > 0 ? color.gold : color.textOnDark.secondary },
          { label: 'Needs attention', value: attentionItems.length, color: attentionItems.length > 0 ? color.alert : color.textOnDark.secondary },
        ].map(({ label, value, color: statColor }) => (
          <div key={label} style={{ background: color.void, borderRadius: 12, padding: '18px 20px' }}>
            <div style={{ fontSize: 28, fontWeight: 300, color: statColor, letterSpacing: '-0.02em' }}>{value}</div>
            <div style={{ ...S.label, color: color.textOnDark.label, marginTop: 6 }}>{label}</div>
          </div>
        ))}
      </div>

      {reviewedThisWeek > 0 && (
        <div style={{ fontSize: type.label, color: color.textOnLight.faint, fontFamily: font.mono }}>
          You reviewed {reviewedThisWeek} check-in{reviewedThisWeek === 1 ? '' : 's'} this week — that's roughly{' '}
          {minutesSaved} minute{minutesSaved === 1 ? '' : 's'} of manual review Purema handled for you.
        </div>
      )}

      {attentionItems.length > 0 ? (
        <div>
          <div style={S.sectionTitle}>Needs your attention — {attentionItems.length}</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {attentionItems.map((item, i) => (
              <AttentionCard key={i} item={item} onSelectCheckin={onSelectCheckin} />
            ))}
          </div>
        </div>
      ) : activeClients.length > 0 ? (
        <div style={{ ...S.card, display: 'flex', alignItems: 'center', gap: 14, background: color.sage, border: '0.5px solid #C5DFB0' }}>
          <div style={{ fontSize: 24 }}>✓</div>
          <div>
            <div style={{ fontSize: type.body, fontWeight: 500, color: '#0D3D1F' }}>All caught up</div>
            <div style={{ fontSize: type.label, color: '#3A7A4A', marginTop: 2 }}>No clients need your attention right now.</div>
          </div>
        </div>
      ) : (
        <div style={{ textAlign: 'center', padding: '60px 0' }}>
          <div style={{ fontSize: 36, marginBottom: 12 }}>📋</div>
          <div style={{ fontSize: type.bodyLg, fontWeight: 500, color: color.textOnLight.primary, marginBottom: 6 }}>No clients yet</div>
          <div style={{ fontSize: type.body, color: color.textOnLight.secondary }}>Head to the Clients tab to send your first invite.</div>
        </div>
      )}
    </div>
  )
}

// ─── Tab: Clients ─────────────────────────────────────────────────────────────

// Macro targets (calories/protein/carbs/fats) moved to the diet plan
// builder below — this panel now only covers the two fields that aren't
// part of a phased plan: a goal weight, and how many days before
// show_date the peak week window starts.
const TARGET_FIELDS = [
  { key: 'target_weight', label: 'Weight', unit: 'lbs' },
  { key: 'peak_week_days', label: 'Peak week', unit: 'days', integer: true },
]

const TargetsPanel = ({ client, onSave }) => {
  const [values, setValues] = useState(() =>
    Object.fromEntries(TARGET_FIELDS.map(f => [f.key, client[f.key] ?? '']))
  )
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState(null)

  const handleSave = async () => {
    setSaving(true)
    setError(null)
    const payload = Object.fromEntries(
      TARGET_FIELDS.map(f => [f.key, values[f.key] === '' ? null : (f.integer ? parseInt(values[f.key], 10) : parseFloat(values[f.key]))])
    )
    const result = await onSave(client.id, payload)
    setSaving(false)
    if (!result.ok) { setError(result.message); return }
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div style={{ marginTop: 10, paddingTop: 14, borderTop: '0.5px solid #F0F0F0' }}>
      <div style={{ ...S.label, marginBottom: 10 }}>Weight goal & peak week</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: 10, marginBottom: 12 }}>
        {TARGET_FIELDS.map(f => (
          <div key={f.key}>
            <label style={{ ...S.label, fontSize: type.label, marginBottom: 4 }}>{f.label} ({f.unit})</label>
            <input type="number" step={f.integer ? 1 : 0.1} min={f.integer ? 0 : undefined} placeholder="—" value={values[f.key]}
              onChange={e => setValues(v => ({ ...v, [f.key]: e.target.value }))}
              style={{ width: '100%', padding: '7px 10px', borderRadius: 6, border: `1px solid ${color.borderLight}`,
                fontFamily: font.sans, fontSize: type.body, outline: 'none', color: color.textOnLight.primary,
                boxSizing: 'border-box' }} />
          </div>
        ))}
      </div>
      {error && <div style={{ fontSize: type.body, color: color.alert, marginBottom: 10 }}>{error}</div>}
      <button onClick={handleSave} disabled={saving}
        style={{ padding: '7px 16px', borderRadius: 6, border: 'none',
          background: saved ? '#0D5E49' : color.forest, color: color.sage,
          fontFamily: font.sans, fontSize: type.label, fontWeight: 500,
          cursor: saving ? 'not-allowed' : 'pointer' }}>
        {saving ? 'Saving...' : saved ? 'Saved ✓' : 'Save targets'}
      </button>
    </div>
  )
}

// ─── Diet plan builder ────────────────────────────────────────────────────────
// A plan is a sequence of phases (start date + macro targets) — one phase
// for a flat target, several for something like a reverse diet that ramps
// calories up over weeks. The client's MacroBar reads whichever phase is
// active as of today (see getActivePhase in lib/dietPlan.js), so nothing
// here needs to "activate" a phase — it just takes effect on its start date.

const MACRO_PHASE_FIELDS = [
  { key: 'calories', label: 'Calories', unit: 'kcal' },
  { key: 'protein', label: 'Protein', unit: 'g' },
  { key: 'carbs', label: 'Carbs', unit: 'g' },
  { key: 'fats', label: 'Fats', unit: 'g' },
]

const emptyPhaseForm = () => ({ start_date: '', calories: '', protein: '', carbs: '', fats: '', note: '' })

const phaseValuesFromForm = (form) => ({
  calories: form.calories === '' ? null : parseFloat(form.calories),
  protein: form.protein === '' ? null : parseFloat(form.protein),
  carbs: form.carbs === '' ? null : parseFloat(form.carbs),
  fats: form.fats === '' ? null : parseFloat(form.fats),
})

const PhaseFieldsGrid = ({ values, onChange, includeDate }) => (
  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(100px, 1fr))', gap: 8, marginBottom: 8 }}>
    {includeDate && (
      <div>
        <label style={{ ...S.label, fontSize: type.label, marginBottom: 4 }}>Start date</label>
        <input type="date" value={values.start_date} onChange={e => onChange('start_date', e.target.value)}
          style={{ width: '100%', padding: '7px 10px', borderRadius: 6, border: `1px solid ${color.borderLight}`,
            fontFamily: font.sans, fontSize: type.body, boxSizing: 'border-box', color: color.textOnLight.primary }} />
      </div>
    )}
    {MACRO_PHASE_FIELDS.map(f => (
      <div key={f.key}>
        <label style={{ ...S.label, fontSize: type.label, marginBottom: 4 }}>{f.label}</label>
        <input type="number" step={0.1} placeholder="—" value={values[f.key]}
          onChange={e => onChange(f.key, e.target.value)}
          style={{ width: '100%', padding: '7px 10px', borderRadius: 6, border: `1px solid ${color.borderLight}`,
            fontFamily: font.sans, fontSize: type.body, boxSizing: 'border-box', color: color.textOnLight.primary }} />
      </div>
    ))}
  </div>
)

const DietPlanPanel = ({ client, coachId }) => {
  const [phases, setPhases] = useState(null)
  const [history, setHistory] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [form, setForm] = useState(emptyPhaseForm())
  const [adding, setAdding] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [editForm, setEditForm] = useState(emptyPhaseForm())
  const [editSaving, setEditSaving] = useState(false)

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      const [{ data: phaseRows }, { data: historyRows }] = await Promise.all([
        supabase.from('diet_plan_phases').select('*').eq('client_id', client.id).order('start_date', { ascending: true }),
        supabase.from('macro_adjustments').select('*').eq('client_id', client.id).order('created_at', { ascending: false }).limit(20),
      ])
      if (cancelled) return
      setPhases(phaseRows || [])
      setHistory(historyRows || [])
      setLoading(false)
    }
    load()
    return () => { cancelled = true }
  }, [client.id])

  const logAdjustment = async (phaseId, values, note) => {
    const { data } = await supabase.from('macro_adjustments').insert({
      client_id: client.id, coach_id: coachId, phase_id: phaseId,
      calories: values.calories, protein: values.protein, carbs: values.carbs, fats: values.fats,
      note: note || null,
    }).select().single()
    if (data) setHistory(prev => [data, ...prev])
  }

  const addPhase = async () => {
    if (!form.start_date) { setError('Pick a start date.'); return }
    setAdding(true)
    setError(null)

    // A client's plan is created lazily on its first phase — there's no
    // separate "create plan" step in the UI.
    let planId
    const { data: existingPlan } = await supabase.from('diet_plans').select('id').eq('client_id', client.id).maybeSingle()
    if (existingPlan) {
      planId = existingPlan.id
    } else {
      const { data: newPlan, error: planError } = await supabase.from('diet_plans')
        .insert({ client_id: client.id, coach_id: coachId }).select().single()
      if (planError || !newPlan) { setError(planError?.message || "Couldn't create plan."); setAdding(false); return }
      planId = newPlan.id
    }

    const values = phaseValuesFromForm(form)
    const { data: phase, error: phaseError } = await supabase.from('diet_plan_phases')
      .insert({ plan_id: planId, client_id: client.id, coach_id: coachId, start_date: form.start_date, ...values })
      .select().single()

    setAdding(false)
    if (phaseError || !phase) { setError(phaseError?.message || "Couldn't add phase."); return }

    setPhases(prev => [...(prev || []), phase].sort((a, b) => (a.start_date < b.start_date ? -1 : 1)))
    await logAdjustment(phase.id, values, form.note)
    setForm(emptyPhaseForm())
  }

  const startEdit = (phase) => {
    setEditingId(phase.id)
    setError(null)
    setEditForm({
      start_date: phase.start_date,
      calories: phase.calories ?? '', protein: phase.protein ?? '', carbs: phase.carbs ?? '', fats: phase.fats ?? '',
      note: '',
    })
  }

  const saveEdit = async (phaseId) => {
    setEditSaving(true)
    setError(null)
    const values = phaseValuesFromForm(editForm)
    const { data, error: updateError } = await supabase.from('diet_plan_phases')
      .update({ start_date: editForm.start_date, ...values })
      .eq('id', phaseId).select().single()
    setEditSaving(false)
    if (updateError || !data) { setError(updateError?.message || "Couldn't save phase."); return }
    setPhases(prev => prev.map(p => (p.id === phaseId ? data : p)).sort((a, b) => (a.start_date < b.start_date ? -1 : 1)))
    await logAdjustment(phaseId, values, editForm.note)
    setEditingId(null)
  }

  if (loading) {
    return (
      <div style={{ marginTop: 10, paddingTop: 14, borderTop: '0.5px solid #F0F0F0', fontSize: type.body, color: color.textOnLight.secondary }}>
        Loading plan...
      </div>
    )
  }

  const activePhase = getActivePhase(phases)

  return (
    <div style={{ marginTop: 10, paddingTop: 14, borderTop: '0.5px solid #F0F0F0' }}>
      <div style={{ ...S.label, marginBottom: 10 }}>Diet plan</div>

      {phases.length === 0 ? (
        <div style={{ fontSize: type.body, color: color.textOnLight.secondary, marginBottom: 12 }}>
          No phases yet — add one below to set this client's macro targets.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 14 }}>
          {phases.map(phase => (
            <div key={phase.id} style={{ background: phase.id === activePhase?.id ? color.sage : color.bone, borderRadius: 8, padding: 10 }}>
              {editingId === phase.id ? (
                <div>
                  <PhaseFieldsGrid values={editForm} includeDate onChange={(key, val) => setEditForm(v => ({ ...v, [key]: val }))} />
                  <input type="text" placeholder="Note (optional) — why this changed" value={editForm.note}
                    onChange={e => setEditForm(v => ({ ...v, note: e.target.value }))}
                    style={{ width: '100%', padding: '7px 10px', borderRadius: 6, border: `1px solid ${color.borderLight}`,
                      fontFamily: font.sans, fontSize: type.body, boxSizing: 'border-box', marginBottom: 8, color: color.textOnLight.primary }} />
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={() => saveEdit(phase.id)} disabled={editSaving}
                      style={{ padding: '6px 14px', borderRadius: 6, border: 'none', background: color.forest, color: color.sage,
                        fontFamily: font.sans, fontSize: type.label, fontWeight: 500, cursor: 'pointer' }}>
                      {editSaving ? 'Saving...' : 'Save'}
                    </button>
                    <button onClick={() => setEditingId(null)}
                      style={{ padding: '6px 14px', borderRadius: 6, border: `1px solid ${color.borderLight}`, background: 'transparent',
                        color: color.textOnLight.secondary, fontFamily: font.sans, fontSize: type.label, cursor: 'pointer' }}>
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
                  <div>
                    <div style={{ fontSize: type.body, fontWeight: 500, color: color.textOnLight.primary }}>
                      {new Date(`${phase.start_date}T00:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      {phase.id === activePhase?.id && (
                        <span style={{ marginLeft: 8, fontSize: type.label, color: color.forest, fontFamily: font.mono }}>ACTIVE</span>
                      )}
                    </div>
                    <div style={{ fontSize: type.label, color: color.textOnLight.secondary, marginTop: 2 }}>
                      {[
                        phase.calories != null && `${phase.calories} kcal`,
                        phase.protein != null && `${phase.protein}g protein`,
                        phase.carbs != null && `${phase.carbs}g carbs`,
                        phase.fats != null && `${phase.fats}g fats`,
                      ].filter(Boolean).join(' · ') || 'No macros set'}
                    </div>
                  </div>
                  <button onClick={() => startEdit(phase)}
                    style={{ fontSize: type.label, padding: '4px 10px', borderRadius: 6, border: `1px solid ${color.borderLight}`,
                      background: 'transparent', color: color.textOnLight.secondary, cursor: 'pointer', fontFamily: font.mono }}>
                    Edit
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <div style={{ background: color.bone, borderRadius: 8, padding: 12, marginBottom: 14 }}>
        <div style={{ ...S.label, fontSize: type.label, marginBottom: 8 }}>Add phase</div>
        <PhaseFieldsGrid values={form} includeDate onChange={(key, val) => setForm(v => ({ ...v, [key]: val }))} />
        <input type="text" placeholder="Note (optional) — why this phase" value={form.note}
          onChange={e => setForm(v => ({ ...v, note: e.target.value }))}
          style={{ width: '100%', padding: '7px 10px', borderRadius: 6, border: `1px solid ${color.borderLight}`,
            fontFamily: font.sans, fontSize: type.body, boxSizing: 'border-box', marginBottom: 8, color: color.textOnLight.primary }} />
        <button onClick={addPhase} disabled={adding}
          style={{ padding: '7px 16px', borderRadius: 6, border: 'none', background: color.forest, color: color.sage,
            fontFamily: font.sans, fontSize: type.label, fontWeight: 500, cursor: adding ? 'not-allowed' : 'pointer' }}>
          {adding ? 'Adding...' : 'Add phase'}
        </button>
      </div>

      {error && <div style={{ fontSize: type.body, color: color.alert, marginBottom: 10 }}>{error}</div>}

      {history.length > 0 && (
        <div>
          <div style={{ ...S.label, fontSize: type.label, marginBottom: 8 }}>Adjustment history</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 180, overflowY: 'auto' }}>
            {history.map(h => (
              <div key={h.id} style={{ fontSize: type.label, color: color.textOnLight.secondary }}>
                <span style={{ fontFamily: font.mono, color: color.textOnLight.faint }}>
                  {new Date(h.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                </span>{' '}
                {[
                  h.calories != null && `${h.calories} kcal`,
                  h.protein != null && `${h.protein}g P`,
                  h.carbs != null && `${h.carbs}g C`,
                  h.fats != null && `${h.fats}g F`,
                ].filter(Boolean).join(' · ')}
                {h.note && <span style={{ fontStyle: 'italic' }}> — {h.note}</span>}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

const TabClients = ({ clients, checkins, profile, onStatusChange, onTargetsSave, onGoToBilling, onImportCheckins }) => {
  const [expandedId, setExpandedId] = useState(null)
  const [expandedPlanId, setExpandedPlanId] = useState(null)
  const [importingClient, setImportingClient] = useState(null)
  const activeClients = clients.filter(c => !c.status || c.status === 'active')
  const limit = tierLimit(profile?.subscription_tier)
  const atLimit = activeClients.length >= limit
  const pausedClients = clients.filter(c => c.status === 'paused')
  const archivedClients = clients.filter(c => c.status === 'archived')

  const ClientRow = ({ client }) => {
    const [statusError, setStatusError] = useState(null)

    const changeStatus = async (newStatus) => {
      setStatusError(null)
      const result = await onStatusChange(client.id, newStatus)
      if (!result.ok) setStatusError(result.message)
    }

    return (
    <div style={S.card}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <div style={{ width: 40, height: 40, borderRadius: '50%',
          background: client.status === 'paused' ? '#F0EDE8' : client.status === 'archived' ? '#F0EDE8' : color.sage,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 14, fontWeight: 500,
          color: client.status === 'paused' ? color.textOnLight.secondary : client.status === 'archived' ? color.textOnLight.faint : color.forest,
          flexShrink: 0 }}>
          {(client.full_name || client.email || '?').charAt(0).toUpperCase()}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: type.body, fontWeight: 500, color: client.status === 'archived' ? color.textOnLight.faint : color.textOnLight.primary }}>
            {client.full_name || '—'}
          </div>
          <div style={{ fontSize: type.label, color: color.textOnLight.secondary, marginTop: 2 }}>
            {client.email} · Joined {new Date(client.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          {client.status !== 'archived' && (
            <button onClick={() => setExpandedId(expandedId === client.id ? null : client.id)}
              style={{ fontSize: type.label, padding: '4px 10px', borderRadius: 6, border: `1px solid ${color.borderLight}`,
                background: expandedId === client.id ? color.bone : 'transparent', color: color.textOnLight.secondary,
                cursor: 'pointer', fontFamily: font.mono }}>
              Targets
            </button>
          )}
          {client.status !== 'archived' && (
            <button onClick={() => setExpandedPlanId(expandedPlanId === client.id ? null : client.id)}
              style={{ fontSize: type.label, padding: '4px 10px', borderRadius: 6, border: `1px solid ${color.borderLight}`,
                background: expandedPlanId === client.id ? color.bone : 'transparent', color: color.textOnLight.secondary,
                cursor: 'pointer', fontFamily: font.mono }}>
              Diet plan
            </button>
          )}
          {client.status !== 'archived' && (
            <button onClick={() => setImportingClient(client)}
              style={{ fontSize: type.label, padding: '4px 10px', borderRadius: 6, border: `1px solid ${color.borderLight}`,
                background: 'transparent', color: color.textOnLight.secondary, cursor: 'pointer', fontFamily: font.mono }}>
              Import history
            </button>
          )}
          {(!client.status || client.status === 'active') && (
            <button onClick={() => changeStatus('paused')}
              style={{ fontSize: type.label, padding: '4px 10px', borderRadius: 6, border: `1px solid ${color.borderLight}`,
                background: 'transparent', color: color.textOnLight.secondary, cursor: 'pointer', fontFamily: font.mono }}>
              Pause
            </button>
          )}
          {client.status === 'paused' && (
            <>
              <button onClick={() => changeStatus('active')}
                style={{ fontSize: type.label, padding: '4px 10px', borderRadius: 6, border: `1px solid ${color.forest}`,
                  background: 'transparent', color: color.forest, cursor: 'pointer', fontFamily: font.mono }}>
                Reactivate
              </button>
              <button onClick={() => changeStatus('archived')}
                style={{ fontSize: type.label, padding: '4px 10px', borderRadius: 6, border: `1px solid ${color.alert}`,
                  background: 'transparent', color: color.alert, cursor: 'pointer', fontFamily: font.mono }}>
                Archive
              </button>
            </>
          )}
          {client.status !== 'archived' && (
            <span style={{ fontSize: type.label,
              background: client.status === 'paused' ? '#F0EDE8' : color.sage,
              color: client.status === 'paused' ? color.textOnLight.secondary : '#1A5C0A',
              padding: '3px 10px', borderRadius: 999, fontFamily: font.mono }}>
              {client.status === 'paused' ? 'Paused' : 'Active'}
            </span>
          )}
          {client.status === 'archived' && (
            <span style={{ fontSize: type.label, background: '#F0EDE8', color: color.textOnLight.faint,
              padding: '3px 10px', borderRadius: 999, fontFamily: font.mono }}>
              Archived
            </span>
          )}
        </div>
      </div>
      {statusError && (
        <div style={{ fontSize: type.body, color: color.alert, marginTop: 8 }}>{statusError}</div>
      )}
      {expandedId === client.id && (
        <TargetsPanel client={client} onSave={onTargetsSave} />
      )}
      {expandedPlanId === client.id && (
        <DietPlanPanel client={client} coachId={profile?.id} />
      )}
    </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div style={S.card}>
        <InviteClient atLimit={atLimit} onUpgradeClick={onGoToBilling} />
      </div>

      {activeClients.length > 0 && (
        <div>
          <div style={S.sectionTitle}>Active — {activeClients.length}</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {activeClients.map(c => <ClientRow key={c.id} client={c} />)}
          </div>
        </div>
      )}

      {pausedClients.length > 0 && (
        <div>
          <div style={S.sectionTitle}>Paused — {pausedClients.length}</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {pausedClients.map(c => <ClientRow key={c.id} client={c} />)}
          </div>
        </div>
      )}

      {archivedClients.length > 0 && (
        <div>
          <div style={S.sectionTitle}>Archived — {archivedClients.length}</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {archivedClients.map(c => <ClientRow key={c.id} client={c} />)}
          </div>
        </div>
      )}

      {clients.length === 0 && (
        <div style={{ ...S.card, textAlign: 'center', padding: '40px 20px', color: color.textOnLight.secondary, fontSize: type.body }}>
          No clients yet. Invite one above to get started.
        </div>
      )}

      {importingClient && (
        <ImportHistory
          client={importingClient}
          coachId={profile?.id}
          existingCheckins={checkins.filter(c => c.client_id === importingClient.id)}
          onClose={() => setImportingClient(null)}
          onImported={(newRows) => onImportCheckins(newRows)}
        />
      )}
    </div>
  )
}

// ─── Tab: Check-ins ───────────────────────────────────────────────────────────

const TabCheckIns = ({ checkins, onSelectCheckin }) => {
  const [filter, setFilter] = useState('all')
  const formatDate = ts => new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  const filtered = checkins.filter(c => {
    if (filter === 'pending') return !c.coach_feedback
    if (filter === 'reviewed') return !!c.coach_feedback
    return true
  })

  const FilterBtn = ({ value, label, count }) => (
    <button onClick={() => setFilter(value)}
      style={{ padding: '6px 14px', borderRadius: 6, border: 'none', cursor: 'pointer',
        fontFamily: font.mono, fontSize: type.label, letterSpacing: '0.06em',
        background: filter === value ? color.void : 'transparent',
        color: filter === value ? color.textOnDark.primary : color.textOnLight.secondary }}>
      {label}{count > 0 ? ` · ${count}` : ''}
    </button>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', gap: 4, background: '#F0EDE8', borderRadius: 8, padding: 4, alignSelf: 'flex-start' }}>
        <FilterBtn value="all" label="ALL" count={checkins.length} />
        <FilterBtn value="pending" label="PENDING" count={checkins.filter(c => !c.coach_feedback).length} />
        <FilterBtn value="reviewed" label="REVIEWED" count={checkins.filter(c => c.coach_feedback).length} />
      </div>
      {filtered.length === 0 ? (
        <div style={{ ...S.card, textAlign: 'center', padding: '40px 20px', color: color.textOnLight.secondary, fontSize: type.body }}>
          No check-ins in this view.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {filtered.map(checkin => {
            const isPending = !checkin.coach_feedback
            return (
              <div key={checkin.id} onClick={() => onSelectCheckin(checkin)}
                style={{ ...S.card, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 14, opacity: isPending ? 1 : 0.7 }}
                onMouseEnter={e => { e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.08)'; e.currentTarget.style.opacity = '1' }}
                onMouseLeave={e => { e.currentTarget.style.boxShadow = 'none'; e.currentTarget.style.opacity = isPending ? '1' : '0.7' }}>
                <div style={{ width: 40, height: 40, borderRadius: '50%',
                  background: isPending ? '#FAEEDA' : color.sage,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 14, fontWeight: 500, color: isPending ? color.gold : color.forest, flexShrink: 0 }}>
                  {checkin.client_name.charAt(0).toUpperCase()}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: type.body, fontWeight: 500, color: color.textOnLight.primary }}>{checkin.client_name}</div>
                  <div style={{ fontSize: type.label, color: color.textOnLight.secondary, marginTop: 2, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span>
                      Week {checkin.week_number} · {formatDate(checkin.submitted_at)}
                      {checkin.weight ? ' · ' + checkin.weight + ' lbs' : ''}
                    </span>
                    {checkin.imported_backfill && <ImportedTag />}
                  </div>
                </div>
                <span style={{ fontSize: type.label, background: isPending ? '#FAEEDA' : color.sage,
                  color: isPending ? '#633806' : '#1A5C0A',
                  padding: '3px 10px', borderRadius: 999, fontFamily: font.mono, fontWeight: 500 }}>
                  {isPending ? 'Pending' : 'Done'}
                </span>
                <span style={{ color: color.textOnLight.faint, fontSize: 18 }}>›</span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ─── Tab: Overview ────────────────────────────────────────────────────────────

const TabOverview = ({ clients, checkins, profile }) => {
  const activeClients = clients.filter(c => !c.status || c.status === 'active')
  const pausedClients = clients.filter(c => c.status === 'paused')
  const archivedClients = clients.filter(c => c.status === 'archived')
  const totalCheckins = checkins.length
  const reviewedCheckins = checkins.filter(c => c.coach_feedback).length
  const responseRate = totalCheckins === 0 ? 0 : Math.round((reviewedCheckins / totalCheckins) * 100)

  const weeklyRate = activeClients.length === 0 ? 0 : Math.round(
    (activeClients.filter(client =>
      checkins.some(c =>
        (c.client_id === client.id || c.client_name === client.full_name) &&
        (new Date() - new Date(c.submitted_at)) / (1000 * 60 * 60 * 24) <= 8
      )
    ).length / activeClients.length) * 100
  )

  const StatCard = ({ label, value, sub, color: accentColor = color.textOnDark.primary }) => (
    <div style={{ background: color.void, borderRadius: 12, padding: '18px 20px' }}>
      <div style={{ fontSize: 28, fontWeight: 300, color: accentColor, letterSpacing: '-0.02em' }}>{value}</div>
      <div style={{ ...S.label, color: color.textOnDark.label, marginTop: 6 }}>{label}</div>
      {sub && <div style={{ fontSize: type.label, color: color.textOnDark.faint, marginTop: 4 }}>{sub}</div>}
    </div>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>

      {/* Business stats */}
      <div>
        <div style={S.sectionTitle}>Business</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
          <StatCard label="Active clients" value={activeClients.length} color={color.textOnDark.primary} />
          <StatCard label="Paused" value={pausedClients.length} color={pausedClients.length > 0 ? color.gold : color.textOnDark.secondary} />
          <StatCard label="Archived" value={archivedClients.length} color={color.textOnDark.secondary} />
        </div>
      </div>

      {/* Revenue — stubbed for Stripe */}
      <div>
        <div style={S.sectionTitle}>Revenue</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
          <div style={{ background: color.void, borderRadius: 12, padding: '18px 20px' }}>
            <div style={{ fontSize: 28, fontWeight: 300, color: color.textOnDark.secondary, letterSpacing: '-0.02em' }}>—</div>
            <div style={{ ...S.label, color: color.textOnDark.label, marginTop: 6 }}>MRR</div>
            <div style={{ fontSize: type.label, color: color.textOnDark.faint, marginTop: 4 }}>Connect Stripe to unlock</div>
          </div>
          <div style={{ background: color.void, borderRadius: 12, padding: '18px 20px' }}>
            <div style={{ fontSize: 28, fontWeight: 300, color: color.textOnDark.secondary, letterSpacing: '-0.02em' }}>—</div>
            <div style={{ ...S.label, color: color.textOnDark.label, marginTop: 6 }}>Avg. per client</div>
            <div style={{ fontSize: type.label, color: color.textOnDark.faint, marginTop: 4 }}>Connect Stripe to unlock</div>
          </div>
          <div style={{ background: color.void, borderRadius: 12, padding: '18px 20px' }}>
            <div style={{ fontSize: 28, fontWeight: 300, color: color.textOnDark.secondary, letterSpacing: '-0.02em' }}>—</div>
            <div style={{ ...S.label, color: color.textOnDark.label, marginTop: 6 }}>Churn this month</div>
            <div style={{ fontSize: type.label, color: color.textOnDark.faint, marginTop: 4 }}>Connect Stripe to unlock</div>
          </div>
        </div>
      </div>

      {/* Engagement */}
      <div>
        <div style={S.sectionTitle}>Engagement</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
          <StatCard label="Weekly check-in rate" value={`${weeklyRate}%`}
            color={weeklyRate >= 80 ? color.forest : weeklyRate >= 50 ? color.gold : activeClients.length === 0 ? color.textOnDark.secondary : color.alert} />
          <StatCard label="Feedback response rate" value={`${responseRate}%`}
            color={responseRate >= 80 ? color.forest : responseRate >= 50 ? color.gold : totalCheckins === 0 ? color.textOnDark.secondary : color.alert} />
          <StatCard label="Total check-ins" value={totalCheckins} color={color.textOnDark.primary} />
        </div>
      </div>

      {/* Capacity */}
      <div>
        <div style={S.sectionTitle}>Capacity</div>
        <div style={{ ...S.card }}>
          {(() => {
            const plan = planById(profile?.subscription_tier)
            const limit = tierLimit(profile?.subscription_tier)
            const unlimited = limit === Infinity
            const atLimit = !unlimited && activeClients.length >= limit
            return (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <div style={{ fontSize: type.body, fontWeight: 500, color: color.textOnLight.primary }}>Client slots</div>
                  <span style={{ fontSize: type.label, background: color.sage, color: '#1A5C0A',
                    padding: '3px 10px', borderRadius: 999, fontFamily: font.mono }}>
                    {plan ? `${plan.label} plan` : 'No plan'} · {unlimited ? 'Unlimited' : `${limit} max`}
                  </span>
                </div>
                {!unlimited && (
                  <div style={{ background: '#F0EDE8', borderRadius: 999, height: 6, overflow: 'hidden' }}>
                    <div style={{ height: '100%', borderRadius: 999, background: color.forest,
                      width: `${Math.min((activeClients.length / (limit || 1)) * 100, 100)}%`,
                      transition: 'width 0.3s ease' }} />
                  </div>
                )}
                <div style={{ fontSize: type.label, color: color.textOnLight.secondary, marginTop: 8 }}>
                  {unlimited
                    ? `${activeClients.length} clients — unlimited plan`
                    : `${activeClients.length} of ${limit} slots used`}
                  {atLimit && (
                    <span style={{ color: color.alert, marginLeft: 8 }}>· Upgrade to add more clients</span>
                  )}
                </div>
              </>
            )
          })()}
        </div>
      </div>

    </div>
  )
}

// ─── Tab: Billing ─────────────────────────────────────────────────────────────

const TabBilling = ({ profile, onProfileRefresh }) => {
  const [loadingTier, setLoadingTier] = useState(null)
  const [portalLoading, setPortalLoading] = useState(false)
  const [error, setError] = useState(null)

  const currentPlan = planById(profile?.subscription_tier)
  const subscribed = isSubscribed(profile)

  const handleSubscribe = async (tier) => {
    setError(null)
    setLoadingTier(tier)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      const res = await fetch('/api/create-checkout-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tier, userId: user.id, email: user.email }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Could not start checkout')
      window.location.href = data.url
    } catch (err) {
      setError(err.message)
      setLoadingTier(null)
    }
  }

  const handleManage = async () => {
    setError(null)
    setPortalLoading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      const res = await fetch('/api/create-portal-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Could not open the billing portal')
      window.location.href = data.url
    } catch (err) {
      setError(err.message)
      setPortalLoading(false)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div>
        <div style={S.sectionTitle}>Billing</div>
        <div style={{ fontSize: type.body, color: color.textOnLight.secondary }}>
          {subscribed
            ? 'Manage your subscription or switch plans.'
            : 'Subscribe to start inviting clients.'}
        </div>
      </div>

      {subscribed && currentPlan && (
        <div style={{ background: color.void, borderRadius: 12, padding: 20,
          display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <div style={{ ...labelStyle(true), color: color.forest }}>Current plan</div>
            <div style={{ fontSize: 22, fontWeight: 300, color: color.textOnDark.primary }}>
              {currentPlan.label} · ${currentPlan.price}/mo
            </div>
            <div style={{ fontSize: type.label, color: color.textOnDark.faint, marginTop: 2 }}>
              {currentPlan.limit === Infinity ? 'Unlimited clients' : `${currentPlan.limit} client max`}
            </div>
          </div>
          <button onClick={handleManage} disabled={portalLoading}
            style={{ padding: '10px 18px', borderRadius: 8, border: `1px solid ${color.borderDark}`,
              background: 'transparent', color: color.textOnDark.primary, fontFamily: font.sans,
              fontSize: type.body, fontWeight: 500, cursor: portalLoading ? 'not-allowed' : 'pointer' }}>
            {portalLoading ? 'Opening...' : 'Manage subscription'}
          </button>
        </div>
      )}

      {error && <div style={{ fontSize: type.body, color: color.alert }}>{error}</div>}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
        {PLANS.map(plan => {
          const isCurrent = profile?.subscription_tier === plan.id && subscribed
          return (
            <div key={plan.id} style={{ ...S.card,
              border: isCurrent ? `1.5px solid ${color.forest}` : `0.5px solid ${color.borderLight}` }}>
              <div style={S.label}>{plan.label}</div>
              <div style={{ fontSize: 28, fontWeight: 300, color: color.textOnLight.primary, marginTop: 6 }}>
                ${plan.price}<span style={{ fontSize: 13, color: color.textOnLight.secondary }}>/mo</span>
              </div>
              <div style={{ fontSize: type.body, color: color.textOnLight.secondary, marginTop: 6, marginBottom: 16 }}>
                {plan.limit === Infinity ? 'Unlimited clients' : `Up to ${plan.limit} clients`}
              </div>
              <button onClick={() => handleSubscribe(plan.id)} disabled={loadingTier === plan.id || isCurrent}
                style={{ width: '100%', padding: '10px 0', borderRadius: 8, border: 'none',
                  background: isCurrent ? color.bone : color.forest,
                  color: isCurrent ? color.textOnLight.faint : color.sage,
                  fontFamily: font.sans, fontSize: type.body, fontWeight: 500,
                  cursor: isCurrent ? 'default' : loadingTier === plan.id ? 'not-allowed' : 'pointer' }}>
                {isCurrent ? 'Current plan' : loadingTier === plan.id ? 'Redirecting...' : 'Subscribe'}
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Tab: Calendar ────────────────────────────────────────────────────────────

const CALENDAR_COLORS = { checkin: color.forest, peak: color.alert, show: color.gold }
const CALENDAR_LABELS = { checkin: 'Check-in', peak: 'Peak week', show: 'Show day' }
const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

// Local Y-M-D key — avoids the day-shifting that toISOString() causes by
// converting to UTC first, which matters since these are calendar dates,
// not instants.
function ymd(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function buildCalendarEvents(clients, checkins) {
  const events = {}
  const add = (dateKey, name, type) => {
    if (!events[dateKey]) events[dateKey] = []
    events[dateKey].push({ name, type })
  }

  clients.forEach(client => {
    if (!client.show_date) return
    const show = new Date(`${client.show_date}T00:00:00`)
    add(ymd(show), client.full_name || client.email, 'show')
    const peakDays = client.peak_week_days || 0
    for (let i = 1; i <= peakDays; i++) {
      const d = new Date(show)
      d.setDate(d.getDate() - i)
      add(ymd(d), client.full_name || client.email, 'peak')
    }
  })

  checkins.forEach(c => {
    if (!c.submitted_at) return
    add(ymd(new Date(c.submitted_at)), c.client_name, 'checkin')
  })

  return events
}

// Flattens the dateKey->events map into a single chronological list from
// today onward, since events aren't naturally ordered across dateKeys.
function buildUpcomingEvents(events, todayKey, limit) {
  return Object.entries(events)
    .filter(([dateKey]) => dateKey >= todayKey)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .flatMap(([dateKey, dayEvents]) => dayEvents.map(e => ({ ...e, dateKey })))
    .slice(0, limit)
}

function buildMonthWeeks(year, month) {
  const firstDay = new Date(year, month, 1)
  const startWeekday = firstDay.getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const cells = []
  for (let i = 0; i < startWeekday; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d))
  while (cells.length % 7 !== 0) cells.push(null)
  const weeks = []
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7))
  return weeks
}

const TabCalendar = ({ clients, checkins }) => {
  const [viewDate, setViewDate] = useState(() => new Date())
  const [selectedDay, setSelectedDay] = useState(null)

  const events = useMemo(() => buildCalendarEvents(clients, checkins), [clients, checkins])
  const year = viewDate.getFullYear()
  const month = viewDate.getMonth()
  const weeks = useMemo(() => buildMonthWeeks(year, month), [year, month])

  const todayKey = ymd(new Date())
  const monthLabel = viewDate.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
  const upcoming = useMemo(() => buildUpcomingEvents(events, todayKey, 8), [events, todayKey])

  const changeMonth = (delta) => {
    setSelectedDay(null)
    setViewDate(new Date(year, month + delta, 1))
  }

  const selectedEvents = selectedDay ? (events[selectedDay] || []) : []

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* Header: month nav + legend */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button onClick={() => changeMonth(-1)} type="button"
            style={{ width: 32, height: 32, borderRadius: 8, border: `1px solid ${color.borderLight}`,
              background: color.surfaceLight, cursor: 'pointer', fontSize: 16, color: color.textOnLight.primary }}>‹</button>
          <div style={{ fontSize: type.bodyLg, fontWeight: 500, color: color.textOnLight.primary, minWidth: 160, textAlign: 'center' }}>
            {monthLabel}
          </div>
          <button onClick={() => changeMonth(1)} type="button"
            style={{ width: 32, height: 32, borderRadius: 8, border: `1px solid ${color.borderLight}`,
              background: color.surfaceLight, cursor: 'pointer', fontSize: 16, color: color.textOnLight.primary }}>›</button>
        </div>
        <div style={{ display: 'flex', gap: 16 }}>
          {Object.entries(CALENDAR_LABELS).map(([key, label]) => (
            <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: CALENDAR_COLORS[key] }} />
              <span style={{ fontSize: type.label, color: color.textOnLight.secondary }}>{label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Weekday header */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 6 }}>
        {WEEKDAY_LABELS.map(d => (
          <div key={d} style={{ textAlign: 'center', fontSize: type.label, color: color.textOnLight.faint, fontFamily: font.mono }}>{d}</div>
        ))}
      </div>

      {/* Month grid */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {weeks.map((week, wi) => (
          <div key={wi} style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 6 }}>
            {week.map((day, di) => {
              if (!day) return <div key={di} />
              const dayKey = ymd(day)
              const dayEvents = events[dayKey] || []
              const types = [...new Set(dayEvents.map(e => e.type))]
              const isToday = dayKey === todayKey
              const isSelected = dayKey === selectedDay
              return (
                <button key={di} type="button" onClick={() => setSelectedDay(isSelected ? null : dayKey)}
                  style={{ aspectRatio: '1', borderRadius: 8,
                    border: isSelected ? `1.5px solid ${color.forest}` : isToday ? `1px solid ${color.borderDark}` : `0.5px solid ${color.borderLight}`,
                    background: isToday ? color.bone : color.surfaceLight, cursor: 'pointer',
                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 3, padding: 4 }}>
                  <span style={{ fontSize: type.label, color: color.textOnLight.primary, fontWeight: isToday ? 600 : 400 }}>{day.getDate()}</span>
                  {types.length > 0 && (
                    <div style={{ display: 'flex', gap: 3 }}>
                      {types.map(t => (
                        <div key={t} style={{ width: 5, height: 5, borderRadius: '50%', background: CALENDAR_COLORS[t] }} />
                      ))}
                    </div>
                  )}
                </button>
              )
            })}
          </div>
        ))}
      </div>

      {/* Selected day detail */}
      {selectedDay && (
        <div style={S.card}>
          <div style={{ ...S.label, marginBottom: 10 }}>
            {new Date(`${selectedDay}T00:00:00`).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
          </div>
          {selectedEvents.length === 0 ? (
            <div style={{ fontSize: type.body, color: color.textOnLight.secondary }}>No events on this day.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {selectedEvents.map((e, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: CALENDAR_COLORS[e.type], flexShrink: 0 }} />
                  <span style={{ fontSize: type.body, color: color.textOnLight.primary }}>{e.name}</span>
                  <span style={{ fontSize: type.label, color: color.textOnLight.secondary }}>· {CALENDAR_LABELS[e.type]}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Upcoming events */}
      <div style={S.card}>
        <div style={{ ...S.label, marginBottom: 10 }}>Upcoming</div>
        {upcoming.length === 0 ? (
          <div style={{ fontSize: type.body, color: color.textOnLight.secondary }}>No upcoming events.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {upcoming.map((e, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: CALENDAR_COLORS[e.type], flexShrink: 0 }} />
                <span style={{ fontSize: type.label, color: color.textOnLight.faint, fontFamily: font.mono, minWidth: 80 }}>
                  {new Date(`${e.dateKey}T00:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                </span>
                <span style={{ fontSize: type.body, color: color.textOnLight.primary }}>{e.name}</span>
                <span style={{ fontSize: type.label, color: color.textOnLight.secondary }}>· {CALENDAR_LABELS[e.type]}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Tab: Messages (placeholder) ─────────────────────────────────────────────

const TabMessages = ({ clients, messages, coachId, onSendMessage, onMarkRead }) => {
  const activeClients = clients.filter(c => !c.status || c.status === 'active')
  const [selectedClientId, setSelectedClientId] = useState(null)

  const threads = useMemo(() => {
    const built = activeClients.map(client => {
      const clientMessages = messages.filter(m => m.client_id === client.id)
      const lastMessage = clientMessages[clientMessages.length - 1] || null
      const unreadCount = clientMessages.filter(m => m.sender_id === client.id && !m.read_at).length
      return { client, messages: clientMessages, lastMessage, unreadCount }
    })
    // Unread threads surface first (sorted by recency among themselves),
    // then everything else by recency.
    return built.sort((a, b) => {
      const aUnread = a.unreadCount > 0 ? 1 : 0
      const bUnread = b.unreadCount > 0 ? 1 : 0
      if (aUnread !== bUnread) return bUnread - aUnread
      const at = a.lastMessage ? new Date(a.lastMessage.created_at).getTime() : 0
      const bt = b.lastMessage ? new Date(b.lastMessage.created_at).getTime() : 0
      return bt - at
    })
  }, [activeClients, messages])

  const selectedThread = threads.find(t => t.client.id === selectedClientId) || null

  // Marks the open thread read both on first selecting it and whenever a
  // new message arrives in it while it's still open.
  useEffect(() => {
    if (!selectedClientId) return
    const thread = threads.find(t => t.client.id === selectedClientId)
    if (thread && thread.unreadCount > 0) onMarkRead(selectedClientId)
  }, [selectedClientId, threads, onMarkRead])

  if (activeClients.length === 0) {
    return (
      <div style={{ ...S.card, textAlign: 'center', padding: '60px 20px' }}>
        <div style={{ fontSize: 32, marginBottom: 12 }}>💬</div>
        <div style={{ fontSize: type.bodyLg, fontWeight: 500, color: color.textOnLight.primary, marginBottom: 6 }}>No clients yet</div>
        <div style={{ fontSize: type.body, color: color.textOnLight.secondary }}>Invite a client to start messaging.</div>
      </div>
    )
  }

  return (
    <div className="purema-messages-grid" data-pane={selectedClientId ? 'thread' : 'list'}
      style={{ height: 'calc(100vh - 180px)', minHeight: 420 }}>
      <div className="purema-messages-list" style={{ overflowY: 'auto' }}>
        {threads.map(({ client, lastMessage, unreadCount }) => (
          <button key={client.id} onClick={() => setSelectedClientId(client.id)}
            style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', borderRadius: 10,
              border: `0.5px solid ${color.borderLight}`, textAlign: 'left', cursor: 'pointer',
              background: selectedClientId === client.id ? color.bone : color.surfaceLight }}>
            <div style={{ width: 36, height: 36, borderRadius: '50%', background: color.sage,
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 500,
              color: color.forest, flexShrink: 0 }}>
              {(client.full_name || client.email || '?').charAt(0).toUpperCase()}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
                <span style={{ fontSize: type.body, fontWeight: 500, color: color.textOnLight.primary,
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {client.full_name || client.email}
                </span>
                {unreadCount > 0 && (
                  <span style={{ background: color.forest, color: color.sage, fontSize: type.label,
                    borderRadius: 999, padding: '1px 7px', fontFamily: font.mono, flexShrink: 0 }}>
                    {unreadCount}
                  </span>
                )}
              </div>
              <div style={{ fontSize: type.label, color: color.textOnLight.faint, marginTop: 2,
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {lastMessage ? lastMessage.body : 'No messages yet'}
              </div>
            </div>
          </button>
        ))}
      </div>

      <div className="purema-messages-thread" style={{ minHeight: 0 }}>
        {selectedThread ? (
          <MessageThread
            title={selectedThread.client.full_name || selectedThread.client.email}
            headerLeft={
              <button onClick={() => setSelectedClientId(null)} className="purema-messages-back"
                style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontSize: 18,
                  color: color.textOnLight.secondary, padding: 0, alignItems: 'center' }}>
                ‹
              </button>
            }
            messages={selectedThread.messages}
            currentUserId={coachId}
            onSend={(body) => onSendMessage(selectedThread.client.id, body)}
          />
        ) : (
          <div style={{ ...S.card, height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: color.textOnLight.faint, fontSize: type.body }}>
            Select a client to view messages
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Tab definitions ──────────────────────────────────────────────────────────

const TABS = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'clients', label: 'Clients' },
  { id: 'checkins', label: 'Check-ins' },
  { id: 'calendar', label: 'Calendar' },
  { id: 'messages', label: 'Messages' },
  { id: 'overview', label: 'Overview' },
  { id: 'billing', label: 'Billing' },
  { id: 'settings', label: 'Settings' },
]

// Preferences storage only — same as the client-side notification toggles
// in ClientSettings.js. No push/email delivery infrastructure exists yet;
// this just persists the coach's choice on their own profile row.
const Toggle = ({ value, onChange, disabled }) => (
  <div onClick={() => !disabled && onChange(!value)}
    style={{ width: 44, height: 24, borderRadius: 999,
      background: value ? color.forest : color.borderLight, cursor: disabled ? 'default' : 'pointer',
      opacity: disabled ? 0.6 : 1,
      position: 'relative', transition: 'background 0.2s ease', flexShrink: 0 }}>
    <div style={{ position: 'absolute', top: 3, left: value ? 23 : 3,
      width: 18, height: 18, borderRadius: '50%', background: color.surfaceLight,
      transition: 'left 0.2s ease', boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }} />
  </div>
)

const TabSettings = ({ profile, onToggleNotify }) => {
  const [savingKey, setSavingKey] = useState(null)

  const handleToggle = async (key, value) => {
    setSavingKey(key)
    await onToggleNotify(key, value)
    setSavingKey(null)
  }

  return (
    <div style={{ maxWidth: 480 }}>
      <div style={S.sectionTitle}>Notifications</div>
      <div style={{ fontSize: type.body, color: color.textOnLight.secondary, marginBottom: 16 }}>
        Choose what you want to be notified about. (Delivery — push, email, or WhatsApp — isn't built yet; this just saves your preference.)
      </div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '16px 0', borderBottom: '0.5px solid #F5F5F5' }}>
        <div>
          <div style={{ fontSize: type.body, color: color.textOnLight.primary }}>New message</div>
          <div style={{ fontSize: type.label, color: color.textOnLight.secondary, marginTop: 2 }}>
            When a client sends you a message
          </div>
        </div>
        <Toggle value={!!profile?.notify_new_message} onChange={(v) => handleToggle('notify_new_message', v)}
          disabled={savingKey === 'notify_new_message'} />
      </div>
    </div>
  )
}

// ─── Main shell ───────────────────────────────────────────────────────────────

export default function CoachDashboard() {
  const [activeTab, setActiveTab] = useState('dashboard')
  const [checkins, setCheckins] = useState([])
  const [clients, setClients] = useState([])
  const [profile, setProfile] = useState(null)
  const [messages, setMessages] = useState([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState(null)
  const [portalLoading, setPortalLoading] = useState(false)
  const [portalError, setPortalError] = useState(null)

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      fetchAll(user.id)
      // Stripe Checkout redirects back with ?checkout=success — the webhook
      // that actually flips subscription_status may land a beat after this
      // page load, so give it a couple retries before settling.
      if (new URLSearchParams(window.location.search).get('checkout') === 'success') {
        let attempt = 0
        const poll = setInterval(() => {
          attempt += 1
          refreshProfile(user.id)
          if (attempt >= 5) clearInterval(poll)
        }, 1500)
      }
    })
  }, [])

  const refreshProfile = async (id) => {
    const { data } = await supabase.from('profiles').select('*').eq('id', id).single()
    if (data) setProfile(data)
  }

  // Shared by the past-due banner and the suspended read-only screen — both
  // just need to get the coach into Stripe's own billing portal to fix
  // their card themselves.
  const openBillingPortal = async () => {
    setPortalError(null)
    setPortalLoading(true)
    try {
      const res = await fetch('/api/create-portal-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: profile?.id }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Could not open the billing portal')
      window.location.href = data.url
    } catch (err) {
      setPortalError(err.message)
      setPortalLoading(false)
    }
  }

  const fetchAll = async (id) => {
    const [checkinsRes, clientsRes, profileRes, messagesRes] = await Promise.all([
      supabase.from('check_ins').select('*').eq('coach_id', id).order('submitted_at', { ascending: false }),
      supabase.from('profiles').select('*').eq('coach_id', id),
      supabase.from('profiles').select('*').eq('id', id).single(),
      supabase.from('messages').select('*').eq('coach_id', id).order('created_at', { ascending: true }),
    ])
    if (!checkinsRes.error) setCheckins(checkinsRes.data || [])
    if (!clientsRes.error) setClients(clientsRes.data || [])
    if (!profileRes.error) setProfile(profileRes.data)
    if (!messagesRes.error) setMessages(messagesRes.data || [])
    setLoading(false)
  }

  // Lifted to the top level (not fetched lazily inside the Messages tab) so
  // the unread badge on the nav item stays correct even while viewing a
  // different tab — same reasoning as checkins/clients already living here.
  useEffect(() => {
    if (!profile?.id) return
    const channel = supabase
      .channel(`messages-coach-${profile.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `coach_id=eq.${profile.id}` }, payload => {
        setMessages(prev => (prev.some(m => m.id === payload.new.id) ? prev : [...prev, payload.new]))
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'messages', filter: `coach_id=eq.${profile.id}` }, payload => {
        setMessages(prev => prev.map(m => (m.id === payload.new.id ? payload.new : m)))
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [profile?.id])

  const handleSendMessage = async (clientId, body) => {
    const { error } = await supabase.from('messages').insert({
      coach_id: profile.id, client_id: clientId, sender_id: profile.id, body,
    })
    if (error) return { ok: false, message: error.message }
    return { ok: true }
  }

  const handleMarkMessagesRead = async (clientId) => {
    const nowIso = new Date().toISOString()
    const { data, error } = await supabase
      .from('messages')
      .update({ read_at: nowIso })
      .eq('coach_id', profile.id).eq('client_id', clientId).eq('sender_id', clientId).is('read_at', null)
      .select()
    if (!error && data?.length) {
      setMessages(prev => prev.map(m => data.find(d => d.id === m.id) || m))
    }
  }

  const handleToggleNotify = async (key, value) => {
    const { data, error } = await supabase
      .from('profiles').update({ [key]: value }).eq('id', profile.id).select().single()
    if (!error && data) setProfile(data)
  }

  const unreadMessageCount = useMemo(
    () => messages.filter(m => m.sender_id !== profile?.id && !m.read_at).length,
    [messages, profile?.id]
  )

  const handleFeedbackSave = (id, feedback, feedbackAt) => {
    setCheckins(prev => prev.map(c => c.id === id ? { ...c, coach_feedback: feedback, feedback_at: feedbackAt } : c))
  }

  // .select().single() forces a real row back — if RLS silently filters the
  // write (0 rows matched), this errors instead of the update() call
  // succeeding with an empty result that looks like a no-op success.
  const handleStatusChange = async (clientId, newStatus) => {
    const { data, error } = await supabase
      .from('profiles')
      .update({ status: newStatus })
      .eq('id', clientId)
      .select()
      .single()
    if (error || !data) {
      return { ok: false, message: error?.message || "Update didn't apply — check permissions." }
    }
    setClients(prev => prev.map(c => c.id === clientId ? { ...c, status: newStatus } : c))
    return { ok: true }
  }

  const handleTargetsSave = async (clientId, targets) => {
    const { data, error } = await supabase
      .from('profiles')
      .update(targets)
      .eq('id', clientId)
      .select()
      .single()
    if (error || !data) {
      return { ok: false, message: error?.message || "Update didn't apply — check permissions." }
    }
    setClients(prev => prev.map(c => c.id === clientId ? { ...c, ...targets } : c))
    return { ok: true }
  }

  const handleImportCheckins = (newRows) => {
    setCheckins(prev => [...prev, ...newRows].sort((a, b) => new Date(b.submitted_at) - new Date(a.submitted_at)))
  }

  const pendingCount = checkins.filter(c => !c.coach_feedback).length
  const attentionCount = useMemo(() => buildAttentionQueue(clients, checkins).length, [clients, checkins])

  const NavList = ({ vertical }) => (
    <nav style={{ display: 'flex', flexDirection: vertical ? 'column' : 'row', gap: vertical ? 4 : 0 }}>
      {TABS.map(tab => (
        <button key={tab.id} onClick={() => setActiveTab(tab.id)}
          style={vertical ? {
            display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px',
            border: 'none', borderRadius: 8, textAlign: 'left', cursor: 'pointer',
            fontFamily: font.sans, fontSize: type.body,
            fontWeight: activeTab === tab.id ? 500 : 400,
            background: activeTab === tab.id ? color.surfaceDarkRaised : 'transparent',
            color: activeTab === tab.id ? color.textOnDark.primary : color.textOnDark.secondary,
            transition: 'all 0.15s ease',
          } : {
            padding: '10px 18px', border: 'none', background: 'transparent', cursor: 'pointer',
            fontFamily: font.sans, fontSize: type.body,
            fontWeight: activeTab === tab.id ? 500 : 400,
            color: activeTab === tab.id ? color.textOnDark.primary : color.textOnDark.secondary,
            borderBottom: activeTab === tab.id ? `2px solid ${color.forest}` : '2px solid transparent',
            transition: 'color 0.15s ease, border-bottom 0.15s ease',
          }}>
          {tab.label}
          {tab.id === 'checkins' && pendingCount > 0 && (
            <span style={{ marginLeft: 6, background: color.gold, color: color.surfaceLight,
              fontSize: type.label, borderRadius: 999, padding: '1px 6px',
              fontFamily: font.mono, verticalAlign: 'middle' }}>
              {pendingCount}
            </span>
          )}
          {tab.id === 'messages' && unreadMessageCount > 0 && (
            <span style={{ marginLeft: 6, background: color.forest, color: color.sage,
              fontSize: type.label, borderRadius: 999, padding: '1px 6px',
              fontFamily: font.mono, verticalAlign: 'middle' }}>
              {unreadMessageCount}
            </span>
          )}
        </button>
      ))}
    </nav>
  )

  const AttentionAlert = () => attentionCount > 0 ? (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}
      onClick={() => setActiveTab('dashboard')}>
      <div style={{ width: 7, height: 7, borderRadius: '50%', background: color.alert, flexShrink: 0 }} />
      <span style={{ fontSize: type.label, color: color.alert, fontFamily: font.mono, whiteSpace: 'nowrap' }}>
        {attentionCount} need{attentionCount === 1 ? 's' : ''} attention
      </span>
    </div>
  ) : null

  const SignOutButton = () => (
    <button onClick={() => supabase.auth.signOut()}
      style={{ fontSize: type.label, color: color.textOnDark.secondary, fontFamily: font.mono, letterSpacing: '0.1em',
        background: 'transparent', border: `1px solid ${color.borderDark}`, cursor: 'pointer',
        padding: '5px 12px', borderRadius: 6, whiteSpace: 'nowrap' }}>
      SIGN OUT
    </button>
  )

  const Logo = () => (
    <div onClick={() => setActiveTab('dashboard')}
      style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
      <Mark size={20} />
      <span style={{ fontSize: 18, fontWeight: 300, letterSpacing: '-0.03em', color: color.textOnDark.primary }}>
        purema<span style={{ color: color.forest }}>.</span>
      </span>
    </div>
  )

  // Payment retries were exhausted (or the subscription was canceled outright)
  // — block everything except a read-only screen pointing back to Stripe's
  // billing portal. Nothing is deleted; this just gates access until the
  // coach fixes their card and the webhook flips payment_status back.
  if (!loading && isSuspended(profile)) {
    return (
      <div style={{ minHeight: '100vh', background: color.void, display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', padding: 24, fontFamily: font.sans, gap: 20, textAlign: 'center' }}>
        <Mark size={40} />
        <div style={{ fontSize: type.heading, fontWeight: 300, color: color.textOnDark.primary, maxWidth: 480 }}>
          Your subscription is past due
        </div>
        <div style={{ fontSize: type.body, color: color.textOnDark.secondary, maxWidth: 420, lineHeight: 1.6 }}>
          Payment retries were unsuccessful, so access to your dashboard is paused. Nothing has been deleted —
          update your payment method to pick up right where you left off.
        </div>
        {portalError && <div style={{ fontSize: type.body, color: color.alert }}>{portalError}</div>}
        <button onClick={openBillingPortal} disabled={portalLoading}
          style={{ padding: '12px 24px', borderRadius: 8, border: 'none',
            background: portalLoading ? color.textOnDark.faint : color.forest, color: color.sage,
            fontFamily: font.sans, fontSize: type.body, fontWeight: 500,
            cursor: portalLoading ? 'not-allowed' : 'pointer' }}>
          {portalLoading ? 'Opening...' : 'Update payment method'}
        </button>
        <button onClick={() => supabase.auth.signOut()}
          style={{ fontSize: type.label, color: color.textOnDark.faint, fontFamily: font.mono, letterSpacing: '0.1em',
            background: 'transparent', border: 'none', cursor: 'pointer' }}>
          SIGN OUT
        </button>
      </div>
    )
  }

  return (
    <div className="purema-shell" style={{ background: color.bone, fontFamily: font.sans }}>

      {/* Desktop sidebar nav (900px+) */}
      <div className="purema-nav-desktop" style={{ flexDirection: 'column', justifyContent: 'space-between',
        background: color.void, padding: '28px 20px', position: 'sticky', top: 0, height: '100vh',
        boxSizing: 'border-box' }}>
        <div>
          <div style={{ padding: '0 4px', marginBottom: 28 }}><Logo /></div>
          <NavList vertical />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <SearchBar
            clients={clients}
            checkins={checkins}
            onSelectCheckin={setSelected}
            onSelectClient={() => setActiveTab('clients')}
          />
          <AttentionAlert />
          <SignOutButton />
        </div>
      </div>

      {/* Mobile header + page content + mobile bottom tab bar */}
      <div>
        <div className="purema-header-mobile" style={{ background: color.void, position: 'sticky', top: 0,
          zIndex: 100, flexDirection: 'column', gap: 10, padding: '12px 20px', boxSizing: 'border-box' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Logo />
            <SignOutButton />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <SearchBar
              clients={clients}
              checkins={checkins}
              onSelectCheckin={setSelected}
              onSelectClient={() => setActiveTab('clients')}
            />
            <AttentionAlert />
          </div>
        </div>

        {/* Page content */}
        <div className="purema-content" style={{ padding: '32px 32px 100px', boxSizing: 'border-box' }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: 80, color: color.textOnLight.secondary,
              fontSize: type.label, fontFamily: font.mono, letterSpacing: '0.1em' }}>LOADING...</div>
          ) : (
            <>
              {isPastDue(profile) && (
                <div style={{ background: '#FAEEDA', border: `1px solid ${color.gold}`, borderRadius: 10,
                  padding: '12px 16px', marginBottom: 20, display: 'flex', alignItems: 'center',
                  justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: type.body, color: '#633806' }}>
                    Your last payment failed — update your card to avoid losing access.
                  </span>
                  <button onClick={openBillingPortal} disabled={portalLoading}
                    style={{ padding: '6px 14px', borderRadius: 6, border: 'none', background: color.gold,
                      color: '#fff', fontFamily: font.sans, fontSize: type.label, fontWeight: 500,
                      cursor: portalLoading ? 'not-allowed' : 'pointer', whiteSpace: 'nowrap' }}>
                    {portalLoading ? 'Opening...' : 'Update payment method'}
                  </button>
                </div>
              )}
              {portalError && isPastDue(profile) && (
                <div style={{ fontSize: type.body, color: color.alert, marginBottom: 20 }}>{portalError}</div>
              )}
              {activeTab === 'dashboard' && <TabDashboard checkins={checkins} clients={clients} onSelectCheckin={setSelected} />}
              {activeTab === 'clients' && <TabClients clients={clients} checkins={checkins} profile={profile} onStatusChange={handleStatusChange} onTargetsSave={handleTargetsSave} onImportCheckins={handleImportCheckins} onGoToBilling={() => setActiveTab('billing')} />}
              {activeTab === 'checkins' && <TabCheckIns checkins={checkins} onSelectCheckin={setSelected} />}
              {activeTab === 'calendar' && <TabCalendar clients={clients} checkins={checkins} />}
              {activeTab === 'messages' && <TabMessages clients={clients} messages={messages} coachId={profile?.id} onSendMessage={handleSendMessage} onMarkRead={handleMarkMessagesRead} />}
              {activeTab === 'overview' && <TabOverview clients={clients} checkins={checkins} profile={profile} />}
              {activeTab === 'billing' && <TabBilling profile={profile} />}
              {activeTab === 'settings' && <TabSettings profile={profile} onToggleNotify={handleToggleNotify} />}
            </>
          )}
        </div>

        {/* Mobile bottom tab bar (below 900px) */}
        <div className="purema-tabbar-mobile" style={{ position: 'fixed', bottom: 0, left: 0, right: 0,
          background: color.void, borderTop: `1px solid ${color.borderDark}`, zIndex: 100,
          justifyContent: 'flex-start', gap: 4, overflowX: 'auto', padding: '0 8px', WebkitOverflowScrolling: 'touch' }}>
          {TABS.map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
                background: 'transparent', cursor: 'pointer', padding: '6px 6px 4px', flexShrink: 0,
                border: 'none', borderTop: activeTab === tab.id ? `2px solid ${color.forest}` : '2px solid transparent',
                fontFamily: font.sans, fontSize: type.label,
                fontWeight: activeTab === tab.id ? 500 : 400,
                color: activeTab === tab.id ? color.textOnDark.primary : color.textOnDark.secondary,
                whiteSpace: 'nowrap' }}>
              {tab.label}
              {tab.id === 'checkins' && pendingCount > 0 && (
                <span style={{ background: color.gold, color: color.surfaceLight,
                  fontSize: type.label, borderRadius: 999, padding: '1px 5px',
                  fontFamily: font.mono }}>
                  {pendingCount}
                </span>
              )}
              {tab.id === 'messages' && unreadMessageCount > 0 && (
                <span style={{ background: color.forest, color: color.sage,
                  fontSize: type.label, borderRadius: 999, padding: '1px 5px',
                  fontFamily: font.mono }}>
                  {unreadMessageCount}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {selected && (
        <CheckInDetail checkin={selected} onClose={() => setSelected(null)} onFeedbackSave={handleFeedbackSave} coachId={profile?.id} />
      )}
    </div>
  )
}