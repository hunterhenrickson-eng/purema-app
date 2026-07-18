import { useState, useEffect, useMemo, useRef } from 'react'
import { supabase } from '../lib/supabase'
import {
  color as staticColor, appearance, font, type,
  labelStyleAppearance as labelStyle, badge, navItemStyleAppearance as navItemStyle, displayStyle,
} from '../lib/theme'
import '../styles/purema-responsive.css'
import InviteClient, { createInvite } from '../components/InviteClient'
import { PLANS, planById, tierLimit, isSubscribed, isPastDue, isSuspended } from '../lib/billing'
import { isAdminSuspended, isDeleted } from '../lib/adminPermissions'
import { getActivePhase } from '../lib/dietPlan'
import { notify } from '../lib/notify'
import ImportHistory from '../components/ImportHistory'
import MessageThread from '../components/MessageThread'
import ProgressPhotoGallery from '../components/ProgressPhotos'
import FoodSearchPicker, { round1 } from '../components/FoodSearchPicker'

// One of the four screens wired to the appearance toggle (profiles.appearance
// — see App.js and src/styles/tokens.css). This file alone has 340+
// `color.bone`/`color.surfaceLight`/`color.textOnLight.*`/`color.borderLight`/
// `color.surfaceNav` call sites — this local `color` shadows just those
// fields with the appearance-aware tokens rather than touching each one
// individually. `color.void`/`surfaceDark`/`textOnDark.*`/`borderDark` are
// NOT shadowed here — this file has a few genuinely-static dark accents
// (the notification-bell unread pill, a segmented-control active state, a
// button's on-forest text color) that are correct as fixed values and are
// intentionally left untouched this phase.
const color = {
  ...staticColor,
  bone: appearance.surfacePage,
  surfaceLight: appearance.surfaceCard,
  surfaceNav: appearance.surfaceNav,
  borderLight: appearance.borderDefault,
  textOnLight: appearance.text,
  surfaceSunken: appearance.surfaceSunken,
  borderSubtle: appearance.borderSubtle,
}

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

const HamburgerIcon = () => (
  <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/>
  </svg>
)

const BellIcon = () => (
  <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/>
    <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
  </svg>
)

const PlusIcon = () => (
  <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
  </svg>
)

// Same 24x24 stroke-icon style ClientHome.js's GearIcon uses (each page
// defines its own local copies rather than sharing a module — matches the
// existing convention where Mark/SearchIcon etc. are also duplicated
// per-file instead of extracted).
const GearIcon = () => (
  <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="3"/>
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
  </svg>
)

const DashboardIcon = () => (
  <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/>
    <rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>
  </svg>
)

const ClientsIcon = () => (
  <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M17 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
    <path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>
  </svg>
)

const RequestsIcon = () => (
  <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="8.5" cy="7" r="4"/>
    <line x1="20" y1="8" x2="20" y2="14"/><line x1="17" y1="11" x2="23" y2="11"/>
  </svg>
)

const CheckInsIcon = () => (
  <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2"/>
    <rect x="9" y="3" width="6" height="4" rx="1"/><path d="M9 14l2 2 4-4"/>
  </svg>
)

const CalendarIcon = () => (
  <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/>
    <line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>
  </svg>
)

const MessagesIcon = () => (
  <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/>
  </svg>
)

const OverviewIcon = () => (
  <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>
  </svg>
)

const BillingIcon = () => (
  <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/>
  </svg>
)

// Small hover-only label for icon-only UI (collapsed sidebar nav items,
// collapsed mini-client-list avatars) — required whenever a text label is
// hidden, per the app's readability standard.
const IconTooltip = ({ label, show }) => !show ? null : (
  <div style={{ position: 'absolute', left: '100%', top: '50%', transform: 'translateY(-50%)',
    marginLeft: 10, background: color.void, color: color.textOnDark.primary, fontSize: type.label,
    fontFamily: font.sans, padding: '5px 10px', borderRadius: 6, whiteSpace: 'nowrap', zIndex: 500,
    pointerEvents: 'none' }}>
    {label}
  </div>
)

// ─── Shared styles ────────────────────────────────────────────────────────────

const S = {
  card: { background: color.surfaceLight, borderRadius: 12, border: `0.5px solid ${color.borderLight}`, padding: 20 },
  label: { ...labelStyle(), letterSpacing: '0.1em' },
  sectionTitle: { ...labelStyle(), letterSpacing: '0.1em', marginBottom: 14 },
}

// A transparency label, not a warning — backfilled history is real data,
// just not a live weekly submission, so this stays neutral rather than
// using an alert color. The badge has its own opaque background, so it
// reads the same whether the surrounding card is light or dark.
const ImportedTag = () => (
  <span style={{ ...badge('neutral'), whiteSpace: 'nowrap' }}>
    Imported
  </span>
)

// ─── Attention queue logic ────────────────────────────────────────────────────

function timeAgo(ts) {
  if (!ts) return ''
  const mins = Math.floor((new Date() - new Date(ts)) / 60000)
  if (mins < 1) return 'Just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  return `${days}d ago`
}

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
          badgeType: 'warning',
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
          badgeType: 'neutral',
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
        background: color.surfaceLight, borderRadius: 8, padding: '7px 12px',
        border: `1px solid ${color.borderLight}` }}>
        <span style={{ color: color.textOnLight.secondary }}><SearchIcon /></span>
        <input
          value={query}
          onChange={e => { setQuery(e.target.value); setOpen(true) }}
          onFocus={() => setOpen(true)}
          placeholder="Search clients or check-ins..."
          style={{ background: 'transparent', border: 'none', outline: 'none',
            color: color.textOnLight.primary, fontSize: type.body, fontFamily: font.sans, width: '100%' }}
        />
        {query && (
          <button onClick={() => { setQuery(''); setOpen(false) }}
            style={{ background: 'none', border: 'none', color: color.textOnLight.secondary, cursor: 'pointer', fontSize: 16, lineHeight: 1 }}>
            ×
          </button>
        )}
      </div>

      {showDropdown && (
        <div style={{ position: 'absolute', top: 'calc(100% + 6px)', left: 0, right: 0,
          background: color.surfaceLight, borderRadius: 10, border: `0.5px solid ${color.borderLight}`,
          zIndex: 300, overflow: 'hidden' }}>
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
              <div style={{ padding: '8px 16px 4px', ...S.label, borderTop: matchedClients.length > 0 ? `0.5px solid ${color.borderSubtle}` : 'none' }}>Check-ins</div>
              {matchedCheckins.map(checkin => (
                <div key={checkin.id}
                  onClick={() => { onSelectCheckin(checkin); setQuery(''); setOpen(false) }}
                  style={{ padding: '10px 16px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10 }}
                  onMouseEnter={e => e.currentTarget.style.background = color.bone}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
                  <div style={{ width: 28, height: 28, borderRadius: '50%', background: badge('warning').background,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: type.label, fontWeight: 500, color: color.gold, flexShrink: 0 }}>
                    {checkin.client_name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <div style={{ fontSize: type.body, fontWeight: 500, color: color.textOnLight.primary }}>{checkin.client_name}</div>
                    <div style={{ fontSize: type.label, color: color.textOnLight.secondary }}>Week {checkin.week_number} · {new Date(checkin.submitted_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</div>
                  </div>
                  <span style={{ marginLeft: 'auto', ...badge(checkin.coach_feedback ? 'success' : 'warning') }}>
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
  const itemBadge = badge(item.badgeType)

  return (
    <div onClick={() => item.checkin && onSelectCheckin(item.checkin)}
      style={{ ...S.card, display: 'flex', alignItems: 'center', gap: 14,
        cursor: item.checkin ? 'pointer' : 'default' }}
      onMouseEnter={e => { if (item.checkin) e.currentTarget.style.borderColor = color.forest }}
      onMouseLeave={e => e.currentTarget.style.borderColor = color.borderLight}>
      <div style={{ width: 42, height: 42, borderRadius: '50%', background: itemBadge.background,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 13, fontWeight: 500, color: itemBadge.color, flexShrink: 0 }}>
        {initials}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: type.body, fontWeight: 500, color: color.textOnLight.primary }}>
          {item.client.full_name || item.client.email}
        </div>
        <div style={{ fontSize: type.label, color: color.textOnLight.secondary, marginTop: 2 }}>{item.sublabel}</div>
      </div>
      <span style={{ ...itemBadge, whiteSpace: 'nowrap', flexShrink: 0 }}>
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
      const { data, error: loadErr } = await supabase.from('weekly_target_overrides')
        .select('*').eq('client_id', checkin.client_id).eq('week_number', checkin.week_number).maybeSingle()
      if (cancelled) return
      if (loadErr) {
        setOverrideError("Couldn't load this week's override — try refreshing.")
      } else {
        setOverride(data || null)
        if (data) {
          setOverrideForm({
            calories: data.calories ?? '', protein: data.protein ?? '', carbs: data.carbs ?? '', fats: data.fats ?? '', note: '',
          })
        }
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
    notify('macro', checkin.client_id)
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
    if (!error) {
      setSaved(true)
      onFeedbackSave(checkin.id, feedback, feedbackAt)
      notify('feedback', checkin.client_id)
      setTimeout(() => setSaved(false), 2000)
    }
  }

  const Row = ({ label, value, unit }) => value ? (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: `0.5px solid ${color.borderSubtle}` }}>
      <span style={{ fontSize: type.body, color: color.textOnLight.secondary }}>{label}</span>
      <span style={{ fontSize: type.body, fontWeight: 500, color: color.textOnLight.primary }}>{value}{unit ? ' ' + unit : ''}</span>
    </div>
  ) : null

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={onClose}>
      <div style={{ background: color.bone, borderRadius: 16, width: '100%', maxWidth: isNewFormat ? 1100 : 600, maxHeight: '92vh', overflowY: 'auto', margin: '0 20px' }} onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div style={{ position: 'sticky', top: 0, background: color.surfaceLight, borderBottom: `0.5px solid ${color.borderLight}`, padding: '16px 24px', borderRadius: '16px 16px 0 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', zIndex: 10 }}>
          <div>
            <div style={{ fontSize: 17, fontWeight: 500, color: color.textOnLight.primary }}>{checkin.client_name}</div>
            <div style={{ fontSize: type.label, color: color.forest, fontFamily: font.mono, marginTop: 2, display: 'flex', alignItems: 'center', gap: 8 }}>
              WEEK {checkin.week_number}
              {checkin.imported_backfill && <ImportedTag />}
            </div>
          </div>
          <button onClick={onClose} style={{ background: color.surfaceSunken, border: 'none', color: color.textOnLight.secondary, width: 32, height: 32, borderRadius: '50%', cursor: 'pointer', fontSize: 16 }}>×</button>
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
                  <div key={label} style={{ background: color.surfaceLight, border: `0.5px solid ${color.borderLight}`, borderRadius: 10, padding: '12px 16px' }}>
                    <div style={{ fontSize: 20, fontWeight: 300, color: color.textOnLight.primary }}>{value}<span style={{ fontSize: type.label, color: color.textOnLight.faint, marginLeft: 3 }}>{unit}</span></div>
                    <div style={{ ...S.label, marginTop: 4 }}>{label}</div>
                  </div>
                ) : null)}
              </div>

              {/* Daily log */}
              <div style={{ background: color.surfaceLight, borderRadius: 12, border: `0.5px solid ${color.borderLight}`, padding: 16 }}>
                <div style={{ ...S.label, marginBottom: 14 }}>Daily log</div>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 800, fontSize: 13 }}>
                    <thead>
                      <tr style={{ borderBottom: `1px solid ${color.borderSubtle}` }}>
                        <td style={{ padding: '6px 10px', color: color.textOnLight.secondary, fontFamily: font.mono, fontSize: type.label, letterSpacing: '0.06em' }}>METRIC</td>
                        {DAYS.map(d => (
                          <td key={d} style={{ padding: '6px 10px', textAlign: 'center', fontWeight: 500, color: color.textOnLight.primary, fontFamily: font.mono, fontSize: type.label, letterSpacing: '0.04em' }}>{d}</td>
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
                        <tr key={key} style={{ borderBottom: `0.5px solid ${color.borderSubtle}` }}>
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
                  <div style={{ marginTop: 14, paddingTop: 14, borderTop: `0.5px solid ${color.borderSubtle}` }}>
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
                  <div style={{ marginTop: 14, paddingTop: 14, borderTop: `0.5px solid ${color.borderSubtle}` }}>
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
                        <div style={{ fontSize: type.label, fontWeight: 500, color: color.textOnLight.primary, fontFamily: font.mono, letterSpacing: '0.06em', marginBottom: 6 }}>{DAYS[i]}</div>
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
                        <div style={{ fontSize: type.label, fontWeight: 500, color: color.textOnLight.secondary, fontFamily: font.mono, minWidth: 32, paddingTop: 2 }}>{DAYS[i]}</div>
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
                  style={{ padding: '7px 16px', borderRadius: 6,
                    border: `1px solid ${overrideSaved ? color.forest : color.textOnLight.secondary}`,
                    background: 'transparent', color: overrideSaved ? color.forest : color.textOnLight.secondary,
                    fontFamily: font.sans, fontSize: type.label, fontWeight: 500, cursor: overrideSaving ? 'not-allowed' : 'pointer' }}>
                  {overrideSaving ? 'Saving...' : overrideSaved ? 'Saved ✓' : override ? 'Update override' : 'Save override'}
                </button>
              </>
            )}
          </div>

          {/* Coach feedback — always shown */}
          <div style={{ background: color.surfaceLight, border: `0.5px solid ${color.borderLight}`, borderRadius: 12, padding: 16 }}>
            <div style={{ ...S.label, color: color.forest, marginBottom: 8 }}>Coach feedback</div>
            <textarea value={feedback} onChange={e => setFeedback(e.target.value)}
              placeholder="Leave feedback for this client..." rows={5}
              style={{ width: '100%', background: color.surfaceLight, border: `1px solid ${color.borderLight}`, borderRadius: 8,
                color: color.textOnLight.primary, padding: '10px 12px', fontSize: type.body, fontFamily: font.sans,
                lineHeight: 1.6, resize: 'none', outline: 'none', boxSizing: 'border-box' }} />
            <button onClick={saveFeedback} disabled={saving}
              style={{ marginTop: 8, width: '100%', height: 44, background: saved ? color.forestPressed : color.forest,
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
      <div className="purema-kpi-grid" style={{ display: 'grid', gap: 12 }}>
        {[
          { label: 'Active clients', value: activeClients.length, color: color.textOnLight.primary },
          { label: 'This week', value: `${weeklyRate}%`, color: weeklyRate >= 80 ? color.forest : weeklyRate >= 50 ? color.gold : activeClients.length === 0 ? color.textOnLight.secondary : color.alert },
          { label: 'Pending', value: checkins.filter(c => !c.coach_feedback).length, color: checkins.filter(c => !c.coach_feedback).length > 0 ? color.gold : color.textOnLight.secondary },
          { label: 'Needs attention', value: attentionItems.length, color: attentionItems.length > 0 ? color.alert : color.textOnLight.secondary },
        ].map(({ label, value, color: statColor }) => (
          <div key={label} style={{ background: color.surfaceLight, border: `0.5px solid ${color.borderLight}`, borderRadius: 12, padding: '18px 20px' }}>
            <div style={{ fontSize: 28, fontWeight: 300, color: statColor, letterSpacing: '-0.02em', fontFamily: font.mono }}>{value}</div>
            <div style={{ ...S.label, marginTop: 6 }}>{label}</div>
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
        <div style={{ ...S.card, display: 'flex', alignItems: 'center', gap: 14, background: color.sage, border: `0.5px solid ${color.successBorder}` }}>
          <div style={{ fontSize: 24 }}>✓</div>
          <div>
            <div style={{ fontSize: type.body, fontWeight: 500, color: color.successTextStrong }}>All caught up</div>
            <div style={{ fontSize: type.label, color: color.successTextSoft, marginTop: 2 }}>No clients need your attention right now.</div>
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
    <div style={{ marginTop: 10, paddingTop: 14, borderTop: `0.5px solid ${color.borderSubtle}` }}>
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
          background: saved ? color.forestPressed : color.forest, color: color.sage,
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

// ─── Feedback history ─────────────────────────────────────────────────────
// Read-only chronological view of every piece of feedback given to this
// client — distinct from the check-ins list's per-row Reviewed/Pending
// badge, which shows status only, not the feedback text over time.
// Feedback itself is still edited from the check-in detail view, not here.
const FeedbackHistoryPanel = ({ client, checkins }) => {
  const history = checkins
    .filter(c => c.client_id === client.id && c.coach_feedback)
    .sort((a, b) => {
      if (!a.feedback_at && !b.feedback_at) return 0
      if (!a.feedback_at) return 1
      if (!b.feedback_at) return -1
      return new Date(b.feedback_at) - new Date(a.feedback_at)
    })

  return (
    <div style={{ marginTop: 10, paddingTop: 14, borderTop: `0.5px solid ${color.borderSubtle}` }}>
      <div style={{ ...S.label, marginBottom: 10 }}>Feedback history</div>
      {history.length === 0 ? (
        <div style={{ fontSize: type.body, color: color.textOnLight.secondary }}>
          No feedback given yet.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {history.map(c => (
            <div key={c.id} style={{ background: color.bone, borderRadius: 8, padding: '10px 12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <span style={{ fontSize: type.label, color: color.forest, fontFamily: font.mono, letterSpacing: '0.06em' }}>
                  WEEK {c.week_number}
                </span>
                <span style={{ fontSize: type.label, color: color.textOnLight.faint, fontFamily: font.mono }}>
                  {c.feedback_at
                    ? new Date(c.feedback_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                    : '—'}
                </span>
              </div>
              <div style={{ fontSize: type.body, color: color.textOnLight.primary, lineHeight: 1.6 }}>
                {c.coach_feedback}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

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
  const [lastDiff, setLastDiff] = useState(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      const [{ data: phaseRows, error: phasesErr }, { data: historyRows, error: historyErr }] = await Promise.all([
        supabase.from('diet_plan_phases').select('*').eq('client_id', client.id).order('start_date', { ascending: true }),
        supabase.from('macro_adjustments').select('*').eq('client_id', client.id).order('created_at', { ascending: false }).limit(20),
      ])
      if (cancelled) return
      if (phasesErr || historyErr) {
        setError("Couldn't load this client's diet plan — try refreshing.")
      } else {
        setPhases(phaseRows || [])
        setHistory(historyRows || [])
        // Pre-fill "Add phase" with the active phase's own values, since a
        // coach adjusting an existing plan is usually tweaking one or two
        // numbers, not starting from a blank form every time.
        const active = getActivePhase(phaseRows || [])
        if (active) {
          setForm(f => ({ ...f,
            calories: active.calories ?? '', protein: active.protein ?? '',
            carbs: active.carbs ?? '', fats: active.fats ?? '' }))
        }
      }
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
    if (data) {
      setHistory(prev => [data, ...prev])
      // Shared by both addPhase (new phase) and saveEdit (editing an
      // existing one) — one notify() call here covers both call sites
      // rather than duplicating it at each caller.
      notify('macro', client.id)
    }
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

    const previousActive = getActivePhase(phases)
    const values = phaseValuesFromForm(form)
    const { data: phase, error: phaseError } = await supabase.from('diet_plan_phases')
      .insert({ plan_id: planId, client_id: client.id, coach_id: coachId, start_date: form.start_date, ...values })
      .select().single()

    setAdding(false)
    if (phaseError || !phase) { setError(phaseError?.message || "Couldn't add phase."); return }

    setPhases(prev => [...(prev || []), phase].sort((a, b) => (a.start_date < b.start_date ? -1 : 1)))
    await logAdjustment(phase.id, values, form.note)

    if (previousActive) {
      const diffs = MACRO_PHASE_FIELDS
        .map(f => (previousActive[f.key] === values[f.key] ? null : `${f.label}: ${previousActive[f.key] ?? '—'} → ${values[f.key] ?? '—'}${f.unit === 'kcal' ? '' : f.unit}`))
        .filter(Boolean)
      setLastDiff(diffs.length > 0 ? diffs : null)
    } else {
      setLastDiff(null)
    }
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
      <div style={{ marginTop: 10, paddingTop: 14, borderTop: `0.5px solid ${color.borderSubtle}`, fontSize: type.body, color: color.textOnLight.secondary }}>
        Loading plan...
      </div>
    )
  }

  if (error && phases === null) {
    return (
      <div style={{ marginTop: 10, paddingTop: 14, borderTop: `0.5px solid ${color.borderSubtle}`, fontSize: type.body, color: color.alert }}>
        {error}
      </div>
    )
  }

  const activePhase = getActivePhase(phases)

  return (
    <div style={{ marginTop: 10, paddingTop: 14, borderTop: `0.5px solid ${color.borderSubtle}` }}>
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
                      style={{ padding: '6px 14px', borderRadius: 6, border: `1px solid ${color.textOnLight.secondary}`,
                        background: 'transparent', color: color.textOnLight.secondary,
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
                    <div style={{ fontSize: type.body, fontWeight: 500, color: color.textOnLight.primary, fontFamily: font.mono }}>
                      {new Date(`${phase.start_date}T00:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      {phase.id === activePhase?.id && (
                        <span style={{ marginLeft: 8, fontSize: type.label, color: color.forest }}>ACTIVE</span>
                      )}
                    </div>
                    <div style={{ fontSize: type.label, color: color.textOnLight.secondary, marginTop: 2, fontFamily: font.mono }}>
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
        {lastDiff && (
          <div style={{ marginTop: 10, padding: 10, background: color.sage, borderRadius: 6 }}>
            {lastDiff.map((line, i) => (
              <div key={i} style={{ fontSize: type.label, color: badge('success').color, fontFamily: font.mono }}>{line}</div>
            ))}
          </div>
        )}
      </div>

      {activePhase && (
        <MealStructureSection phase={activePhase} clientId={client.id} coachId={coachId} />
      )}

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
                <span style={{ fontFamily: font.mono }}>
                  {[
                    h.calories != null && `${h.calories} kcal`,
                    h.protein != null && `${h.protein}g P`,
                    h.carbs != null && `${h.carbs}g C`,
                    h.fats != null && `${h.fats}g F`,
                  ].filter(Boolean).join(' · ')}
                </span>
                {h.note && <span style={{ fontStyle: 'italic' }}> — {h.note}</span>}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// Optional per-phase layer — a phase either has meal rows or it doesn't, so
// "on/off" is just whether any meals exist yet, no separate schema flag.
// Meal/plan totals are always computed from item-level data here, never
// stored redundantly, so they can't drift out of sync with their items.
const MealStructureSection = ({ phase, clientId, coachId }) => {
  const [meals, setMeals] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [showBuilder, setShowBuilder] = useState(false)
  const [newMealName, setNewMealName] = useState('')
  const [newMealTime, setNewMealTime] = useState('')
  const [addingMeal, setAddingMeal] = useState(false)
  const [addingFoodToMealId, setAddingFoodToMealId] = useState(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      const { data: mealRows, error: mealsErr } = await supabase
        .from('diet_plan_meals').select('*, diet_plan_meal_items(*)')
        .eq('phase_id', phase.id).order('sort_order', { ascending: true })
      if (cancelled) return
      if (mealsErr) setError("Couldn't load meals — try refreshing.")
      else {
        setMeals(mealRows || [])
        if ((mealRows || []).length > 0) setShowBuilder(true)
      }
      setLoading(false)
    }
    load()
    return () => { cancelled = true }
  }, [phase.id])

  const addMeal = async () => {
    if (!newMealName.trim()) return
    setAddingMeal(true)
    setError(null)
    const { data, error: insertError } = await supabase.from('diet_plan_meals').insert({
      phase_id: phase.id, client_id: clientId, coach_id: coachId,
      name: newMealName.trim(), sort_order: meals?.length || 0,
      target_time: newMealTime || null,
    }).select().single()
    setAddingMeal(false)
    if (insertError || !data) { setError(insertError?.message || "Couldn't add meal."); return }
    setMeals(prev => [...(prev || []), { ...data, diet_plan_meal_items: [] }])
    setNewMealName('')
    setNewMealTime('')
  }

  const deleteMeal = async (mealId) => {
    setError(null)
    const { error: deleteError } = await supabase.from('diet_plan_meals').delete().eq('id', mealId)
    if (deleteError) { setError(deleteError.message); return }
    setMeals(prev => prev.filter(m => m.id !== mealId))
  }

  const addItemToMeal = async (mealId, item) => {
    setError(null)
    const meal = meals.find(m => m.id === mealId)
    const { data, error: insertError } = await supabase.from('diet_plan_meal_items').insert({
      meal_id: mealId, client_id: clientId, coach_id: coachId,
      sort_order: meal?.diet_plan_meal_items?.length || 0,
      ...item,
    }).select().single()
    if (insertError || !data) { setError(insertError?.message || "Couldn't add food."); return }
    setMeals(prev => prev.map(m => (m.id === mealId ? { ...m, diet_plan_meal_items: [...(m.diet_plan_meal_items || []), data] } : m)))
    setAddingFoodToMealId(null)
  }

  const deleteItem = async (mealId, itemId) => {
    setError(null)
    const { error: deleteError } = await supabase.from('diet_plan_meal_items').delete().eq('id', itemId)
    if (deleteError) { setError(deleteError.message); return }
    setMeals(prev => prev.map(m => (m.id === mealId ? { ...m, diet_plan_meal_items: (m.diet_plan_meal_items || []).filter(i => i.id !== itemId) } : m)))
  }

  const mealTotals = (meal) => {
    const items = meal.diet_plan_meal_items || []
    return {
      calories: round1(items.reduce((s, i) => s + (i.calories || 0), 0)),
      protein: round1(items.reduce((s, i) => s + (i.protein || 0), 0)),
      carbs: round1(items.reduce((s, i) => s + (i.carbs || 0), 0)),
      fats: round1(items.reduce((s, i) => s + (i.fats || 0), 0)),
    }
  }

  const planTotals = useMemo(() => {
    if (!meals || meals.length === 0) return null
    return meals.reduce((acc, m) => {
      const t = mealTotals(m)
      return {
        calories: acc.calories + (t.calories || 0), protein: acc.protein + (t.protein || 0),
        carbs: acc.carbs + (t.carbs || 0), fats: acc.fats + (t.fats || 0),
      }
    }, { calories: 0, protein: 0, carbs: 0, fats: 0 })
  }, [meals])

  if (loading) {
    return <div style={{ fontSize: type.body, color: color.textOnLight.secondary, marginTop: 14 }}>Loading meals...</div>
  }

  return (
    <div style={{ marginTop: 14, paddingTop: 14, borderTop: `0.5px solid ${color.borderSubtle}` }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <div style={S.label}>Meal structure</div>
        <div onClick={() => setShowBuilder(v => !v)}
          style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
          <span style={{ fontSize: type.label, color: color.textOnLight.secondary }}>{showBuilder ? 'On' : 'Off'}</span>
          <Toggle value={showBuilder} onChange={setShowBuilder} />
        </div>
      </div>

      {showBuilder && (
        <>
          {meals.length === 0 && (
            <div style={{ fontSize: type.body, color: color.textOnLight.secondary, marginBottom: 12 }}>
              No meals yet — add one below.
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 14 }}>
            {meals.map(meal => {
              const totals = mealTotals(meal)
              return (
                <div key={meal.id} style={{ background: color.bone, borderRadius: 8, padding: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                    <div>
                      <div style={{ fontSize: type.body, fontWeight: 500, color: color.textOnLight.primary }}>
                        {meal.name}
                        {meal.target_time && (
                          <span style={{ marginLeft: 8, fontSize: type.label, color: color.textOnLight.faint, fontFamily: font.mono }}>
                            {meal.target_time.slice(0, 5)}
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: type.label, color: color.textOnLight.secondary, marginTop: 2, fontFamily: font.mono }}>
                        {[
                          totals.calories > 0 && `${totals.calories} kcal`,
                          totals.protein > 0 && `${totals.protein}g P`,
                          totals.carbs > 0 && `${totals.carbs}g C`,
                          totals.fats > 0 && `${totals.fats}g F`,
                        ].filter(Boolean).join(' · ') || 'No foods added'}
                      </div>
                    </div>
                    <button onClick={() => deleteMeal(meal.id)}
                      style={{ fontSize: type.label, padding: '4px 10px', borderRadius: 6, border: 'none',
                        background: 'transparent', color: color.alert, cursor: 'pointer', fontFamily: font.mono }}>
                      Remove
                    </button>
                  </div>

                  {(meal.diet_plan_meal_items || []).length > 0 && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 8 }}>
                      {meal.diet_plan_meal_items.map(item => (
                        <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                          padding: '6px 10px', background: color.surfaceLight, borderRadius: 6 }}>
                          <div style={{ fontSize: type.label, color: color.textOnLight.primary }}>
                            {item.food_name} <span style={{ color: color.textOnLight.faint }}>· {item.quantity}{item.unit}</span>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <span style={{ fontSize: type.label, color: color.textOnLight.secondary, fontFamily: font.mono }}>
                              {item.calories != null ? `${Math.round(item.calories)} kcal` : ''}
                            </span>
                            <button onClick={() => deleteItem(meal.id, item.id)}
                              style={{ background: 'none', border: 'none', color: color.textOnLight.faint, cursor: 'pointer', fontSize: 14, lineHeight: 1 }}>×</button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {addingFoodToMealId === meal.id ? (
                    <FoodSearchPicker
                      onAdd={(item) => addItemToMeal(meal.id, item)}
                      onCancel={() => setAddingFoodToMealId(null)}
                    />
                  ) : (
                    <button onClick={() => setAddingFoodToMealId(meal.id)}
                      style={{ fontSize: type.label, padding: '5px 12px', borderRadius: 6, border: `1px solid ${color.borderLight}`,
                        background: 'transparent', color: color.textOnLight.secondary, cursor: 'pointer', fontFamily: font.mono }}>
                      + Add food
                    </button>
                  )}
                </div>
              )
            })}
          </div>

          {planTotals && (
            <div style={{ display: 'flex', gap: 14, marginBottom: 14, fontSize: type.label, color: color.forest, fontFamily: font.mono, flexWrap: 'wrap' }}>
              <span>TOTAL</span>
              <span>{planTotals.calories} kcal</span>
              <span>{planTotals.protein}g P</span>
              <span>{planTotals.carbs}g C</span>
              <span>{planTotals.fats}g F</span>
            </div>
          )}

          <div style={{ background: color.bone, borderRadius: 8, padding: 12 }}>
            <div style={{ ...S.label, fontSize: type.label, marginBottom: 8 }}>Add meal</div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <input type="text" placeholder="Meal name (e.g. Breakfast)" value={newMealName}
                onChange={e => setNewMealName(e.target.value)}
                style={{ flex: 1, minWidth: 160, padding: '7px 10px', borderRadius: 6, border: `1px solid ${color.borderLight}`,
                  fontFamily: font.sans, fontSize: type.body, boxSizing: 'border-box', color: color.textOnLight.primary }} />
              <input type="time" value={newMealTime} onChange={e => setNewMealTime(e.target.value)}
                style={{ padding: '7px 10px', borderRadius: 6, border: `1px solid ${color.borderLight}`,
                  fontFamily: font.sans, fontSize: type.body, color: color.textOnLight.primary }} />
              <button onClick={addMeal} disabled={addingMeal || !newMealName.trim()}
                style={{ padding: '7px 16px', borderRadius: 6, border: `1px solid ${color.forest}`,
                  background: 'transparent', color: color.forest, fontFamily: font.sans, fontSize: type.label,
                  fontWeight: 500, cursor: (addingMeal || !newMealName.trim()) ? 'not-allowed' : 'pointer' }}>
                {addingMeal ? 'Adding...' : 'Add'}
              </button>
            </div>
          </div>
        </>
      )}

      {error && <div style={{ fontSize: type.body, color: color.alert, marginTop: 10 }}>{error}</div>}
    </div>
  )
}

const TabClients = ({ clients, checkins, profile, onStatusChange, onTargetsSave, onGoToBilling, onImportCheckins, focusClientId, onFocusHandled }) => {
  const [expandedId, setExpandedId] = useState(null)
  const [expandedPlanId, setExpandedPlanId] = useState(null)
  const [expandedFeedbackId, setExpandedFeedbackId] = useState(null)
  const [expandedPhotosId, setExpandedPhotosId] = useState(null)
  const [importingClient, setImportingClient] = useState(null)
  const activeClients = clients.filter(c => !c.status || c.status === 'active')
  const limit = tierLimit(profile?.subscription_tier)
  const atLimit = activeClients.length >= limit
  const pausedClients = clients.filter(c => c.status === 'paused')
  const archivedClients = clients.filter(c => c.status === 'archived')

  // Sidebar mini-client-list entries "jump to detail" by expanding that
  // client's Targets panel here and scrolling their row into view, rather
  // than a separate client-detail page that doesn't exist in this app.
  useEffect(() => {
    if (!focusClientId) return
    setExpandedId(focusClientId)
    const el = document.getElementById(`client-row-${focusClientId}`)
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' })
    onFocusHandled?.()
  }, [focusClientId, onFocusHandled])

  const ClientRow = ({ client }) => {
    const [statusError, setStatusError] = useState(null)

    const changeStatus = async (newStatus) => {
      setStatusError(null)
      const result = await onStatusChange(client.id, newStatus)
      if (!result.ok) setStatusError(result.message)
    }

    return (
    <div id={`client-row-${client.id}`} style={S.card}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
        <div style={{ width: 40, height: 40, borderRadius: '50%',
          background: client.status === 'paused' ? color.surfaceSunken : client.status === 'archived' ? color.surfaceSunken : color.sage,
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
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', overflowX: 'auto',
          WebkitOverflowScrolling: 'touch', maxWidth: '100%', minWidth: 0 }}>
          {client.status !== 'archived' && (
            <button onClick={() => setExpandedId(expandedId === client.id ? null : client.id)}
              style={{ fontSize: type.label, padding: '4px 10px', borderRadius: 6, border: `1px solid ${color.borderLight}`,
                background: expandedId === client.id ? color.bone : 'transparent', color: color.textOnLight.secondary,
                cursor: 'pointer', fontFamily: font.mono, flexShrink: 0, whiteSpace: 'nowrap' }}>
              Targets
            </button>
          )}
          {client.status !== 'archived' && (
            <button onClick={() => setExpandedPlanId(expandedPlanId === client.id ? null : client.id)}
              style={{ fontSize: type.label, padding: '4px 10px', borderRadius: 6, border: `1px solid ${color.borderLight}`,
                background: expandedPlanId === client.id ? color.bone : 'transparent', color: color.textOnLight.secondary,
                cursor: 'pointer', fontFamily: font.mono, flexShrink: 0, whiteSpace: 'nowrap' }}>
              Diet plan
            </button>
          )}
          {client.status !== 'archived' && (
            <button onClick={() => setImportingClient(client)}
              style={{ fontSize: type.label, padding: '4px 10px', borderRadius: 6, border: `1px solid ${color.borderLight}`,
                background: 'transparent', color: color.textOnLight.secondary, cursor: 'pointer', fontFamily: font.mono,
                flexShrink: 0, whiteSpace: 'nowrap' }}>
              Import history
            </button>
          )}
          {client.status !== 'archived' && (
            <button onClick={() => setExpandedFeedbackId(expandedFeedbackId === client.id ? null : client.id)}
              style={{ fontSize: type.label, padding: '4px 10px', borderRadius: 6, border: `1px solid ${color.borderLight}`,
                background: expandedFeedbackId === client.id ? color.bone : 'transparent', color: color.textOnLight.secondary,
                cursor: 'pointer', fontFamily: font.mono, flexShrink: 0, whiteSpace: 'nowrap' }}>
              Feedback history
            </button>
          )}
          {client.status !== 'archived' && (
            <button onClick={() => setExpandedPhotosId(expandedPhotosId === client.id ? null : client.id)}
              style={{ fontSize: type.label, padding: '4px 10px', borderRadius: 6, border: `1px solid ${color.borderLight}`,
                background: expandedPhotosId === client.id ? color.bone : 'transparent', color: color.textOnLight.secondary,
                cursor: 'pointer', fontFamily: font.mono, flexShrink: 0, whiteSpace: 'nowrap' }}>
              Progress photos
            </button>
          )}
          {(!client.status || client.status === 'active') && (
            <button onClick={() => changeStatus('paused')}
              style={{ fontSize: type.label, padding: '4px 10px', borderRadius: 6, border: `1px solid ${color.borderLight}`,
                background: 'transparent', color: color.textOnLight.secondary, cursor: 'pointer', fontFamily: font.mono,
                flexShrink: 0, whiteSpace: 'nowrap' }}>
              Pause
            </button>
          )}
          {client.status === 'paused' && (
            <>
              <button onClick={() => changeStatus('active')}
                style={{ fontSize: type.label, padding: '4px 10px', borderRadius: 6, border: `1px solid ${color.forest}`,
                  background: 'transparent', color: color.forest, cursor: 'pointer', fontFamily: font.mono,
                  flexShrink: 0, whiteSpace: 'nowrap' }}>
                Reactivate
              </button>
              <button onClick={() => changeStatus('archived')}
                style={{ fontSize: type.label, padding: '4px 10px', borderRadius: 6, border: `1px solid ${color.alert}`,
                  background: 'transparent', color: color.alert, cursor: 'pointer', fontFamily: font.mono,
                  flexShrink: 0, whiteSpace: 'nowrap' }}>
                Archive
              </button>
            </>
          )}
          {client.status !== 'archived' && (
            <span style={{ ...badge(client.status === 'paused' ? 'neutral' : 'success'), flexShrink: 0, whiteSpace: 'nowrap' }}>
              {client.status === 'paused' ? 'Paused' : 'Active'}
            </span>
          )}
          {client.status === 'archived' && (
            <span style={{ ...badge('neutral'), flexShrink: 0, whiteSpace: 'nowrap' }}>
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
      {expandedFeedbackId === client.id && (
        <FeedbackHistoryPanel client={client} checkins={checkins} />
      )}
      {expandedPhotosId === client.id && (
        <div style={{ marginTop: 10, paddingTop: 14, borderTop: `0.5px solid ${color.borderSubtle}` }}>
          <ProgressPhotoGallery clientId={client.id} coachId={profile?.id}
            checkins={checkins.filter(c => c.client_id === client.id).sort((a, b) => new Date(b.submitted_at) - new Date(a.submitted_at))}
            canUpload={false} />
        </div>
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
      style={{ padding: '6px 14px', border: 'none', cursor: 'pointer',
        fontFamily: font.mono, fontSize: type.label, letterSpacing: '0.06em',
        ...navItemStyle(filter === value), borderRadius: 6 }}>
      {label}{count > 0 ? ` · ${count}` : ''}
    </button>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', gap: 4, background: color.surfaceSunken, borderRadius: 8, padding: 4, alignSelf: 'flex-start' }}>
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
                onMouseEnter={e => { e.currentTarget.style.borderColor = color.forest; e.currentTarget.style.opacity = '1' }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = color.borderLight; e.currentTarget.style.opacity = isPending ? '1' : '0.7' }}>
                <div style={{ width: 40, height: 40, borderRadius: '50%',
                  background: badge(isPending ? 'warning' : 'success').background,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 14, fontWeight: 500, color: badge(isPending ? 'warning' : 'success').color, flexShrink: 0 }}>
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
                <span style={badge(isPending ? 'warning' : 'success')}>
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

// ─── Tab: Requests ────────────────────────────────────────────────────────────

// A row stays visible after Approve (even though its status flips away from
// 'pending') so the just-generated invite link doesn't vanish out from under
// the coach — it only drops off once the tab is left and applications are
// refetched. Decline has no such need and disappears immediately.
const TabRequests = ({ applications, onApprove, onDecline }) => {
  const [busyId, setBusyId] = useState(null)
  const [linkById, setLinkById] = useState({})
  const [errorById, setErrorById] = useState({})
  const formatDate = ts => new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })

  const visible = applications.filter(a => a.status === 'pending' || linkById[a.id])

  const handleApprove = async (application) => {
    setBusyId(application.id)
    setErrorById(prev => ({ ...prev, [application.id]: null }))
    const result = await onApprove(application)
    setBusyId(null)
    if (!result.ok) {
      setErrorById(prev => ({ ...prev, [application.id]: result.message }))
      return
    }
    setLinkById(prev => ({ ...prev, [application.id]: result.link }))
  }

  const handleDecline = async (application) => {
    setBusyId(application.id)
    setErrorById(prev => ({ ...prev, [application.id]: null }))
    const result = await onDecline(application)
    setBusyId(null)
    if (!result.ok) {
      setErrorById(prev => ({ ...prev, [application.id]: result.message }))
    }
  }

  if (visible.length === 0) {
    return (
      <div style={{ ...S.card, textAlign: 'center', padding: '40px 20px', color: color.textOnLight.secondary, fontSize: type.body }}>
        No pending applications.
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {visible.map(application => (
        <div key={application.id} style={{ ...S.card, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
            <div>
              <div style={{ fontSize: type.body, fontWeight: 500, color: color.textOnLight.primary }}>{application.name}</div>
              <div style={{ fontSize: type.label, color: color.textOnLight.secondary, marginTop: 2 }}>
                {application.email}{application.phone ? ` · ${application.phone}` : ''}
              </div>
            </div>
            <span style={{ fontSize: type.label, color: color.textOnLight.faint, fontFamily: font.mono, whiteSpace: 'nowrap' }}>
              {formatDate(application.submitted_at)}
            </span>
          </div>

          {application.notes && (
            <div style={{ fontSize: type.body, color: color.textOnLight.secondary, lineHeight: 1.5 }}>
              {application.notes}
            </div>
          )}

          {linkById[application.id] ? (
            <div style={{ background: badge('success').background, borderRadius: 8, padding: 12 }}>
              <div style={{ fontSize: type.label, color: color.textOnLight.secondary, marginBottom: 6 }}>
                Approved — share this invite link:
              </div>
              <code style={{ fontSize: type.label, wordBreak: 'break-all', color: color.textOnLight.primary }}>
                {linkById[application.id]}
              </code>
            </div>
          ) : (
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => handleApprove(application)} disabled={busyId === application.id}
                style={{ padding: '8px 16px', borderRadius: 6, border: 'none', cursor: busyId === application.id ? 'not-allowed' : 'pointer',
                  background: busyId === application.id ? color.textOnLight.faint : color.forest, color: color.textOnDark.primary,
                  fontFamily: font.sans, fontSize: type.label, fontWeight: 500 }}>
                {busyId === application.id ? 'Working...' : 'Approve'}
              </button>
              <button onClick={() => handleDecline(application)} disabled={busyId === application.id}
                style={{ padding: '8px 16px', borderRadius: 6, border: `1px solid ${color.borderLight}`, cursor: busyId === application.id ? 'not-allowed' : 'pointer',
                  background: 'transparent', color: color.textOnLight.secondary,
                  fontFamily: font.sans, fontSize: type.label, fontWeight: 500 }}>
                Decline
              </button>
            </div>
          )}

          {errorById[application.id] && (
            <div style={{ fontSize: type.label, color: color.alert }}>{errorById[application.id]}</div>
          )}
        </div>
      ))}
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

  const StatCard = ({ label, value, sub, color: accentColor = color.textOnLight.primary }) => (
    <div style={{ background: color.surfaceLight, border: `0.5px solid ${color.borderLight}`, borderRadius: 12, padding: '18px 20px' }}>
      <div style={{ fontSize: 28, fontWeight: 300, color: accentColor, letterSpacing: '-0.02em', fontFamily: font.mono }}>{value}</div>
      <div style={{ ...S.label, marginTop: 6 }}>{label}</div>
      {sub && <div style={{ fontSize: type.label, color: color.textOnLight.faint, marginTop: 4 }}>{sub}</div>}
    </div>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>

      {/* Business stats */}
      <div>
        <div style={S.sectionTitle}>Business</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
          <StatCard label="Active clients" value={activeClients.length} color={color.textOnLight.primary} />
          <StatCard label="Paused" value={pausedClients.length} color={pausedClients.length > 0 ? color.gold : color.textOnLight.secondary} />
          <StatCard label="Archived" value={archivedClients.length} color={color.textOnLight.secondary} />
        </div>
      </div>

      {/* Revenue — stubbed for Stripe */}
      <div>
        <div style={S.sectionTitle}>Revenue</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
          <div style={{ background: color.surfaceLight, border: `0.5px solid ${color.borderLight}`, borderRadius: 12, padding: '18px 20px' }}>
            <div style={{ fontSize: 28, fontWeight: 300, color: color.textOnLight.secondary, letterSpacing: '-0.02em' }}>—</div>
            <div style={{ ...S.label, marginTop: 6 }}>MRR</div>
            <div style={{ fontSize: type.label, color: color.textOnLight.faint, marginTop: 4 }}>Connect Stripe to unlock</div>
          </div>
          <div style={{ background: color.surfaceLight, border: `0.5px solid ${color.borderLight}`, borderRadius: 12, padding: '18px 20px' }}>
            <div style={{ fontSize: 28, fontWeight: 300, color: color.textOnLight.secondary, letterSpacing: '-0.02em' }}>—</div>
            <div style={{ ...S.label, marginTop: 6 }}>Avg. per client</div>
            <div style={{ fontSize: type.label, color: color.textOnLight.faint, marginTop: 4 }}>Connect Stripe to unlock</div>
          </div>
          <div style={{ background: color.surfaceLight, border: `0.5px solid ${color.borderLight}`, borderRadius: 12, padding: '18px 20px' }}>
            <div style={{ fontSize: 28, fontWeight: 300, color: color.textOnLight.secondary, letterSpacing: '-0.02em' }}>—</div>
            <div style={{ ...S.label, marginTop: 6 }}>Churn this month</div>
            <div style={{ fontSize: type.label, color: color.textOnLight.faint, marginTop: 4 }}>Connect Stripe to unlock</div>
          </div>
        </div>
      </div>

      {/* Engagement */}
      <div>
        <div style={S.sectionTitle}>Engagement</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
          <StatCard label="Weekly check-in rate" value={`${weeklyRate}%`}
            color={weeklyRate >= 80 ? color.forest : weeklyRate >= 50 ? color.gold : activeClients.length === 0 ? color.textOnLight.secondary : color.alert} />
          <StatCard label="Feedback response rate" value={`${responseRate}%`}
            color={responseRate >= 80 ? color.forest : responseRate >= 50 ? color.gold : totalCheckins === 0 ? color.textOnLight.secondary : color.alert} />
          <StatCard label="Total check-ins" value={totalCheckins} color={color.textOnLight.primary} />
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
                  <span style={badge('success')}>
                    {plan ? `${plan.label} plan` : 'No plan'} · {unlimited ? 'Unlimited' : `${limit} max`}
                  </span>
                </div>
                {!unlimited && (
                  <div style={{ background: color.surfaceSunken, borderRadius: 999, height: 6, overflow: 'hidden' }}>
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
        <div style={{ background: color.surfaceLight, border: `0.5px solid ${color.borderLight}`, borderRadius: 12, padding: 20,
          display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <div style={{ ...labelStyle(), color: color.forest }}>Current plan</div>
            <div style={{ fontSize: 22, fontWeight: 300, color: color.textOnLight.primary }}>
              {currentPlan.label} · <span style={{ fontFamily: font.mono }}>${currentPlan.price}/mo</span>
            </div>
            <div style={{ fontSize: type.label, color: color.textOnLight.faint, marginTop: 2 }}>
              {currentPlan.limit === Infinity ? 'Unlimited clients' : `${currentPlan.limit} client max`}
            </div>
          </div>
          <button onClick={handleManage} disabled={portalLoading}
            style={{ padding: '10px 18px', borderRadius: 8, border: `1px solid ${color.borderLight}`,
              background: 'transparent', color: color.textOnLight.primary, fontFamily: font.sans,
              fontSize: type.body, fontWeight: 500, cursor: portalLoading ? 'not-allowed' : 'pointer' }}>
            {portalLoading ? 'Opening...' : 'Manage subscription'}
          </button>
        </div>
      )}

      {error && <div style={{ fontSize: type.body, color: color.alert }}>{error}</div>}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
        {PLANS.filter(plan => plan.priceId).map(plan => {
          const isCurrent = profile?.subscription_tier === plan.id && subscribed
          return (
            <div key={plan.id} style={{ ...S.card,
              border: isCurrent ? `1.5px solid ${color.forest}` : `0.5px solid ${color.borderLight}` }}>
              <div style={S.label}>{plan.label}</div>
              <div style={{ fontSize: 28, fontWeight: 300, color: color.textOnLight.primary, marginTop: 6, fontFamily: font.mono }}>
                ${plan.price}<span style={{ fontSize: 13, color: color.textOnLight.secondary }}>/mo</span>
              </div>
              <div style={{ fontSize: type.body, color: color.textOnLight.secondary, marginTop: 6, marginBottom: 16 }}>
                {plan.limit === Infinity ? 'Unlimited clients' : `Up to ${plan.limit} clients`}
              </div>
              <button onClick={() => handleSubscribe(plan.id)} disabled={loadingTier === plan.id || isCurrent}
                style={plan.recommended && !isCurrent ? {
                  width: '100%', padding: '10px 0', borderRadius: 8, border: 'none',
                  background: color.forest, color: color.sage,
                  fontFamily: font.sans, fontSize: type.body, fontWeight: 500,
                  cursor: loadingTier === plan.id ? 'not-allowed' : 'pointer',
                } : {
                  width: '100%', padding: '10px 0', borderRadius: 8,
                  border: `1px solid ${isCurrent ? color.borderLight : color.textOnLight.secondary}`,
                  background: 'transparent',
                  color: isCurrent ? color.textOnLight.faint : color.textOnLight.secondary,
                  fontFamily: font.sans, fontSize: type.body, fontWeight: 500,
                  cursor: isCurrent ? 'default' : loadingTier === plan.id ? 'not-allowed' : 'pointer',
                }}>
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

// Guarded rather than assumed — Intl.supportedValuesOf shipped in every
// evergreen browser years ago (Chrome/Edge 99+, Firefox 119+, Safari 17+),
// but on the off chance it's unavailable this just yields an empty option
// list instead of throwing, so any dropdown built from it still renders
// (just with no options) rather than crashing. Shared by TabSettings' own
// timezone field and TabCalendar's pin-a-timezone control below.
const TIMEZONES = typeof Intl.supportedValuesOf === 'function' ? Intl.supportedValuesOf('timeZone') : []

// Local Y-M-D key — avoids the day-shifting that toISOString() causes by
// converting to UTC first, which matters since these are calendar dates,
// not instants.
function ymd(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function buildCalendarEvents(clients, checkins) {
  const events = {}
  const add = (dateKey, name, type, clientId) => {
    if (!events[dateKey]) events[dateKey] = []
    events[dateKey].push({ name, type, clientId })
  }

  clients.forEach(client => {
    if (!client.show_date) return
    const show = new Date(`${client.show_date}T00:00:00`)
    add(ymd(show), client.full_name || client.email, 'show', client.id)
    const peakDays = client.peak_week_days || 0
    for (let i = 1; i <= peakDays; i++) {
      const d = new Date(show)
      d.setDate(d.getDate() - i)
      add(ymd(d), client.full_name || client.email, 'peak', client.id)
    }
  })

  checkins.forEach(c => {
    if (!c.submitted_at) return
    add(ymd(new Date(c.submitted_at)), c.client_name, 'checkin', c.client_id)
  })

  return events
}

// Empty selection means "all clients" (the default, unfiltered state) —
// only actually filters events down once at least one client is picked.
function filterCalendarEvents(events, selectedClientIds) {
  if (selectedClientIds.size === 0) return events
  const filtered = {}
  Object.entries(events).forEach(([dateKey, dayEvents]) => {
    const kept = dayEvents.filter(e => selectedClientIds.has(e.clientId))
    if (kept.length > 0) filtered[dateKey] = kept
  })
  return filtered
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

// Dropdown + checkbox popover, same outside-click-to-close pattern as
// NotificationBell above. `selected` empty = "all clients", matching
// filterCalendarEvents' convention — this control never itself decides
// what "no selection" means, it just reports the raw Set back up.
const CalendarClientFilter = ({ clients, selected, onChange }) => {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const toggle = (id) => {
    const next = new Set(selected)
    if (next.has(id)) next.delete(id); else next.add(id)
    onChange(next)
  }

  const label = selected.size === 0 ? 'All clients' : `${selected.size} client${selected.size === 1 ? '' : 's'}`

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button type="button" onClick={() => setOpen(o => !o)}
        style={{ padding: '7px 12px', borderRadius: 8, border: `1px solid ${color.borderLight}`,
          background: color.surfaceLight, cursor: 'pointer', fontFamily: font.sans, fontSize: type.body,
          color: color.textOnLight.primary, display: 'flex', alignItems: 'center', gap: 6 }}>
        {label} <span style={{ fontSize: 10, color: color.textOnLight.faint }}>▾</span>
      </button>
      {open && (
        <div style={{ position: 'absolute', top: '110%', right: 0, zIndex: 20, minWidth: 220, maxHeight: 280,
          overflowY: 'auto', background: color.surfaceLight, border: `1px solid ${color.borderLight}`,
          borderRadius: 10, boxShadow: `0 4px 16px ${color.shadowSoft}`, padding: 8 }}>
          <button type="button" onClick={() => onChange(new Set())}
            style={{ width: '100%', textAlign: 'left', padding: '6px 8px', borderRadius: 6, border: 'none',
              background: 'transparent', cursor: 'pointer', fontFamily: font.sans, fontSize: type.body,
              fontWeight: selected.size === 0 ? 500 : 400, color: color.forest }}>
            All clients
          </button>
          <div style={{ borderTop: `0.5px solid ${color.borderSubtle}`, margin: '6px 0' }} />
          {clients.map(c => (
            <label key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px',
              borderRadius: 6, cursor: 'pointer', fontFamily: font.sans, fontSize: type.body,
              color: color.textOnLight.primary }}>
              <input type="checkbox" checked={selected.has(c.id)} onChange={() => toggle(c.id)} />
              {c.full_name || c.email}
            </label>
          ))}
        </div>
      )}
    </div>
  )
}

// "City, HH:MM" per zone, refreshed every 30s (a clock, not a stopwatch —
// no need for anything tighter). `removable` zones (pinned, not already
// covered by the roster) get a small × to unpin; roster-derived zones
// don't, since those aren't individually removable per the spec — only
// additions beyond the dynamic set are.
const TimezoneChip = ({ tz, now, onRemove }) => {
  const time = now.toLocaleTimeString('en-US', { timeZone: tz, hour: 'numeric', minute: '2-digit' })
  const city = tz.split('/').pop().replace(/_/g, ' ')
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 10px',
      borderRadius: 8, background: color.surfaceLight, border: `0.5px solid ${color.borderLight}` }}>
      <span style={{ fontSize: type.body, color: color.textOnLight.primary, fontWeight: 500 }}>{city}</span>
      <span style={{ fontSize: type.body, color: color.textOnLight.secondary, fontFamily: font.mono }}>{time}</span>
      {onRemove && (
        <button type="button" onClick={onRemove}
          style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: color.textOnLight.faint,
            fontSize: type.label, padding: 0, lineHeight: 1, marginLeft: 2 }}>✕</button>
      )}
    </div>
  )
}

// Add-a-pin control — same TIMEZONES source and <select> pattern as the
// Timezone field in TabSettings, rather than a second picker UI.
const AddTimezonePin = ({ excluded, onAdd }) => {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const options = TIMEZONES.filter(tz => !excluded.includes(tz))

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button type="button" onClick={() => setOpen(o => !o)}
        style={{ width: 30, height: 30, borderRadius: 8, border: `1px solid ${color.borderLight}`,
          background: color.surfaceLight, cursor: 'pointer', fontSize: 16, color: color.textOnLight.secondary }}>+</button>
      {open && (
        <div style={{ position: 'absolute', top: '110%', right: 0, zIndex: 20, minWidth: 240,
          background: color.surfaceLight, border: `1px solid ${color.borderLight}`, borderRadius: 10,
          boxShadow: `0 4px 16px ${color.shadowSoft}`, padding: 8 }}>
          <select autoFocus defaultValue="" onChange={e => { if (e.target.value) { onAdd(e.target.value); setOpen(false) } }}
            style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: `1px solid ${color.borderLight}`,
              fontFamily: font.sans, fontSize: type.body, outline: 'none', color: color.textOnLight.primary,
              background: color.surfaceLight, cursor: 'pointer' }}>
            <option value="" disabled>Pin a timezone...</option>
            {options.map(tz => <option key={tz} value={tz}>{tz}</option>)}
          </select>
        </div>
      )}
    </div>
  )
}

const TimezoneStrip = ({ profile, clients, onToggleNotify }) => {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30000)
    return () => clearInterval(id)
  }, [])

  const activeClients = clients.filter(c => !c.status || c.status === 'active')
  const dynamicZones = useMemo(() => {
    const raw = [profile?.timezone, ...activeClients.map(c => c.timezone)].filter(Boolean)
    return [...new Set(raw)]
  }, [profile?.timezone, activeClients])

  const pinned = profile?.pinned_timezones || []
  const pinnedOnly = pinned.filter(tz => !dynamicZones.includes(tz))

  const handleAdd = (tz) => {
    if (pinned.includes(tz)) return
    onToggleNotify('pinned_timezones', [...pinned, tz])
  }
  const handleRemove = (tz) => {
    onToggleNotify('pinned_timezones', pinned.filter(t => t !== tz))
  }

  if (dynamicZones.length === 0 && pinnedOnly.length === 0) return null

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
      {dynamicZones.map(tz => <TimezoneChip key={tz} tz={tz} now={now} />)}
      {pinnedOnly.map(tz => <TimezoneChip key={tz} tz={tz} now={now} onRemove={() => handleRemove(tz)} />)}
      <AddTimezonePin excluded={[...dynamicZones, ...pinnedOnly]} onAdd={handleAdd} />
    </div>
  )
}

const TabCalendar = ({ clients, checkins, profile, onToggleNotify }) => {
  const [viewDate, setViewDate] = useState(() => new Date())
  const [selectedDay, setSelectedDay] = useState(null)
  const [selectedClientIds, setSelectedClientIds] = useState(() => new Set())

  const allEvents = useMemo(() => buildCalendarEvents(clients, checkins), [clients, checkins])
  const events = useMemo(() => filterCalendarEvents(allEvents, selectedClientIds), [allEvents, selectedClientIds])
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

      <TimezoneStrip profile={profile} clients={clients} onToggleNotify={onToggleNotify} />

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
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          {Object.entries(CALENDAR_LABELS).map(([key, label]) => (
            <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: CALENDAR_COLORS[key] }} />
              <span style={{ fontSize: type.label, color: color.textOnLight.secondary }}>{label}</span>
            </div>
          ))}
          <CalendarClientFilter clients={clients} selected={selectedClientIds} onChange={setSelectedClientIds} />
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
                  <span style={{ fontSize: type.label, color: color.textOnLight.primary, fontWeight: isToday ? 500 : 400, fontFamily: font.mono }}>{day.getDate()}</span>
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
          <div style={{ fontSize: type.body, color: color.textOnLight.secondary }}>
            {clients.length === 0
              ? 'No clients yet — invite one to start seeing check-ins, peak weeks, and show days here.'
              : 'No upcoming events yet. They\'ll show up once a client sets a show date (in their Settings) and you set their peak week (in Targets).'}
          </div>
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
  { id: 'dashboard', label: 'Dashboard', Icon: DashboardIcon },
  { id: 'clients', label: 'Clients', Icon: ClientsIcon },
  { id: 'requests', label: 'Requests', Icon: RequestsIcon },
  { id: 'checkins', label: 'Check-ins', Icon: CheckInsIcon },
  { id: 'calendar', label: 'Calendar', Icon: CalendarIcon },
  { id: 'messages', label: 'Messages', Icon: MessagesIcon },
  { id: 'overview', label: 'Overview', Icon: OverviewIcon },
  { id: 'billing', label: 'Billing', Icon: BillingIcon },
  { id: 'settings', label: 'Settings', Icon: GearIcon },
]

// Sidebar-only grouping (vertical NavList) — the top-tabs layout and mobile
// bottom bar both stay a single flat row, unaffected. Minimal Vercel-style
// approach: spacing + a hairline rule between groups, no text group labels.
const NAV_GROUPS = [
  ['dashboard', 'clients', 'requests', 'overview'],
  ['checkins', 'calendar', 'messages'],
  ['billing', 'settings'],
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
      border: `0.5px solid ${color.borderLight}`, transition: 'left 0.2s ease' }} />
  </div>
)

const NAV_LAYOUTS = [
  { value: 'sidebar', label: 'Sidebar', desc: 'Nav on the left, always visible' },
  { value: 'top_tabs', label: 'Top tabs', desc: 'Nav across the top, full-width content' },
]

const APPEARANCE_OPTIONS = [
  { value: 'light', label: 'Light', desc: 'Always light' },
  { value: 'dark', label: 'Dark', desc: 'Always dark' },
  { value: 'system', label: 'System', desc: 'Match your device' },
]

const TabSettings = ({ profile, onToggleNotify }) => {
  const [savingKey, setSavingKey] = useState(null)
  const [slugInput, setSlugInput] = useState(profile?.slug || '')
  const [slugError, setSlugError] = useState(null)
  const [copied, setCopied] = useState(false)
  const [timezone, setTimezone] = useState(profile?.timezone || '')

  useEffect(() => { setSlugInput(profile?.slug || '') }, [profile?.slug])
  useEffect(() => { setTimezone(profile?.timezone || '') }, [profile?.timezone])

  const handleTimezoneChange = async (value) => {
    setTimezone(value)
    setSavingKey('timezone')
    await onToggleNotify('timezone', value || null)
    setSavingKey(null)
  }

  const handleToggle = async (key, value) => {
    setSavingKey(key)
    const result = await onToggleNotify(key, value)
    // App.js's [data-appearance]-setting effect reads its own independently-
    // fetched profile state, not this component's — a saved appearance
    // change won't actually repaint anything until that reloads. The reload
    // itself is genuinely necessary, but activeTab is plain useState (never
    // reflected in the URL), so without stashing it a reload always drops
    // back to the 'dashboard' default — restored in CoachDashboard()'s own
    // initial state below.
    if (key === 'appearance' && result?.ok) {
      try { sessionStorage.setItem('purema_restore_tab', 'settings') } catch {}
      window.location.reload()
      return
    }
    setSavingKey(null)
  }

  const handleSlugSave = async (e) => {
    e.preventDefault()
    setSlugError(null)
    const normalized = slugInput.trim().toLowerCase().replace(/[^a-z0-9-]/g, '')
    if (!normalized) {
      setSlugError('Enter a URL-safe username (letters, numbers, hyphens).')
      return
    }
    setSavingKey('slug')
    const result = await onToggleNotify('slug', normalized)
    setSavingKey(null)
    if (result && !result.ok) setSlugError(result.message)
  }

  const applyLink = profile?.slug ? `${window.location.origin}/apply/${profile.slug}` : null

  const handleCopyLink = () => {
    navigator.clipboard.writeText(applyLink)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const navLayout = profile?.nav_layout === 'top_tabs' ? 'top_tabs' : 'sidebar'

  return (
    <div style={{ maxWidth: 480, display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ ...S.card, display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={badge('info')}>{profile?.role === 'coach' ? 'Coach account' : 'Account'}</span>
        <span style={{ fontSize: type.label, color: color.textOnLight.faint }}>{profile?.email}</span>
      </div>

      <div style={S.card}>
        <div style={S.sectionTitle}>Application link</div>
        <div style={{ fontSize: type.body, color: color.textOnLight.secondary, marginBottom: 16 }}>
          Share this link so prospective clients can apply to work with you. Approved applications land in your Requests tab.
        </div>
        <form onSubmit={handleSlugSave} style={{ display: 'flex', gap: 8 }}>
          <input
            type="text"
            value={slugInput}
            onChange={(e) => setSlugInput(e.target.value)}
            placeholder="yourname"
            style={{ flex: 1, padding: '10px 12px', borderRadius: 8,
              border: `1px solid ${color.borderLight}`, fontFamily: font.sans,
              fontSize: type.body, outline: 'none', color: color.textOnLight.primary }}
          />
          <button type="submit" disabled={savingKey === 'slug'}
            style={{ padding: '10px 18px', borderRadius: 8, border: 'none',
              background: savingKey === 'slug' ? color.textOnLight.faint : color.forest, color: color.textOnDark.primary,
              fontFamily: font.sans, fontWeight: 500, cursor: savingKey === 'slug' ? 'not-allowed' : 'pointer',
              fontSize: type.body, whiteSpace: 'nowrap' }}>
            {savingKey === 'slug' ? 'Saving...' : 'Save'}
          </button>
        </form>
        {slugError && <p style={{ color: color.alert, marginTop: 8, fontSize: type.body }}>{slugError}</p>}
        {applyLink && (
          <div style={{ marginTop: 12, display: 'flex', gap: 8, alignItems: 'center' }}>
            <code style={{ fontSize: type.label, wordBreak: 'break-all', flex: 1, color: color.textOnLight.secondary,
              fontFamily: font.mono }}>
              {applyLink}
            </code>
            <button onClick={handleCopyLink}
              style={{ padding: '6px 10px', borderRadius: 6, border: `1px solid ${color.forest}`,
                background: 'transparent', color: color.forest, fontSize: type.label,
                cursor: 'pointer', whiteSpace: 'nowrap' }}>
              {copied ? 'Copied!' : 'Copy'}
            </button>
          </div>
        )}
      </div>

      <div style={S.card}>
        <div style={S.sectionTitle}>Timezone</div>
        <div style={{ fontSize: type.body, color: color.textOnLight.secondary, marginBottom: 16 }}>
          Used for scheduling and dates across your account.
        </div>
        <select value={timezone} onChange={e => handleTimezoneChange(e.target.value)}
          disabled={savingKey === 'timezone'}
          style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: `1px solid ${color.borderLight}`,
            fontFamily: font.sans, fontSize: type.body, outline: 'none', color: color.textOnLight.primary,
            background: color.surfaceLight, cursor: savingKey === 'timezone' ? 'not-allowed' : 'pointer' }}>
          <option value="">Not set</option>
          {TIMEZONES.map(tz => <option key={tz} value={tz}>{tz}</option>)}
        </select>
      </div>

      <div style={S.card}>
        <div style={S.sectionTitle}>Navigation</div>
        <div style={{ fontSize: type.body, color: color.textOnLight.secondary, marginBottom: 16 }}>
          Choose how the dashboard nav is laid out on desktop. Mobile stays the same either way.
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {NAV_LAYOUTS.map(opt => (
            <button key={opt.value} type="button" onClick={() => handleToggle('nav_layout', opt.value)}
              disabled={savingKey === 'nav_layout'}
              style={{ flex: 1, textAlign: 'left', padding: '12px 14px', borderRadius: 8, cursor: 'pointer',
                border: `1px solid ${navLayout === opt.value ? color.forest : color.borderLight}`,
                background: navLayout === opt.value ? color.sage : 'transparent' }}>
              <div style={{ fontSize: type.body, fontWeight: 500, color: color.textOnLight.primary }}>{opt.label}</div>
              <div style={{ fontSize: type.label, color: color.textOnLight.secondary, marginTop: 2 }}>{opt.desc}</div>
            </button>
          ))}
        </div>
      </div>

      <div style={S.card}>
        <div style={S.sectionTitle}>Appearance</div>
        <div style={{ fontSize: type.body, color: color.textOnLight.secondary, marginBottom: 16 }}>
          Choose light or dark, or match your device automatically.
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {APPEARANCE_OPTIONS.map(opt => (
            <button key={opt.value} type="button" onClick={() => handleToggle('appearance', opt.value)}
              disabled={savingKey === 'appearance'}
              style={{ flex: 1, textAlign: 'left', padding: '12px 14px', borderRadius: 8, cursor: 'pointer',
                border: `1px solid ${(profile?.appearance || 'system') === opt.value ? color.forest : color.borderLight}`,
                background: (profile?.appearance || 'system') === opt.value ? color.sage : 'transparent' }}>
              <div style={{ fontSize: type.body, fontWeight: 500, color: color.textOnLight.primary }}>{opt.label}</div>
              <div style={{ fontSize: type.label, color: color.textOnLight.secondary, marginTop: 2 }}>{opt.desc}</div>
            </button>
          ))}
        </div>
      </div>

      <div style={S.card}>
        <div style={S.sectionTitle}>Notifications</div>
        <div style={{ fontSize: type.body, color: color.textOnLight.secondary, marginBottom: 16 }}>
          Choose what you want to be notified about. (Delivery — push, email, or WhatsApp — isn't built yet; this just saves your preference.)
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '16px 0', borderBottom: `0.5px solid ${color.borderSubtle}` }}>
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
    </div>
  )
}

// ─── Main shell ───────────────────────────────────────────────────────────────

export default function CoachDashboard() {
  // Restores the tab an appearance-change reload was stashed from (see
  // TabSettings' handleToggle) — reads once and clears immediately so a
  // normal, non-reload page load still lands on the real default.
  const [activeTab, setActiveTab] = useState(() => {
    try {
      const restore = sessionStorage.getItem('purema_restore_tab')
      if (restore) { sessionStorage.removeItem('purema_restore_tab'); return restore }
    } catch {}
    return 'dashboard'
  })
  const [checkins, setCheckins] = useState([])
  const [clients, setClients] = useState([])
  const [applications, setApplications] = useState([])
  const [profile, setProfile] = useState(null)
  const [messages, setMessages] = useState([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState(null)
  const [portalLoading, setPortalLoading] = useState(false)
  const [portalError, setPortalError] = useState(null)
  const [criticalLoadError, setCriticalLoadError] = useState(null)
  const [dataLoadError, setDataLoadError] = useState(null)
  const [showInviteModal, setShowInviteModal] = useState(false)
  const [focusClientId, setFocusClientId] = useState(null)
  // Pure UI preference, not account data — localStorage is enough, no need
  // to sync across devices.
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    try { return localStorage.getItem('purema_sidebar_collapsed') === 'true' } catch { return false }
  })

  useEffect(() => {
    try { localStorage.setItem('purema_sidebar_collapsed', String(sidebarCollapsed)) } catch {}
  }, [sidebarCollapsed])

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
    const [checkinsRes, clientsRes, profileRes, messagesRes, applicationsRes] = await Promise.all([
      supabase.from('check_ins').select('*').eq('coach_id', id).order('submitted_at', { ascending: false }),
      supabase.from('profiles').select('*').eq('coach_id', id),
      supabase.from('profiles').select('*').eq('id', id).single(),
      supabase.from('messages').select('*').eq('coach_id', id).order('created_at', { ascending: true }),
      supabase.from('client_applications').select('*').eq('coach_id', id).order('submitted_at', { ascending: false }),
    ])

    // Profile drives billing/access gating below, so a failure here can't
    // just be swallowed — nothing meaningful can render without it.
    if (profileRes.error) {
      setCriticalLoadError("Couldn't load your account — try refreshing.")
      setLoading(false)
      return
    }
    setProfile(profileRes.data)

    const secondaryFailed = checkinsRes.error || clientsRes.error || messagesRes.error || applicationsRes.error
    setDataLoadError(secondaryFailed ? "Couldn't load some of your data — try refreshing." : null)

    if (!checkinsRes.error) setCheckins(checkinsRes.data || [])
    if (!clientsRes.error) setClients(clientsRes.data || [])
    if (!messagesRes.error) setMessages(messagesRes.data || [])
    if (!applicationsRes.error) setApplications(applicationsRes.data || [])
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
    notify('message', clientId)
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
    if (error || !data) {
      return { ok: false, message: error?.message || "Update didn't apply — check permissions." }
    }
    setProfile(data)
    return { ok: true }
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

  // Reuses the same invite-generation logic InviteClient uses, so an
  // approved applicant lands in the identical accept-invite path a
  // manually-invited client does — no second implementation of invite creation.
  const handleApproveApplication = async (application) => {
    const invite = await createInvite(profile.id, application.email, 'client')
    if (!invite.ok) return { ok: false, message: invite.message }

    const { data, error } = await supabase
      .from('client_applications')
      .update({ status: 'approved' })
      .eq('id', application.id)
      .select()
      .single()
    if (error || !data) {
      return { ok: false, message: error?.message || "Update didn't apply — check permissions." }
    }
    setApplications(prev => prev.map(a => a.id === data.id ? data : a))
    return { ok: true, link: invite.link }
  }

  const handleDeclineApplication = async (application) => {
    const { data, error } = await supabase
      .from('client_applications')
      .update({ status: 'declined' })
      .eq('id', application.id)
      .select()
      .single()
    if (error || !data) {
      return { ok: false, message: error?.message || "Update didn't apply — check permissions." }
    }
    setApplications(prev => prev.map(a => a.id === data.id ? data : a))
    return { ok: true }
  }

  const pendingCount = checkins.filter(c => !c.coach_feedback).length
  const pendingApplicationsCount = applications.filter(a => a.status === 'pending').length
  const attentionItems = useMemo(() => buildAttentionQueue(clients, checkins), [clients, checkins])
  const attentionCount = attentionItems.length
  const attentionClientIds = useMemo(() => new Set(attentionItems.map(i => i.client.id)), [attentionItems])
  const activeClientsCount = clients.filter(c => !c.status || c.status === 'active').length
  const atInviteLimit = activeClientsCount >= tierLimit(profile?.subscription_tier)

  const goToClient = (clientId) => {
    setActiveTab('clients')
    setFocusClientId(clientId)
  }

  // Green = active and not flagged in the attention queue, amber = flagged
  // (feedback needed or gone quiet — same signal buildAttentionQueue already
  // computes for the dashboard's "Needs your attention" list), gray = paused.
  const clientDotColor = (client) => {
    if (client.status === 'paused') return color.textOnLight.faint
    if (attentionClientIds.has(client.id)) return color.gold
    return color.forest
  }

  const MINI_LIST_VISIBLE = 6

  const MiniClientList = ({ collapsed }) => {
    const [expanded, setExpanded] = useState(false)
    const [hoveredId, setHoveredId] = useState(null)
    const visible = clients.filter(c => c.status !== 'archived')
    const shown = expanded ? visible : visible.slice(0, MINI_LIST_VISIBLE)
    const hiddenCount = visible.length - shown.length

    if (visible.length === 0) return null

    return (
      <div style={{ marginTop: 20, paddingTop: 16, borderTop: `0.5px solid ${color.borderLight}` }}>
        {!collapsed && (
          <div style={{ ...labelStyle(), padding: '0 4px', marginBottom: 8 }}>Clients</div>
        )}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {shown.map(client => {
            const initials = (client.full_name || client.email || '?')
              .split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
            return (
              <button key={client.id} onClick={() => goToClient(client.id)}
                onMouseEnter={() => setHoveredId(client.id)} onMouseLeave={() => setHoveredId(null)}
                style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 8,
                  justifyContent: collapsed ? 'center' : 'flex-start',
                  padding: collapsed ? '6px 0' : '6px 8px', border: 'none', background: 'transparent',
                  borderRadius: 8, cursor: 'pointer', fontFamily: font.sans, textAlign: 'left', width: '100%' }}>
                <span style={{ position: 'relative', width: 24, height: 24, borderRadius: '50%', background: color.sage,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                  fontSize: 10, fontWeight: 500, color: color.forest }}>
                  {initials}
                  <span style={{ position: 'absolute', bottom: -1, right: -1, width: 7, height: 7, borderRadius: '50%',
                    background: clientDotColor(client), border: `1.5px solid ${color.surfaceNav}` }} />
                </span>
                {!collapsed && (
                  <span style={{ fontSize: type.label, color: color.textOnLight.primary,
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {client.full_name || client.email}
                  </span>
                )}
                <IconTooltip label={client.full_name || client.email} show={collapsed && hoveredId === client.id} />
              </button>
            )
          })}
        </div>
        {hiddenCount > 0 && (
          <button onClick={() => setExpanded(true)}
            style={{ display: 'flex', alignItems: 'center', justifyContent: collapsed ? 'center' : 'flex-start',
              width: '100%', marginTop: 4, padding: collapsed ? '6px 0' : '6px 8px', border: 'none',
              background: 'transparent', borderRadius: 8, cursor: 'pointer', fontFamily: font.mono,
              fontSize: type.label, color: color.textOnLight.secondary }}>
            {collapsed ? `+${hiddenCount}` : `Show ${hiddenCount} more`}
          </button>
        )}
        {expanded && visible.length > MINI_LIST_VISIBLE && !collapsed && (
          <button onClick={() => setExpanded(false)}
            style={{ display: 'block', width: '100%', marginTop: 4, padding: '6px 8px', border: 'none',
              background: 'transparent', borderRadius: 8, cursor: 'pointer', fontFamily: font.mono,
              fontSize: type.label, color: color.textOnLight.secondary, textAlign: 'left' }}>
            Show less
          </button>
        )}
      </div>
    )
  }

  // `collapsed` only ever applies to the vertical sidebar render (there's
  // nothing to collapse in the horizontal top-tabs layout) — badges stay
  // visible either way, just repositioned to the icon's corner instead of
  // inline after a now-hidden label, and a hover tooltip stands in for the
  // hidden label per the icon-only readability requirement.
  const NavList = ({ vertical, collapsed = false }) => {
    const [hoveredTab, setHoveredTab] = useState(null)

    const badgeFor = (tab) => {
      if (tab.id === 'requests' && pendingApplicationsCount > 0) return { count: pendingApplicationsCount, bg: badge('warning').background, fg: badge('warning').color }
      if (tab.id === 'checkins' && pendingCount > 0) return { count: pendingCount, bg: badge('warning').background, fg: badge('warning').color }
      if (tab.id === 'messages' && unreadMessageCount > 0) return { count: unreadMessageCount, bg: color.forest, fg: color.sage }
      return null
    }

    const renderTab = (tab) => {
      const badgeInfo = badgeFor(tab)
      return (
        <button key={tab.id} onClick={() => setActiveTab(tab.id)}
          onMouseEnter={() => setHoveredTab(tab.id)}
          onMouseLeave={() => setHoveredTab(null)}
          style={{
            position: 'relative',
            display: 'flex', alignItems: 'center', gap: 10,
            justifyContent: collapsed ? 'center' : 'flex-start',
            padding: vertical ? (collapsed ? '10px 0' : '10px 12px') : '8px 14px',
            border: 'none', textAlign: 'left', cursor: 'pointer',
            fontFamily: font.sans, fontSize: type.body,
            transition: 'all 0.15s ease',
            ...navItemStyle(activeTab === tab.id),
          }}>
          <span style={{ width: 18, height: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <tab.Icon />
          </span>
          {!collapsed && tab.label}
          {!collapsed && badgeInfo && (
            <span style={{ marginLeft: 6, background: badgeInfo.bg, color: badgeInfo.fg,
              fontSize: type.label, borderRadius: 999, padding: '1px 6px',
              fontFamily: font.mono, verticalAlign: 'middle' }}>
              {badgeInfo.count}
            </span>
          )}
          {collapsed && badgeInfo && (
            <span style={{ position: 'absolute', top: 2, right: 10, background: badgeInfo.bg, color: badgeInfo.fg,
              fontSize: 9, borderRadius: 999, padding: '1px 4px', minWidth: 14, textAlign: 'center',
              fontFamily: font.mono, lineHeight: 1.4 }}>
              {badgeInfo.count}
            </span>
          )}
          <IconTooltip label={tab.label} show={collapsed && hoveredTab === tab.id} />
        </button>
      )
    }

    if (!vertical) {
      return (
        <nav style={{ display: 'flex', flexDirection: 'row', gap: 4 }}>
          {TABS.map(renderTab)}
        </nav>
      )
    }

    return (
      <nav style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {NAV_GROUPS.map((groupIds, i) => (
          <div key={i} style={i > 0 ? { borderTop: `0.5px solid ${color.borderLight}`, marginTop: 12, paddingTop: 12 } : undefined}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {groupIds
                .map(id => TABS.find(t => t.id === id))
                .filter(Boolean)
                .map(renderTab)}
            </div>
          </div>
        ))}
      </nav>
    )
  }

  const AttentionAlert = ({ collapsed = false }) => {
    const [hovered, setHovered] = useState(false)
    if (attentionCount === 0) return null
    const label = `${attentionCount} need${attentionCount === 1 ? 's' : ''} attention`
    return (
      <div style={{ position: 'relative', display: 'flex', alignItems: 'center',
        justifyContent: collapsed ? 'center' : 'flex-start', gap: 6, cursor: 'pointer' }}
        onClick={() => setActiveTab('dashboard')}
        onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}>
        <div style={{ width: 7, height: 7, borderRadius: '50%', background: color.alert, flexShrink: 0 }} />
        {!collapsed && (
          <span style={{ fontSize: type.label, color: color.alert, fontFamily: font.mono, whiteSpace: 'nowrap' }}>
            {label}
          </span>
        )}
        <IconTooltip label={label} show={collapsed && hovered} />
      </div>
    )
  }

  // Replaces the old standalone Sign Out button everywhere it appeared —
  // Settings/Reset Password/Sign Out all live in one place now instead of
  // sign-out being its own floating action.
  const ProfileMenu = () => {
    const [open, setOpen] = useState(false)
    const [resetSent, setResetSent] = useState(false)
    const menuRef = useRef(null)

    useEffect(() => {
      const handler = (e) => { if (menuRef.current && !menuRef.current.contains(e.target)) setOpen(false) }
      document.addEventListener('mousedown', handler)
      return () => document.removeEventListener('mousedown', handler)
    }, [])

    const initials = (profile?.full_name || profile?.email || '?')
      .split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)

    const handleReset = async () => {
      await supabase.auth.resetPasswordForEmail(profile.email, {
        redirectTo: `${window.location.origin}/reset-password`,
      })
      setResetSent(true)
      setTimeout(() => { setResetSent(false); setOpen(false) }, 1500)
    }

    const MenuItem = ({ onClick, children, danger }) => (
      <button onClick={onClick}
        style={{ display: 'block', width: '100%', textAlign: 'left', padding: '10px 14px', border: 'none',
          background: 'transparent', cursor: 'pointer', fontFamily: font.sans, fontSize: type.body,
          color: danger ? color.alert : color.textOnLight.primary, transition: 'background 0.1s ease' }}
        onMouseEnter={e => { e.currentTarget.style.background = color.bone }}
        onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}>
        {children}
      </button>
    )

    return (
      <div ref={menuRef} style={{ position: 'relative', flexShrink: 0 }}>
        <button onClick={() => setOpen(o => !o)}
          style={{ width: 34, height: 34, borderRadius: '50%', background: color.sage, border: 'none',
            display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
            fontSize: type.label, fontWeight: 500, color: color.forest, fontFamily: font.sans }}>
          {initials}
        </button>
        {open && (
          <div style={{ position: 'absolute', top: 'calc(100% + 8px)', right: 0, minWidth: 190,
            background: color.surfaceLight, borderRadius: 10, border: `0.5px solid ${color.borderLight}`,
            zIndex: 300, overflow: 'hidden' }}>
            <div style={{ padding: '10px 14px', borderBottom: `0.5px solid ${color.borderLight}` }}>
              <div style={{ fontSize: type.body, fontWeight: 500, color: color.textOnLight.primary,
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {profile?.full_name || 'Account'}
              </div>
              <div style={{ fontSize: type.label, color: color.textOnLight.secondary, marginTop: 2,
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {profile?.email}
              </div>
            </div>
            <MenuItem onClick={() => { setActiveTab('settings'); setOpen(false) }}>Settings</MenuItem>
            <MenuItem onClick={handleReset}>{resetSent ? 'Reset link sent ✓' : 'Reset password'}</MenuItem>
            <MenuItem danger onClick={() => supabase.auth.signOut()}>Sign out</MenuItem>
          </div>
        )}
      </div>
    )
  }

  const Logo = () => (
    <div onClick={() => setActiveTab('dashboard')}
      style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
      <Mark size={20} />
      <span style={{ ...displayStyle, fontSize: 18, color: color.textOnLight.primary }}>
        purema<span style={{ color: color.forest }}>.</span>
      </span>
    </div>
  )

  // One unified feed across every alert type this dashboard already tracks
  // separately elsewhere (unread messages, pending applications, a failed
  // subscription payment, check-ins awaiting feedback) — same underlying
  // data each already has its own badge/count for, just merged and
  // timestamp-sorted here rather than re-fetched.
  const notifications = useMemo(() => {
    const items = []
    messages.filter(m => m.sender_id !== profile?.id && !m.read_at).forEach(m => {
      const client = clients.find(c => c.id === m.client_id)
      items.push({
        id: `msg-${m.id}`, ts: m.created_at,
        label: `New message from ${client?.full_name || 'a client'}`,
        sub: m.body,
        onSelect: () => setActiveTab('messages'),
      })
    })
    applications.filter(a => a.status === 'pending').forEach(a => {
      items.push({
        id: `app-${a.id}`, ts: a.submitted_at,
        label: `New application from ${a.name}`,
        sub: a.email,
        onSelect: () => setActiveTab('requests'),
      })
    })
    if (isPastDue(profile)) {
      items.push({
        id: 'payment-failed', ts: profile?.payment_failed_at || profile?.created_at,
        label: 'Your last payment failed',
        sub: 'Update your payment method to avoid losing access.',
        onSelect: () => setActiveTab('billing'),
      })
    }
    // Backfilled history was never a live submission needing review — same
    // exclusion the "time saved" stat already applies.
    checkins.filter(c => !c.coach_feedback && !c.imported_backfill).forEach(c => {
      items.push({
        id: `checkin-${c.id}`, ts: c.submitted_at,
        label: `${c.client_name}'s Week ${c.week_number} check-in needs review`,
        sub: null,
        onSelect: () => setSelected(c),
      })
    })
    return items.sort((a, b) => new Date(b.ts) - new Date(a.ts))
  }, [messages, applications, checkins, profile, clients])

  const NotificationBell = () => {
    const [open, setOpen] = useState(false)
    const ref = useRef(null)

    useEffect(() => {
      const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
      document.addEventListener('mousedown', handler)
      return () => document.removeEventListener('mousedown', handler)
    }, [])

    return (
      <div ref={ref} style={{ position: 'relative', flexShrink: 0 }}>
        <button onClick={() => setOpen(o => !o)}
          style={{ position: 'relative', width: 34, height: 34, borderRadius: '50%', border: 'none',
            background: 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', color: color.textOnLight.secondary }}>
          <BellIcon />
          {notifications.length > 0 && (
            <span style={{ position: 'absolute', top: 2, right: 2, background: badge('warning').background, color: badge('warning').color,
              fontSize: 9, borderRadius: 999, padding: '1px 4px', minWidth: 14, textAlign: 'center',
              fontFamily: font.mono, lineHeight: 1.4 }}>
              {notifications.length}
            </span>
          )}
        </button>
        {open && (
          <div style={{ position: 'absolute', top: 'calc(100% + 8px)', right: 0, width: 320, maxHeight: 400,
            overflowY: 'auto', background: color.surfaceLight, borderRadius: 10, border: `0.5px solid ${color.borderLight}`,
            zIndex: 300 }}>
            <div style={{ padding: '10px 14px', borderBottom: `0.5px solid ${color.borderLight}`,
              ...labelStyle(), marginBottom: 0 }}>
              Notifications
            </div>
            {notifications.length === 0 ? (
              <div style={{ padding: '24px 14px', textAlign: 'center', color: color.textOnLight.secondary, fontSize: type.body }}>
                You're all caught up.
              </div>
            ) : notifications.map(n => (
              <button key={n.id} onClick={() => { n.onSelect(); setOpen(false) }}
                style={{ display: 'block', width: '100%', textAlign: 'left', padding: '10px 14px', border: 'none',
                  borderBottom: `0.5px solid ${color.borderLight}`, background: 'transparent', cursor: 'pointer',
                  fontFamily: font.sans }}
                onMouseEnter={e => { e.currentTarget.style.background = color.bone }}
                onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}>
                <div style={{ fontSize: type.body, color: color.textOnLight.primary }}>{n.label}</div>
                {n.sub && (
                  <div style={{ fontSize: type.label, color: color.textOnLight.secondary, marginTop: 2,
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {n.sub}
                  </div>
                )}
                <div style={{ fontSize: type.label, color: color.textOnLight.faint, fontFamily: font.mono, marginTop: 4 }}>
                  {timeAgo(n.ts)}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    )
  }

  if (!loading && criticalLoadError) {
    return (
      <div style={{ minHeight: '100vh', background: color.bone, display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', padding: 24, fontFamily: font.sans, gap: 16, textAlign: 'center' }}>
        <Mark size={40} />
        <div style={{ fontSize: type.bodyLg, fontWeight: 500, color: color.textOnLight.primary }}>{criticalLoadError}</div>
        <button onClick={() => window.location.reload()}
          style={{ padding: '10px 22px', borderRadius: 8, border: 'none', background: color.forest, color: color.sage,
            fontFamily: font.sans, fontSize: type.body, fontWeight: 500, cursor: 'pointer' }}>
          Try again
        </button>
      </div>
    )
  }

  // Admin-controlled account status — separate from (and takes priority
  // over) the Stripe-driven gate below, since a manual admin action should
  // never be masked by a payment-status screen. No "update payment method"
  // button here; this isn't a billing problem.
  if (!loading && (isAdminSuspended(profile) || isDeleted(profile))) {
    return (
      <div style={{ minHeight: '100vh', background: color.bone, display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', padding: 24, fontFamily: font.sans, gap: 20, textAlign: 'center' }}>
        <Mark size={40} />
        <div style={{ ...displayStyle, fontSize: type.heading, color: color.textOnLight.primary, maxWidth: 480 }}>
          Your account has been suspended
        </div>
        <div style={{ fontSize: type.body, color: color.textOnLight.secondary, maxWidth: 420, lineHeight: 1.6 }}>
          {profile?.admin_suspended_reason || 'Access to your dashboard has been paused by Purema. Contact support if you believe this is a mistake.'}
        </div>
        <button onClick={() => supabase.auth.signOut()}
          style={{ fontSize: type.label, color: color.textOnLight.faint, fontFamily: font.mono, letterSpacing: '0.1em',
            background: 'transparent', border: 'none', cursor: 'pointer' }}>
          SIGN OUT
        </button>
      </div>
    )
  }

  // Payment retries were exhausted (or the subscription was canceled outright)
  // — block everything except a read-only screen pointing back to Stripe's
  // billing portal. Nothing is deleted; this just gates access until the
  // coach fixes their card and the webhook flips payment_status back.
  if (!loading && isSuspended(profile)) {
    return (
      <div style={{ minHeight: '100vh', background: color.bone, display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', padding: 24, fontFamily: font.sans, gap: 20, textAlign: 'center' }}>
        <Mark size={40} />
        <div style={{ ...displayStyle, fontSize: type.heading, color: color.textOnLight.primary, maxWidth: 480 }}>
          Your subscription is past due
        </div>
        <div style={{ fontSize: type.body, color: color.textOnLight.secondary, maxWidth: 420, lineHeight: 1.6 }}>
          Payment retries were unsuccessful, so access to your dashboard is paused. Nothing has been deleted —
          update your payment method to pick up right where you left off.
        </div>
        {portalError && <div style={{ fontSize: type.body, color: color.alert }}>{portalError}</div>}
        <button onClick={openBillingPortal} disabled={portalLoading}
          style={{ padding: '12px 24px', borderRadius: 8, border: 'none',
            background: portalLoading ? color.textOnLight.faint : color.forest, color: color.sage,
            fontFamily: font.sans, fontSize: type.body, fontWeight: 500,
            cursor: portalLoading ? 'not-allowed' : 'pointer' }}>
          {portalLoading ? 'Opening...' : 'Update payment method'}
        </button>
        <button onClick={() => supabase.auth.signOut()}
          style={{ fontSize: type.label, color: color.textOnLight.faint, fontFamily: font.mono, letterSpacing: '0.1em',
            background: 'transparent', border: 'none', cursor: 'pointer' }}>
          SIGN OUT
        </button>
      </div>
    )
  }

  const navLayout = profile?.nav_layout === 'top_tabs' ? 'top_tabs' : 'sidebar'
  const isCollapsedSidebar = navLayout === 'sidebar' && sidebarCollapsed

  const InviteButton = ({ compact = false }) => (
    <button onClick={() => setShowInviteModal(true)}
      style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
        padding: compact ? 0 : '8px 14px', width: compact ? 34 : 'auto', height: compact ? 34 : 'auto',
        borderRadius: compact ? '50%' : 8, border: 'none', background: color.forest, color: color.sage,
        fontFamily: font.sans, fontSize: type.label, fontWeight: 500, cursor: 'pointer',
        whiteSpace: 'nowrap', flexShrink: 0 }}>
      <PlusIcon />{!compact && ' Invite Client'}
    </button>
  )

  const AccountIdentity = ({ collapsed }) => {
    const displayName = profile?.full_name || profile?.email || 'Coach'
    const currentPlan = planById(profile?.subscription_tier)
    const tierLabel = isSubscribed(profile) && currentPlan ? currentPlan.label : (planById('free')?.label || 'Free')

    if (collapsed) return null

    return (
      <div style={{ padding: '0 4px', marginBottom: 20, display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div style={{ fontFamily: font.sans, fontSize: type.body, fontWeight: 500, color: color.textOnLight.primary,
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {displayName}
        </div>
        <span style={{ ...badge('info'), width: 'fit-content' }}>{tierLabel}</span>
      </div>
    )
  }

  return (
    <div className={navLayout === 'top_tabs' ? 'purema-shell purema-shell--top-tabs' : 'purema-shell'}
      data-sidebar={isCollapsedSidebar ? 'collapsed' : undefined}
      style={{ background: color.bone, fontFamily: font.sans }}>

      {/* Desktop sidebar nav (900px+) — the default layout. Nav only —
          search and account actions live in the content-column top bar
          below instead, not inside the sidebar. Collapses to icon-only
          width via the hamburger toggle in that top bar. */}
      {navLayout === 'sidebar' && (
        <div className="purema-nav-desktop" style={{ flexDirection: 'column', justifyContent: 'space-between',
          background: color.surfaceNav, borderRight: `0.5px solid ${color.borderLight}`,
          padding: sidebarCollapsed ? '28px 10px' : '28px 20px',
          position: 'sticky', top: 0, height: '100vh', boxSizing: 'border-box', overflowY: 'auto' }}>
          <div>
            <div style={{ padding: '0 4px', marginBottom: 20, display: 'flex',
              justifyContent: sidebarCollapsed ? 'center' : 'flex-start' }}>
              {sidebarCollapsed ? (
                <div onClick={() => setActiveTab('dashboard')} style={{ cursor: 'pointer' }}><Mark size={20} /></div>
              ) : <Logo />}
            </div>
            <AccountIdentity collapsed={sidebarCollapsed} />
            <NavList vertical collapsed={sidebarCollapsed} />
            <MiniClientList collapsed={sidebarCollapsed} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <AttentionAlert collapsed={sidebarCollapsed} />
          </div>
        </div>
      )}

      {/* Desktop top-tabs nav (900px+) — opt-in alternative, same nav
          items/active-state/badges as the sidebar, just laid out
          horizontally with full-width content below. This bar already
          spans the full width (there's no separate sidebar to keep search
          out of, and nothing to collapse), so search, notifications,
          invite, and the profile menu all stay here. */}
      {navLayout === 'top_tabs' && (
        <div className="purema-nav-top-desktop" style={{ background: color.surfaceNav,
          borderBottom: `0.5px solid ${color.borderLight}`, alignItems: 'center', justifyContent: 'space-between',
          padding: '0 24px', height: 64, position: 'sticky', top: 0, zIndex: 100, gap: 20, boxSizing: 'border-box' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 28, minWidth: 0 }}>
            <Logo />
            <NavList vertical={false} />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexShrink: 0 }}>
            <div style={{ width: 220 }}>
              <SearchBar
                clients={clients}
                checkins={checkins}
                onSelectCheckin={setSelected}
                onSelectClient={() => setActiveTab('clients')}
              />
            </div>
            <AttentionAlert />
            <InviteButton />
            <NotificationBell />
            <ProfileMenu />
          </div>
        </div>
      )}

      {/* Mobile header + page content + mobile bottom tab bar */}
      <div>
        <div className="purema-header-mobile" style={{ background: color.surfaceNav,
          borderBottom: `0.5px solid ${color.borderLight}`, position: 'sticky', top: 0,
          zIndex: 100, flexDirection: 'column', gap: 10, padding: '12px 20px', boxSizing: 'border-box' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Logo />
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <InviteButton compact />
              <NotificationBell />
              <ProfileMenu />
            </div>
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

        {/* Content-column top bar (900px+, sidebar layout only) — spans
            the main content column, not the sidebar. Holds the sidebar
            collapse toggle, search (moved out of the sidebar), invite,
            notifications, and the profile menu (replaces the old
            standalone Sign Out button). */}
        {navLayout === 'sidebar' && (
          <div className="purema-topbar-desktop" style={{ alignItems: 'center', justifyContent: 'space-between',
            gap: 16, padding: '14px 32px', borderBottom: `0.5px solid ${color.borderLight}`,
            position: 'sticky', top: 0, background: color.bone, zIndex: 90 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, flex: 1, minWidth: 0 }}>
              <button onClick={() => setSidebarCollapsed(c => !c)}
                style={{ width: 34, height: 34, borderRadius: 8, border: `1px solid ${color.borderLight}`,
                  background: 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  cursor: 'pointer', color: color.textOnLight.secondary, flexShrink: 0 }}>
                <HamburgerIcon />
              </button>
              <div style={{ maxWidth: 340, width: '100%' }}>
                <SearchBar
                  clients={clients}
                  checkins={checkins}
                  onSelectCheckin={setSelected}
                  onSelectClient={() => setActiveTab('clients')}
                />
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
              <InviteButton />
              <NotificationBell />
              <ProfileMenu />
            </div>
          </div>
        )}

        {/* Page content */}
        <div className="purema-content" style={{ padding: '32px 32px 100px', boxSizing: 'border-box' }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: 80, color: color.textOnLight.secondary,
              fontSize: type.label, fontFamily: font.mono, letterSpacing: '0.1em' }}>LOADING...</div>
          ) : (
            <>
              {dataLoadError && (
                <div style={{ fontSize: type.body, color: color.alert, marginBottom: 20 }}>
                  {dataLoadError}
                </div>
              )}
              {isPastDue(profile) && (
                <div style={{ background: badge('warning').background, border: `1px solid ${color.gold}`, borderRadius: 10,
                  padding: '12px 16px', marginBottom: 20, display: 'flex', alignItems: 'center',
                  justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: type.body, color: badge('warning').color }}>
                    Your last payment failed — update your card to avoid losing access.
                  </span>
                  <button onClick={openBillingPortal} disabled={portalLoading}
                    style={{ padding: '6px 14px', borderRadius: 6, border: `1px solid ${color.textOnLight.secondary}`,
                      background: 'transparent', color: color.textOnLight.secondary, fontFamily: font.sans,
                      fontSize: type.label, fontWeight: 500,
                      cursor: portalLoading ? 'not-allowed' : 'pointer', whiteSpace: 'nowrap' }}>
                    {portalLoading ? 'Opening...' : 'Update payment method'}
                  </button>
                </div>
              )}
              {portalError && isPastDue(profile) && (
                <div style={{ fontSize: type.body, color: color.alert, marginBottom: 20 }}>{portalError}</div>
              )}
              {activeTab === 'dashboard' && <TabDashboard checkins={checkins} clients={clients} onSelectCheckin={setSelected} />}
              {activeTab === 'clients' && <TabClients clients={clients} checkins={checkins} profile={profile} onStatusChange={handleStatusChange} onTargetsSave={handleTargetsSave} onImportCheckins={handleImportCheckins} onGoToBilling={() => setActiveTab('billing')} focusClientId={focusClientId} onFocusHandled={() => setFocusClientId(null)} />}
              {activeTab === 'requests' && <TabRequests applications={applications} onApprove={handleApproveApplication} onDecline={handleDeclineApplication} />}
              {activeTab === 'checkins' && <TabCheckIns checkins={checkins} onSelectCheckin={setSelected} />}
              {activeTab === 'calendar' && <TabCalendar clients={clients} checkins={checkins} profile={profile} onToggleNotify={handleToggleNotify} />}
              {activeTab === 'messages' && <TabMessages clients={clients} messages={messages} coachId={profile?.id} onSendMessage={handleSendMessage} onMarkRead={handleMarkMessagesRead} />}
              {activeTab === 'overview' && <TabOverview clients={clients} checkins={checkins} profile={profile} />}
              {activeTab === 'billing' && <TabBilling profile={profile} />}
              {activeTab === 'settings' && <TabSettings profile={profile} onToggleNotify={handleToggleNotify} />}
            </>
          )}
        </div>

        {/* Mobile bottom tab bar (below 900px) */}
        <div className="purema-tabbar-mobile" style={{ position: 'fixed', bottom: 0, left: 0, right: 0,
          background: color.surfaceNav, borderTop: `0.5px solid ${color.borderLight}`, zIndex: 100,
          justifyContent: 'flex-start', gap: 4, overflowX: 'auto', padding: '0 8px', WebkitOverflowScrolling: 'touch' }}>
          {TABS.map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
                background: 'transparent', cursor: 'pointer', padding: '6px 6px 4px', flexShrink: 0,
                border: 'none', borderTop: activeTab === tab.id ? `2px solid ${color.forest}` : '2px solid transparent',
                fontFamily: font.sans, fontSize: type.label,
                fontWeight: activeTab === tab.id ? 500 : 400,
                color: activeTab === tab.id ? color.textOnLight.primary : color.textOnLight.secondary,
                whiteSpace: 'nowrap' }}>
              {tab.label}
              {tab.id === 'checkins' && pendingCount > 0 && (
                <span style={{ background: badge('warning').background, color: badge('warning').color,
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

      {/* Top-bar "+ Invite Client" reuses the exact same InviteClient
          component TabClients already renders inline — just wrapped in a
          modal shell so it's reachable from anywhere, not a second
          implementation of invite creation. */}
      {showInviteModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 400,
          display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          onClick={() => setShowInviteModal(false)}>
          <div style={{ background: color.surfaceLight, borderRadius: 16, padding: 24, maxWidth: 480,
            width: '100%', margin: '0 20px' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div style={{ ...displayStyle, fontSize: type.heading, color: color.textOnLight.primary }}>Invite a client</div>
              <button onClick={() => setShowInviteModal(false)}
                style={{ background: color.surfaceSunken, border: 'none', color: color.textOnLight.secondary,
                  width: 32, height: 32, borderRadius: '50%', cursor: 'pointer', fontSize: 16, flexShrink: 0 }}>×</button>
            </div>
            <InviteClient atLimit={atInviteLimit} onUpgradeClick={() => { setShowInviteModal(false); setActiveTab('billing') }} />
          </div>
        </div>
      )}
    </div>
  )
}