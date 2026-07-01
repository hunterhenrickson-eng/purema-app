import { useState, useEffect, useMemo, useRef } from 'react'
import { supabase } from '../lib/supabase'

// ─── Icons ────────────────────────────────────────────────────────────────────

const Mark = ({ size = 24 }) => (
  <svg width={size} height={size * 0.9} viewBox="0 0 52 48">
    <polyline points="6,10 18,24 6,38" fill="none" stroke="#0F6E56" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    <polyline points="19,10 31,24 19,38" fill="none" stroke="#0F6E56" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"/>
    <polyline points="32,10 46,24 32,38" fill="none" stroke="#0F6E56" strokeWidth="5.5" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
)

const SearchIcon = () => (
  <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
  </svg>
)

// ─── Shared styles ────────────────────────────────────────────────────────────

const S = {
  card: { background: '#fff', borderRadius: 12, border: '0.5px solid #E8E8E8', padding: 20 },
  label: { fontSize: 10, fontWeight: 500, color: '#888', letterSpacing: '0.1em', textTransform: 'uppercase', fontFamily: 'DM Mono, monospace' },
  sectionTitle: { fontSize: 10, fontWeight: 500, color: '#888', letterSpacing: '0.1em', textTransform: 'uppercase', fontFamily: 'DM Mono, monospace', marginBottom: 14 },
}

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
          color: '#BA7517', bg: '#FAEEDA', textColor: '#633806',
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
          color: '#888', bg: '#F0EDE8', textColor: '#555',
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
    <div ref={ref} style={{ position: 'relative', width: 260 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8,
        background: '#1A1A1A', borderRadius: 8, padding: '7px 12px',
        border: '1px solid #2A2A2A' }}>
        <span style={{ color: '#666' }}><SearchIcon /></span>
        <input
          value={query}
          onChange={e => { setQuery(e.target.value); setOpen(true) }}
          onFocus={() => setOpen(true)}
          placeholder="Search clients or check-ins..."
          style={{ background: 'transparent', border: 'none', outline: 'none',
            color: '#F5F2ED', fontSize: 13, fontFamily: 'DM Sans', width: '100%' }}
        />
        {query && (
          <button onClick={() => { setQuery(''); setOpen(false) }}
            style={{ background: 'none', border: 'none', color: '#666', cursor: 'pointer', fontSize: 16, lineHeight: 1 }}>
            ×
          </button>
        )}
      </div>

      {showDropdown && (
        <div style={{ position: 'absolute', top: 'calc(100% + 6px)', left: 0, right: 0,
          background: '#fff', borderRadius: 10, border: '0.5px solid #E8E8E8',
          boxShadow: '0 8px 24px rgba(0,0,0,0.12)', zIndex: 300, overflow: 'hidden' }}>
          {!hasResults && (
            <div style={{ padding: '14px 16px', fontSize: 13, color: '#888', fontFamily: 'DM Sans' }}>
              No results for "{query}"
            </div>
          )}
          {matchedClients.length > 0 && (
            <>
              <div style={{ padding: '8px 16px 4px', ...S.label, fontSize: 9 }}>Clients</div>
              {matchedClients.map(client => (
                <div key={client.id}
                  onClick={() => { onSelectClient(client); setQuery(''); setOpen(false) }}
                  style={{ padding: '10px 16px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10 }}
                  onMouseEnter={e => e.currentTarget.style.background = '#F5F2ED'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                  <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#EAF3DE',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 12, fontWeight: 500, color: '#0F6E56', flexShrink: 0 }}>
                    {(client.full_name || client.email || '?').charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 500, color: '#0D0D0D' }}>{client.full_name || '—'}</div>
                    <div style={{ fontSize: 11, color: '#888' }}>{client.email}</div>
                  </div>
                </div>
              ))}
            </>
          )}
          {matchedCheckins.length > 0 && (
            <>
              <div style={{ padding: '8px 16px 4px', ...S.label, fontSize: 9, borderTop: matchedClients.length > 0 ? '0.5px solid #F0F0F0' : 'none' }}>Check-ins</div>
              {matchedCheckins.map(checkin => (
                <div key={checkin.id}
                  onClick={() => { onSelectCheckin(checkin); setQuery(''); setOpen(false) }}
                  style={{ padding: '10px 16px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10 }}
                  onMouseEnter={e => e.currentTarget.style.background = '#F5F2ED'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                  <div style={{ width: 28, height: 28, borderRadius: '50%', background: '#FAEEDA',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 12, fontWeight: 500, color: '#BA7517', flexShrink: 0 }}>
                    {checkin.client_name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 500, color: '#0D0D0D' }}>{checkin.client_name}</div>
                    <div style={{ fontSize: 11, color: '#888' }}>Week {checkin.week_number} · {new Date(checkin.submitted_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</div>
                  </div>
                  <span style={{ marginLeft: 'auto', fontSize: 10, background: checkin.coach_feedback ? '#EAF3DE' : '#FAEEDA',
                    color: checkin.coach_feedback ? '#1A5C0A' : '#633806',
                    padding: '2px 8px', borderRadius: 999, fontFamily: 'DM Mono, monospace' }}>
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
        <div style={{ fontSize: 14, fontWeight: 500, color: '#0D0D0D' }}>
          {item.client.full_name || item.client.email}
        </div>
        <div style={{ fontSize: 12, color: '#888', marginTop: 2 }}>{item.sublabel}</div>
      </div>
      <span style={{ fontSize: 10, background: item.bg, color: item.textColor,
        padding: '3px 10px', borderRadius: 999, fontFamily: 'DM Mono, monospace',
        fontWeight: 500, whiteSpace: 'nowrap', flexShrink: 0 }}>
        {item.label}
      </span>
      {item.checkin && <span style={{ color: '#CCC', fontSize: 18, flexShrink: 0 }}>›</span>}
    </div>
  )
}

// ─── Check-in detail modal ────────────────────────────────────────────────────

// ─── Performance badge ───────────────────────────────────────────────────────

const PerfBadge = ({ value }) => {
  if (value === '' || value === null || value === undefined) return null
  const v = parseInt(value)
  const map = { 0: { label: 'Regression', color: '#E24B4A', bg: '#2A1010' }, 1: { label: 'No change', color: '#BA7517', bg: '#2A1A00' }, 2: { label: 'Progression', color: '#0F6E56', bg: '#0A1F16' } }
  const p = map[v]
  if (!p) return null
  return <span style={{ fontSize: 10, background: p.bg, color: p.color, padding: '2px 8px', borderRadius: 999, fontFamily: 'DM Mono, monospace', fontWeight: 500 }}>{p.label}</span>
}

// ─── Check-in detail modal ────────────────────────────────────────────────────

const CheckInDetail = ({ checkin, onClose, onFeedbackSave }) => {
  const [feedback, setFeedback] = useState(checkin.coach_feedback || '')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

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
    const { error } = await supabase.from('check_ins').update({ coach_feedback: feedback }).eq('id', checkin.id)
    setSaving(false)
    if (!error) { setSaved(true); onFeedbackSave(checkin.id, feedback); setTimeout(() => setSaved(false), 2000) }
  }

  const Row = ({ label, value, unit }) => value ? (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '0.5px solid #F0F0F0' }}>
      <span style={{ fontSize: 13, color: '#888' }}>{label}</span>
      <span style={{ fontSize: 13, fontWeight: 500, color: '#0D0D0D' }}>{value}{unit ? ' ' + unit : ''}</span>
    </div>
  ) : null

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={onClose}>
      <div style={{ background: '#F5F2ED', borderRadius: 16, width: '100%', maxWidth: isNewFormat ? 1100 : 600, maxHeight: '92vh', overflowY: 'auto', margin: '0 20px' }} onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div style={{ position: 'sticky', top: 0, background: '#0D0D0D', padding: '16px 24px', borderRadius: '16px 16px 0 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', zIndex: 10 }}>
          <div>
            <div style={{ fontSize: 17, fontWeight: 500, color: '#F5F2ED' }}>{checkin.client_name}</div>
            <div style={{ fontSize: 11, color: '#0F6E56', fontFamily: 'DM Mono, monospace', marginTop: 2 }}>WEEK {checkin.week_number}</div>
          </div>
          <button onClick={onClose} style={{ background: '#1A1A1A', border: 'none', color: '#AAA', width: 32, height: 32, borderRadius: '50%', cursor: 'pointer', fontSize: 16 }}>×</button>
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
                  <div key={label} style={{ background: '#0D0D0D', borderRadius: 10, padding: '12px 16px' }}>
                    <div style={{ fontSize: 20, fontWeight: 300, color: '#F5F2ED' }}>{value}<span style={{ fontSize: 11, color: '#555', marginLeft: 3 }}>{unit}</span></div>
                    <div style={{ ...S.label, color: '#666', marginTop: 4 }}>{label}</div>
                  </div>
                ) : null)}
              </div>

              {/* Daily log */}
              <div style={{ background: '#fff', borderRadius: 12, border: '0.5px solid #E8E8E8', padding: 16 }}>
                <div style={{ ...S.label, marginBottom: 14 }}>Daily log</div>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 800, fontSize: 13 }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid #F0F0F0' }}>
                        <td style={{ padding: '6px 10px', color: '#888', fontFamily: 'DM Mono, monospace', fontSize: 10, letterSpacing: '0.06em' }}>METRIC</td>
                        {DAYS.map(d => (
                          <td key={d} style={{ padding: '6px 10px', textAlign: 'center', fontWeight: 600, color: '#0D0D0D', fontFamily: 'DM Mono, monospace', fontSize: 11, letterSpacing: '0.04em' }}>{d}</td>
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
                          <td style={{ padding: '8px 10px', color: '#888', fontSize: 12, whiteSpace: 'nowrap' }}>{label}</td>
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
                            const color = key === 'on_plan' ? (day.on_plan === true ? '#0F6E56' : day.on_plan === false ? '#E24B4A' : '#AAA')
                              : key === 'performance' ? (day.performance === 2 ? '#0F6E56' : day.performance === 0 ? '#E24B4A' : '#888')
                              : '#0D0D0D'
                            return (
                              <td key={i} style={{ padding: '8px 10px', textAlign: 'center', color, fontWeight: isOnPlan ? 600 : 400 }}>
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
                          <span style={{ color: '#888', fontFamily: 'DM Mono, monospace', fontSize: 11, minWidth: 32 }}>{DAYS[i]}</span>
                          <span style={{ color: '#333' }}>{d.diet_notes}</span>
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
                          <span style={{ color: '#888', fontFamily: 'DM Mono, monospace', fontSize: 11, minWidth: 32 }}>{DAYS[i]}</span>
                          <span style={{ color: '#333' }}>{d.digestive_notes}</span>
                        </div>
                      ) : null)}
                    </div>
                  </div>
                )}
              </div>

              {/* Lifts */}
              {dailyLog.some(d => d.lifts) && (
                <div style={{ background: '#fff', borderRadius: 12, border: '0.5px solid #E8E8E8', padding: 16 }}>
                  <div style={{ ...S.label, marginBottom: 14 }}>Lift tracker</div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 12 }}>
                    {dailyLog.map((d, i) => d.lifts ? (
                      <div key={i}>
                        <div style={{ fontSize: 11, fontWeight: 600, color: '#0D0D0D', fontFamily: 'DM Mono, monospace', letterSpacing: '0.06em', marginBottom: 6 }}>{DAYS[i]}</div>
                        <div style={{ fontSize: 13, color: '#333', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>{d.lifts}</div>
                      </div>
                    ) : null)}
                  </div>
                </div>
              )}

              {/* Day notes */}
              {dailyLog.some(d => d.notes) && (
                <div style={{ background: '#fff', borderRadius: 12, border: '0.5px solid #E8E8E8', padding: 16 }}>
                  <div style={{ ...S.label, marginBottom: 14 }}>Day notes</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    {dailyLog.map((d, i) => d.notes ? (
                      <div key={i} style={{ display: 'flex', gap: 12 }}>
                        <div style={{ fontSize: 11, fontWeight: 600, color: '#888', fontFamily: 'DM Mono, monospace', minWidth: 32, paddingTop: 2 }}>{DAYS[i]}</div>
                        <div style={{ fontSize: 14, color: '#333', lineHeight: 1.7 }}>{d.notes}</div>
                      </div>
                    ) : null)}
                  </div>
                </div>
              )}

              {/* Measurements */}
              {(checkin.waist || checkin.chest || checkin.hips || checkin.arms || checkin.thighs) && (
                <div style={{ background: '#fff', borderRadius: 12, border: '0.5px solid #E8E8E8', padding: 16 }}>
                  <div style={{ ...S.label, marginBottom: 12 }}>Measurements</div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 10 }}>
                    {[['Waist', checkin.waist], ['Chest', checkin.chest], ['Hips', checkin.hips], ['Arms', checkin.arms], ['Thighs', checkin.thighs]].map(([label, val]) => val ? (
                      <div key={label} style={{ background: '#F5F2ED', borderRadius: 8, padding: '10px 12px', textAlign: 'center' }}>
                        <div style={{ fontSize: 16, fontWeight: 500, color: '#0D0D0D' }}>{val}<span style={{ fontSize: 11, color: '#888', marginLeft: 2 }}>in</span></div>
                        <div style={{ ...S.label, marginTop: 4 }}>{label}</div>
                      </div>
                    ) : null)}
                  </div>
                </div>
              )}

              {/* Vitals */}
              {vitals && (vitals.resting_hr || vitals.blood_pressure || vitals.blood_glucose) && (
                <div style={{ background: '#fff', borderRadius: 12, border: '0.5px solid #E8E8E8', padding: 16 }}>
                  <div style={{ ...S.label, marginBottom: 12 }}>Weekly vitals</div>
                  <div style={{ display: 'flex', gap: 20 }}>
                    {vitals.resting_hr && <div><span style={{ fontSize: 13, color: '#888' }}>Resting HR </span><span style={{ fontSize: 13, fontWeight: 500, color: '#0D0D0D' }}>{vitals.resting_hr} bpm</span></div>}
                    {vitals.blood_pressure && <div><span style={{ fontSize: 13, color: '#888' }}>BP </span><span style={{ fontSize: 13, fontWeight: 500, color: '#0D0D0D' }}>{vitals.blood_pressure}</span></div>}
                    {vitals.blood_glucose && <div><span style={{ fontSize: 13, color: '#888' }}>Glucose </span><span style={{ fontSize: 13, fontWeight: 500, color: '#0D0D0D' }}>{vitals.blood_glucose} mg/dL</span></div>}
                  </div>
                </div>
              )}

              {/* Reflection */}
              {reflection && (reflection.win || reflection.improve || reflection.notes) && (
                <div style={{ background: '#fff', borderRadius: 12, border: '0.5px solid #E8E8E8', padding: 16 }}>
                  <div style={{ ...S.label, marginBottom: 14 }}>Weekly reflection</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                    {reflection.win && (
                      <div>
                        <div style={{ fontSize: 11, color: '#0F6E56', fontFamily: 'DM Mono, monospace', letterSpacing: '0.06em', marginBottom: 4 }}>WIN OF THE WEEK</div>
                        <div style={{ fontSize: 14, color: '#333', lineHeight: 1.7 }}>{reflection.win}</div>
                      </div>
                    )}
                    {reflection.improve && (
                      <div>
                        <div style={{ fontSize: 11, color: '#BA7517', fontFamily: 'DM Mono, monospace', letterSpacing: '0.06em', marginBottom: 4 }}>AREAS TO IMPROVE</div>
                        <div style={{ fontSize: 14, color: '#333', lineHeight: 1.7 }}>{reflection.improve}</div>
                      </div>
                    )}
                    {reflection.notes && (
                      <div>
                        <div style={{ fontSize: 11, color: '#888', fontFamily: 'DM Mono, monospace', letterSpacing: '0.06em', marginBottom: 4 }}>ADDITIONAL NOTES</div>
                        <div style={{ fontSize: 14, color: '#333', lineHeight: 1.7 }}>{reflection.notes}</div>
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
              <div style={{ background: '#fff', borderRadius: 12, padding: 16, border: '0.5px solid #E8E8E8' }}>
                <div style={{ ...S.label, marginBottom: 12 }}>Body metrics</div>
                <Row label="Weight" value={checkin.weight} unit="lbs" />
                <Row label="Waist" value={checkin.waist} unit="in" />
                <Row label="Chest" value={checkin.chest} unit="in" />
                <Row label="Hips" value={checkin.hips} unit="in" />
                <Row label="Arms" value={checkin.arms} unit="in" />
                <Row label="Thighs" value={checkin.thighs} unit="in" />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ background: '#fff', borderRadius: 12, padding: 16, border: '0.5px solid #E8E8E8' }}>
                  <div style={{ ...S.label, marginBottom: 12 }}>Nutrition</div>
                  <Row label="Calories" value={checkin.calories} unit="kcal" />
                  <Row label="Protein" value={checkin.protein} unit="g" />
                  <Row label="Carbs" value={checkin.carbs} unit="g" />
                  <Row label="Fats" value={checkin.fats} unit="g" />
                </div>
                <div style={{ background: '#fff', borderRadius: 12, padding: 16, border: '0.5px solid #E8E8E8' }}>
                  <div style={{ ...S.label, marginBottom: 12 }}>Lifestyle</div>
                  <Row label="Sleep" value={checkin.sleep} unit="hrs" />
                  <Row label="Steps" value={checkin.steps} />
                </div>
              </div>
              {checkin.notes && (
                <div style={{ gridColumn: '1 / -1', background: '#fff', borderRadius: 12, padding: 16, border: '0.5px solid #E8E8E8' }}>
                  <div style={{ ...S.label, marginBottom: 8 }}>Client notes</div>
                  <div style={{ fontSize: 14, color: '#333', lineHeight: 1.6 }}>{checkin.notes}</div>
                </div>
              )}
            </div>
          )}

          {/* Coach feedback — always shown */}
          <div style={{ background: '#0D0D0D', borderRadius: 12, padding: 16 }}>
            <div style={{ ...S.label, color: '#0F6E56', marginBottom: 8 }}>Coach feedback</div>
            <textarea value={feedback} onChange={e => setFeedback(e.target.value)}
              placeholder="Leave feedback for this client..." rows={5}
              style={{ width: '100%', background: '#1A1A1A', border: '1px solid #2A2A2A', borderRadius: 8,
                color: '#F5F2ED', padding: '10px 12px', fontSize: 14, fontFamily: 'DM Sans, sans-serif',
                lineHeight: 1.6, resize: 'none', outline: 'none', boxSizing: 'border-box' }} />
            <button onClick={saveFeedback} disabled={saving}
              style={{ marginTop: 8, width: '100%', height: 44, background: saved ? '#0D5E49' : '#0F6E56',
                border: 'none', borderRadius: 8, color: '#EAF3DE', fontSize: 13, fontWeight: 500,
                cursor: 'pointer', fontFamily: 'DM Sans, sans-serif' }}>
              {saving ? 'Saving...' : saved ? 'Saved!' : 'Save feedback'}
            </button>
          </div>

        </div>
      </div>
    </div>
  )
}

// ─── Tab: Dashboard ───────────────────────────────────────────────────────────

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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
        {[
          { label: 'Active clients', value: activeClients.length, color: '#F5F2ED' },
          { label: 'This week', value: `${weeklyRate}%`, color: weeklyRate >= 80 ? '#0F6E56' : weeklyRate >= 50 ? '#BA7517' : activeClients.length === 0 ? '#AAA' : '#E24B4A' },
          { label: 'Pending', value: checkins.filter(c => !c.coach_feedback).length, color: checkins.filter(c => !c.coach_feedback).length > 0 ? '#BA7517' : '#AAA' },
          { label: 'Needs attention', value: attentionItems.length, color: attentionItems.length > 0 ? '#E24B4A' : '#AAA' },
        ].map(({ label, value, color }) => (
          <div key={label} style={{ background: '#0D0D0D', borderRadius: 12, padding: '18px 20px' }}>
            <div style={{ fontSize: 28, fontWeight: 300, color, letterSpacing: '-0.02em' }}>{value}</div>
            <div style={{ ...S.label, color: '#888', marginTop: 6 }}>{label}</div>
          </div>
        ))}
      </div>

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
        <div style={{ ...S.card, display: 'flex', alignItems: 'center', gap: 14, background: '#EAF3DE', border: '0.5px solid #C5DFB0' }}>
          <div style={{ fontSize: 24 }}>✓</div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 500, color: '#0D3D1F' }}>All caught up</div>
            <div style={{ fontSize: 12, color: '#3A7A4A', marginTop: 2 }}>No clients need your attention right now.</div>
          </div>
        </div>
      ) : (
        <div style={{ textAlign: 'center', padding: '60px 0' }}>
          <div style={{ fontSize: 36, marginBottom: 12 }}>📋</div>
          <div style={{ fontSize: 16, fontWeight: 500, color: '#0D0D0D', marginBottom: 6 }}>No clients yet</div>
          <div style={{ fontSize: 13, color: '#888' }}>Head to the Clients tab to send your first invite.</div>
        </div>
      )}
    </div>
  )
}

// ─── Tab: Clients ─────────────────────────────────────────────────────────────

const TabClients = ({ clients, onInvite, onStatusChange }) => {
  const [email, setEmail] = useState('')
  const [link, setLink] = useState(null)
  const [inviteError, setInviteError] = useState(null)
  const [loading, setLoading] = useState(false)
  const [copied, setCopied] = useState(false)

  const handleInvite = async (e) => {
    e.preventDefault()
    setInviteError(null); setLink(null); setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    const { data, error } = await supabase.from('invites').insert({ coach_id: user.id, email }).select('token').single()
    setLoading(false)
    if (error) { setInviteError(error.message); return }
    setLink(`${window.location.origin}/invite/${data.token}`)
    setEmail('')
    if (onInvite) onInvite()
  }

  const activeClients = clients.filter(c => !c.status || c.status === 'active')
  const pausedClients = clients.filter(c => c.status === 'paused')
  const archivedClients = clients.filter(c => c.status === 'archived')

  const ClientRow = ({ client }) => (
    <div style={{ ...S.card, display: 'flex', alignItems: 'center', gap: 14 }}>
      <div style={{ width: 40, height: 40, borderRadius: '50%',
        background: client.status === 'paused' ? '#F0EDE8' : client.status === 'archived' ? '#F0EDE8' : '#EAF3DE',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 14, fontWeight: 500,
        color: client.status === 'paused' ? '#888' : client.status === 'archived' ? '#CCC' : '#0F6E56',
        flexShrink: 0 }}>
        {(client.full_name || client.email || '?').charAt(0).toUpperCase()}
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 14, fontWeight: 500, color: client.status === 'archived' ? '#AAA' : '#0D0D0D' }}>
          {client.full_name || '—'}
        </div>
        <div style={{ fontSize: 12, color: '#888', marginTop: 2 }}>
          {client.email} · Joined {new Date(client.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
        </div>
      </div>
      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
        {(!client.status || client.status === 'active') && (
          <button onClick={() => onStatusChange(client.id, 'paused')}
            style={{ fontSize: 11, padding: '4px 10px', borderRadius: 6, border: '1px solid #E8E8E8',
              background: 'transparent', color: '#888', cursor: 'pointer', fontFamily: 'DM Mono, monospace' }}>
            Pause
          </button>
        )}
        {client.status === 'paused' && (
          <>
            <button onClick={() => onStatusChange(client.id, 'active')}
              style={{ fontSize: 11, padding: '4px 10px', borderRadius: 6, border: '1px solid #0F6E56',
                background: 'transparent', color: '#0F6E56', cursor: 'pointer', fontFamily: 'DM Mono, monospace' }}>
              Reactivate
            </button>
            <button onClick={() => onStatusChange(client.id, 'archived')}
              style={{ fontSize: 11, padding: '4px 10px', borderRadius: 6, border: '1px solid #E24B4A',
                background: 'transparent', color: '#E24B4A', cursor: 'pointer', fontFamily: 'DM Mono, monospace' }}>
              Archive
            </button>
          </>
        )}
        {client.status !== 'archived' && (
          <span style={{ fontSize: 10,
            background: client.status === 'paused' ? '#F0EDE8' : '#EAF3DE',
            color: client.status === 'paused' ? '#888' : '#1A5C0A',
            padding: '3px 10px', borderRadius: 999, fontFamily: 'DM Mono, monospace' }}>
            {client.status === 'paused' ? 'Paused' : 'Active'}
          </span>
        )}
        {client.status === 'archived' && (
          <span style={{ fontSize: 10, background: '#F0EDE8', color: '#CCC',
            padding: '3px 10px', borderRadius: 999, fontFamily: 'DM Mono, monospace' }}>
            Archived
          </span>
        )}
      </div>
    </div>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div style={S.card}>
        <div style={{ ...S.label, marginBottom: 14 }}>Invite a client</div>
        <form onSubmit={handleInvite} style={{ display: 'flex', gap: 8 }}>
          <input type="email" required placeholder="client@email.com" value={email}
            onChange={e => setEmail(e.target.value)}
            style={{ flex: 1, padding: '10px 12px', borderRadius: 8, border: '1px solid #E8E8E8',
              fontFamily: 'DM Sans', fontSize: 14, outline: 'none', color: '#0D0D0D' }} />
          <button type="submit" disabled={loading}
            style={{ padding: '10px 18px', borderRadius: 8, border: 'none', background: '#0F6E56',
              color: '#F5F2ED', fontFamily: 'DM Sans', fontWeight: 500, cursor: 'pointer', fontSize: 14 }}>
            {loading ? 'Generating...' : 'Send Invite'}
          </button>
        </form>
        {inviteError && <p style={{ color: '#E24B4A', marginTop: 8, fontSize: 13 }}>{inviteError}</p>}
        {link && (
          <div style={{ marginTop: 12, padding: 12, background: '#EAF3DE', borderRadius: 8 }}>
            <div style={{ fontSize: 12, color: '#555', marginBottom: 6 }}>Share this link with your client:</div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <code style={{ fontSize: 12, wordBreak: 'break-all', flex: 1, color: '#0D0D0D' }}>{link}</code>
              <button onClick={() => { navigator.clipboard.writeText(link); setCopied(true); setTimeout(() => setCopied(false), 2000) }}
                style={{ padding: '6px 12px', borderRadius: 6, border: '1px solid #0F6E56',
                  background: 'transparent', color: '#0F6E56', fontSize: 12, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                {copied ? 'Copied!' : 'Copy'}
              </button>
            </div>
          </div>
        )}
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
        <div style={{ ...S.card, textAlign: 'center', padding: '40px 20px', color: '#888', fontSize: 13 }}>
          No clients yet. Invite one above to get started.
        </div>
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
        fontFamily: 'DM Mono, monospace', fontSize: 10, letterSpacing: '0.06em',
        background: filter === value ? '#0D0D0D' : 'transparent',
        color: filter === value ? '#F5F2ED' : '#888' }}>
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
        <div style={{ ...S.card, textAlign: 'center', padding: '40px 20px', color: '#888', fontSize: 13 }}>
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
                  background: isPending ? '#FAEEDA' : '#EAF3DE',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 14, fontWeight: 500, color: isPending ? '#BA7517' : '#0F6E56', flexShrink: 0 }}>
                  {checkin.client_name.charAt(0).toUpperCase()}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 500, color: '#0D0D0D' }}>{checkin.client_name}</div>
                  <div style={{ fontSize: 12, color: '#888', marginTop: 2 }}>
                    Week {checkin.week_number} · {formatDate(checkin.submitted_at)}
                    {checkin.weight ? ' · ' + checkin.weight + ' lbs' : ''}
                  </div>
                </div>
                <span style={{ fontSize: 10, background: isPending ? '#FAEEDA' : '#EAF3DE',
                  color: isPending ? '#633806' : '#1A5C0A',
                  padding: '3px 10px', borderRadius: 999, fontFamily: 'DM Mono, monospace', fontWeight: 500 }}>
                  {isPending ? 'Pending' : 'Done'}
                </span>
                <span style={{ color: '#CCC', fontSize: 18 }}>›</span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ─── Tab: Overview ────────────────────────────────────────────────────────────

const TabOverview = ({ clients, checkins }) => {
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

  const StatCard = ({ label, value, sub, color = '#0D0D0D' }) => (
    <div style={{ background: '#0D0D0D', borderRadius: 12, padding: '18px 20px' }}>
      <div style={{ fontSize: 28, fontWeight: 300, color: color || '#F5F2ED', letterSpacing: '-0.02em' }}>{value}</div>
      <div style={{ ...S.label, color: '#888', marginTop: 6 }}>{label}</div>
      {sub && <div style={{ fontSize: 11, color: '#555', marginTop: 4 }}>{sub}</div>}
    </div>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>

      {/* Business stats */}
      <div>
        <div style={S.sectionTitle}>Business</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
          <StatCard label="Active clients" value={activeClients.length} color="#F5F2ED" />
          <StatCard label="Paused" value={pausedClients.length} color={pausedClients.length > 0 ? '#BA7517' : '#AAA'} />
          <StatCard label="Archived" value={archivedClients.length} color="#AAA" />
        </div>
      </div>

      {/* Revenue — stubbed for Stripe */}
      <div>
        <div style={S.sectionTitle}>Revenue</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
          <div style={{ background: '#0D0D0D', borderRadius: 12, padding: '18px 20px' }}>
            <div style={{ fontSize: 28, fontWeight: 300, color: '#AAA', letterSpacing: '-0.02em' }}>—</div>
            <div style={{ ...S.label, color: '#888', marginTop: 6 }}>MRR</div>
            <div style={{ fontSize: 11, color: '#444', marginTop: 4 }}>Connect Stripe to unlock</div>
          </div>
          <div style={{ background: '#0D0D0D', borderRadius: 12, padding: '18px 20px' }}>
            <div style={{ fontSize: 28, fontWeight: 300, color: '#AAA', letterSpacing: '-0.02em' }}>—</div>
            <div style={{ ...S.label, color: '#888', marginTop: 6 }}>Avg. per client</div>
            <div style={{ fontSize: 11, color: '#444', marginTop: 4 }}>Connect Stripe to unlock</div>
          </div>
          <div style={{ background: '#0D0D0D', borderRadius: 12, padding: '18px 20px' }}>
            <div style={{ fontSize: 28, fontWeight: 300, color: '#AAA', letterSpacing: '-0.02em' }}>—</div>
            <div style={{ ...S.label, color: '#888', marginTop: 6 }}>Churn this month</div>
            <div style={{ fontSize: 11, color: '#444', marginTop: 4 }}>Connect Stripe to unlock</div>
          </div>
        </div>
      </div>

      {/* Engagement */}
      <div>
        <div style={S.sectionTitle}>Engagement</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
          <StatCard label="Weekly check-in rate" value={`${weeklyRate}%`}
            color={weeklyRate >= 80 ? '#0F6E56' : weeklyRate >= 50 ? '#BA7517' : activeClients.length === 0 ? '#AAA' : '#E24B4A'} />
          <StatCard label="Feedback response rate" value={`${responseRate}%`}
            color={responseRate >= 80 ? '#0F6E56' : responseRate >= 50 ? '#BA7517' : totalCheckins === 0 ? '#AAA' : '#E24B4A'} />
          <StatCard label="Total check-ins" value={totalCheckins} color="#F5F2ED" />
        </div>
      </div>

      {/* Capacity */}
      <div>
        <div style={S.sectionTitle}>Capacity</div>
        <div style={{ ...S.card }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <div style={{ fontSize: 14, fontWeight: 500, color: '#0D0D0D' }}>Client slots</div>
            <span style={{ fontSize: 11, background: '#EAF3DE', color: '#1A5C0A',
              padding: '3px 10px', borderRadius: 999, fontFamily: 'DM Mono, monospace' }}>
              Free plan · 3 max
            </span>
          </div>
          <div style={{ background: '#F0EDE8', borderRadius: 999, height: 6, overflow: 'hidden' }}>
            <div style={{ height: '100%', borderRadius: 999, background: '#0F6E56',
              width: `${Math.min((activeClients.length / 3) * 100, 100)}%`,
              transition: 'width 0.3s ease' }} />
          </div>
          <div style={{ fontSize: 12, color: '#888', marginTop: 8 }}>
            {activeClients.length} of 3 slots used
            {activeClients.length >= 3 && (
              <span style={{ color: '#E24B4A', marginLeft: 8 }}>· Upgrade to add more clients</span>
            )}
          </div>
        </div>
      </div>

    </div>
  )
}

// ─── Tab: Calendar (placeholder) ─────────────────────────────────────────────

const TabCalendar = () => (
  <div style={{ ...S.card, textAlign: 'center', padding: '60px 20px' }}>
    <div style={{ fontSize: 32, marginBottom: 12 }}>📅</div>
    <div style={{ fontSize: 16, fontWeight: 500, color: '#0D0D0D', marginBottom: 6 }}>Calendar</div>
    <div style={{ fontSize: 13, color: '#888' }}>Shared calendar with check-in dates, peak weeks, and show days. Coming soon.</div>
  </div>
)

// ─── Tab: Messages (placeholder) ─────────────────────────────────────────────

const TabMessages = () => (
  <div style={{ ...S.card, textAlign: 'center', padding: '60px 20px' }}>
    <div style={{ fontSize: 32, marginBottom: 12 }}>💬</div>
    <div style={{ fontSize: 16, fontWeight: 500, color: '#0D0D0D', marginBottom: 6 }}>Messages</div>
    <div style={{ fontSize: 13, color: '#888' }}>Direct messaging with clients. Coming soon.</div>
  </div>
)

// ─── Tab definitions ──────────────────────────────────────────────────────────

const TABS = [
  { id: 'dashboard', label: 'Dashboard' },
  { id: 'clients', label: 'Clients' },
  { id: 'checkins', label: 'Check-ins' },
  { id: 'calendar', label: 'Calendar' },
  { id: 'messages', label: 'Messages' },
  { id: 'overview', label: 'Overview' },
]

// ─── Main shell ───────────────────────────────────────────────────────────────

export default function CoachDashboard() {
  const [activeTab, setActiveTab] = useState('dashboard')
  const [checkins, setCheckins] = useState([])
  const [clients, setClients] = useState([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState(null)
  const [coachId, setCoachId] = useState(null)

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setCoachId(user.id)
      fetchAll(user.id)
    })
  }, [])

  const fetchAll = async (id) => {
    const [checkinsRes, clientsRes] = await Promise.all([
      supabase.from('check_ins').select('*').eq('coach_id', id).order('submitted_at', { ascending: false }),
      supabase.from('profiles').select('*').eq('coach_id', id),
    ])
    if (!checkinsRes.error) setCheckins(checkinsRes.data || [])
    if (!clientsRes.error) setClients(clientsRes.data || [])
    setLoading(false)
  }

  const handleFeedbackSave = (id, feedback) => {
    setCheckins(prev => prev.map(c => c.id === id ? { ...c, coach_feedback: feedback } : c))
  }

  const handleStatusChange = async (clientId, newStatus) => {
    const { error } = await supabase
      .from('profiles')
      .update({ status: newStatus })
      .eq('id', clientId)
    if (!error) {
      setClients(prev => prev.map(c => c.id === clientId ? { ...c, status: newStatus } : c))
    }
  }

  const pendingCount = checkins.filter(c => !c.coach_feedback).length
  const attentionCount = useMemo(() => buildAttentionQueue(clients, checkins).length, [clients, checkins])

  return (
    <div style={{ minHeight: '100vh', background: '#F5F2ED', fontFamily: 'DM Sans, sans-serif' }}>

      {/* Top nav */}
      <div style={{ background: '#0D0D0D', position: 'sticky', top: 0, zIndex: 100 }}>
        <div style={{ maxWidth: 1100, margin: '0 auto', padding: '0 32px',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 56 }}>

          {/* Logo — clickable, returns to dashboard */}
          <div onClick={() => setActiveTab('dashboard')}
            style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
            <Mark size={20} />
            <span style={{ fontSize: 18, fontWeight: 300, letterSpacing: '-0.03em', color: '#F5F2ED' }}>
              purema<span style={{ color: '#0F6E56' }}>.</span>
            </span>
          </div>

          {/* Search + alerts + sign out */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <SearchBar
              clients={clients}
              checkins={checkins}
              onSelectCheckin={setSelected}
              onSelectClient={() => setActiveTab('clients')}
            />
            {attentionCount > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}
                onClick={() => setActiveTab('dashboard')}>
                <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#E24B4A' }} />
                <span style={{ fontSize: 11, color: '#E24B4A', fontFamily: 'DM Mono, monospace', whiteSpace: 'nowrap' }}>
                  {attentionCount} need{attentionCount === 1 ? 's' : ''} attention
                </span>
              </div>
            )}
            <button onClick={() => supabase.auth.signOut()}
              style={{ fontSize: 11, color: '#AAA', fontFamily: 'DM Mono, monospace', letterSpacing: '0.1em',
                background: 'transparent', border: '1px solid #333', cursor: 'pointer',
                padding: '5px 12px', borderRadius: 6, whiteSpace: 'nowrap' }}>
              SIGN OUT
            </button>
          </div>
        </div>

        {/* Tab bar */}
        <div style={{ maxWidth: 1100, margin: '0 auto', padding: '0 32px', display: 'flex' }}>
          {TABS.map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              style={{ padding: '10px 18px', border: 'none', background: 'transparent', cursor: 'pointer',
                fontFamily: 'DM Sans, sans-serif', fontSize: 13,
                fontWeight: activeTab === tab.id ? 500 : 400,
                color: activeTab === tab.id ? '#F5F2ED' : '#AAA',
                borderBottom: activeTab === tab.id ? '2px solid #0F6E56' : '2px solid transparent',
                transition: 'color 0.15s ease, border-bottom 0.15s ease' }}>
              {tab.label}
              {tab.id === 'checkins' && pendingCount > 0 && (
                <span style={{ marginLeft: 6, background: '#BA7517', color: '#fff',
                  fontSize: 10, borderRadius: 999, padding: '1px 6px',
                  fontFamily: 'DM Mono, monospace', verticalAlign: 'middle' }}>
                  {pendingCount}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Page content */}
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '32px 32px 80px' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: 80, color: '#888',
            fontSize: 12, fontFamily: 'DM Mono, monospace', letterSpacing: '0.1em' }}>LOADING...</div>
        ) : (
          <>
            {activeTab === 'dashboard' && <TabDashboard checkins={checkins} clients={clients} onSelectCheckin={setSelected} />}
            {activeTab === 'clients' && <TabClients clients={clients} onInvite={() => fetchAll(coachId)} onStatusChange={handleStatusChange} />}
            {activeTab === 'checkins' && <TabCheckIns checkins={checkins} onSelectCheckin={setSelected} />}
            {activeTab === 'calendar' && <TabCalendar />}
            {activeTab === 'messages' && <TabMessages />}
            {activeTab === 'overview' && <TabOverview clients={clients} checkins={checkins} />}
          </>
        )}
      </div>

      {selected && (
        <CheckInDetail checkin={selected} onClose={() => setSelected(null)} onFeedbackSave={handleFeedbackSave} />
      )}
    </div>
  )
}