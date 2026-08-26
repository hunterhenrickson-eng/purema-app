import { useState, useEffect, useCallback, useMemo } from 'react'
import { supabase } from '../lib/supabase'
import CheckInForm from './CheckInForm'
import ClientSettings from './ClientSettings'
import {
  color as staticColor, appearance, font, type,
  labelStyleAppearance as labelStyle, badge, navItemStyleAppearance as navItemStyle, displayStyle,
} from '../lib/theme'
import { getEffectiveTargets, getActivePhase } from '../lib/dietPlan'
import { notify } from '../lib/notify'
import { displayWeight, displayMeasurement, weightUnitLabel, measurementUnitLabel } from '../lib/units'
import MessageThread from './MessageThread'
import ProgressPhotoGallery from './ProgressPhotos'
import FoodSearchPicker, { round1 } from './FoodSearchPicker'
import '../styles/purema-responsive.css'

// This file is one of the four screens wired to the appearance toggle
// (profiles.appearance — see App.js and src/styles/tokens.css). Rather than
// touching every one of this file's ~65 `color.bone`/`color.surfaceLight`/
// `color.textOnLight.*`/`color.borderLight`/`color.surfaceNav` call sites
// individually, this local `color` shadows just those fields with the
// appearance-aware tokens — everything else (forest/gold/alert/sage/etc.)
// already resolves through CSS vars globally via theme.js itself. Imported
// as `labelStyleAppearance`/`navItemStyleAppearance` above under their
// original names for the same reason — every existing `labelStyle()`/
// `navItemStyle(x)` call site below keeps working unchanged.
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

// ─── Icons ────────────────────────────────────────────────────────────────────

const GearIcon = () => (
  <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor"
    strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="3"/>
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
  </svg>
)

// ─── Helpers ──────────────────────────────────────────────────────────────────

function greeting(name) {
  const h = new Date().getHours()
  const time = h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'
  return `${time}, ${name?.split(' ')[0] || 'Athlete'}.`
}

function formatDate(ts) {
  return new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function daysAgo(ts) {
  const days = Math.floor((new Date() - new Date(ts)) / (1000 * 60 * 60 * 24))
  if (days === 0) return 'Today'
  if (days === 1) return 'Yesterday'
  return `${days} days ago`
}

// Storage stays canonical lbs/in always — this only affects what's rendered.
// A pure scale conversion (no offset), so converting per-row and diffing
// (e.g. weightChange) gives the same result as diffing then converting.
const MEASURE_KEYS = ['waist', 'chest', 'hips', 'arms', 'thighs']

function withDisplayUnits(checkins, units) {
  if (units !== 'metric') return checkins
  return checkins.map(c => {
    const out = { ...c }
    if (c.weight != null) out.weight = displayWeight(c.weight, units).value
    MEASURE_KEYS.forEach(k => { if (c[k] != null) out[k] = displayMeasurement(c[k], units).value })
    return out
  })
}

// ─── Shared styles ────────────────────────────────────────────────────────────

const S = {
  card: {
    background: color.surfaceLight,
    borderRadius: 14,
    border: `0.5px solid ${color.borderLight}`,
    padding: 20,
  },
  label: {
    ...labelStyle(),
    letterSpacing: '0.1em',
  },
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

// ─── Stat pill ────────────────────────────────────────────────────────────────

const StatPill = ({ label, value, unit, target }) => {
  if (!value) return null
  return (
    <div style={{ background: color.bone, borderRadius: 10, padding: '12px 16px', flex: 1, minWidth: 0 }}>
      <div style={{ fontSize: 20, fontWeight: 500, color: color.textOnLight.primary, letterSpacing: '-0.01em', fontFamily: font.mono }}>
        {value}<span style={{ fontSize: type.label, color: color.textOnLight.faint, marginLeft: 3 }}>{unit}</span>
      </div>
      <div style={{ ...S.label, marginTop: 4 }}>{label}</div>
      {typeof target === 'number' && target > 0 && (
        <div style={{ fontSize: type.label, color: color.textOnLight.faint, marginTop: 2, fontFamily: font.mono }}>Goal: {target}{unit}</div>
      )}
    </div>
  )
}

// ─── Macro bar ────────────────────────────────────────────────────────────────
// `target` is the client's coach-set goal for this metric (e.g. a daily calorie
// target). Without one there's nothing to measure compliance against, so the
// bar renders empty/neutral rather than always claiming 100% — a full green
// bar with no target behind it would misleadingly read as "goal met".

const MacroBar = ({ label, value, unit, color: barColor, target }) => {
  if (!value) return null
  const hasTarget = typeof target === 'number' && target > 0
  const pct = hasTarget ? Math.max(0, Math.min(100, (value / target) * 100)) : 0
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      <div style={{ width: 52, fontSize: type.label, color: color.textOnLight.label, fontFamily: font.mono,
        letterSpacing: '0.04em', flexShrink: 0 }}>{label}</div>
      <div style={{ flex: 1, height: 6, background: color.surfaceSunken, borderRadius: 999, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${pct}%`, background: barColor, borderRadius: 999, opacity: 0.85 }} />
      </div>
      <div style={{ fontSize: type.body, fontWeight: 500, color: color.textOnLight.primary, minWidth: 52, textAlign: 'right', fontFamily: font.mono }}>
        {value}{unit}
      </div>
    </div>
  )
}

// ─── Acknowledge control ───────────────────────────────────────────────────────
// Phase 4 slice 5 — a simple confirm-you've-seen-this action for coach
// feedback and/or a target change. Explicit button (not a checkbox — this
// is a one-time, deliberate confirmation, not a settings toggle) matching
// the outline-button pattern used for every other secondary "Save X"
// action in this app. Swaps to a quiet, permanent confirmation once
// acknowledged — mirrors messages.read_at's "✓ Read" treatment in
// MessageThread.jsx. Never un-acknowledges; nothing to undo here.

const AcknowledgeControl = ({ checkinId, ack, onAcknowledge }) => {
  const [saving, setSaving] = useState(false)

  if (ack) {
    return (
      <div style={{ fontSize: type.label, color: color.forest, fontWeight: 500, marginTop: 12 }}>
        ✓ Acknowledged {formatDate(ack.acknowledged_at)}
      </div>
    )
  }

  return (
    <button
      onClick={async () => { setSaving(true); await onAcknowledge(checkinId); setSaving(false) }}
      disabled={saving}
      style={{ marginTop: 12, padding: '7px 16px', borderRadius: 6, border: `1px solid ${color.textOnLight.secondary}`,
        background: 'transparent', color: color.textOnLight.secondary, fontFamily: font.sans, fontSize: type.label,
        fontWeight: 500, cursor: saving ? 'not-allowed' : 'pointer' }}>
      {saving ? 'Saving...' : 'Got it'}
    </button>
  )
}

// ─── Home tab ─────────────────────────────────────────────────────────────────

const TabHome = ({ profile, checkins, dietPhases, targetOverrides, acknowledgments, onAcknowledge, mealPlan, onGoToCheckin }) => {
  const [mealPlanExpanded, setMealPlanExpanded] = useState(false)
  const units = profile?.units
  const displayCheckins = withDisplayUnits(checkins, units)
  const latest = checkins[0]
  const displayLatest = displayCheckins[0]
  const weightUnit = weightUnitLabel(units)
  const measureUnit = measurementUnitLabel(units)
  const displayTargetWeight = profile?.target_weight ? displayWeight(profile.target_weight, units).value : null
  const nextWeek = latest ? latest.week_number + 1 : 1
  const targets = latest ? getEffectiveTargets(dietPhases, targetOverrides, latest.week_number, profile, new Date(latest.submitted_at)) : null
  // Phase 4 slice 5 — "meaningful" mirrors exactly what slice 4 already
  // surfaces: real coach feedback, or a target override in effect this
  // week. Nothing to acknowledge if neither happened yet.
  const hasMeaningfulUpdate = !!(latest && (latest.coach_feedback || targets?.source === 'override'))
  const latestAck = latest ? acknowledgments?.find(a => a.checkin_id === latest.id) : null
  const hasCheckedInThisWeek = latest &&
    (new Date() - new Date(latest.submitted_at)) / (1000 * 60 * 60 * 24) < 7
  const activePhase = getActivePhase(dietPhases)
  const phaseMeals = activePhase ? mealPlan.filter(m => m.phase_id === activePhase.id) : []

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* Greeting + CTA row */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
        <div>
          <div style={{ ...displayStyle, fontSize: type.display, color: color.textOnLight.primary }}>
            {greeting(profile?.full_name)}
          </div>
          <div style={{ fontSize: type.body, color: color.textOnLight.secondary, marginTop: 4 }}>
            {latest
              ? `Last check-in was ${daysAgo(latest.submitted_at)}`
              : 'Welcome — submit your first check-in to get started.'}
          </div>
        </div>

        {/* When there's no history yet, the empty-state card below already
            has its own "Submit Week 1 Check-in" button — showing this one
            too would just be the same action offered twice on one screen. */}
        {!hasCheckedInThisWeek && checkins.length > 0 ? (
          <button onClick={onGoToCheckin}
            style={{ height: 44, padding: '0 24px', background: color.forest, border: 'none',
              borderRadius: 10, color: color.sage, fontSize: type.body, fontWeight: 500,
              cursor: 'pointer', fontFamily: font.sans, whiteSpace: 'nowrap',
              display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
            Submit Week {nextWeek} Check-in <span>→</span>
          </button>
        ) : checkins.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: color.sage,
            padding: '10px 16px', borderRadius: 10 }}>
            <span style={{ fontSize: 16 }}>✓</span>
            <div>
              <div style={{ fontSize: type.body, fontWeight: 500, color: color.successTextStrong }}>
                Week {latest.week_number} submitted
              </div>
              <div style={{ fontSize: type.label, color: color.successTextSoft }}>Waiting for feedback</div>
            </div>
          </div>
        )}
      </div>

      {/* This week's summary — Phase 5's weekly briefing. Only the same
          three signals already shown separately below (targets-changed
          badge, coach feedback card, acknowledgment control), assembled
          into one short closing statement rather than left scattered.
          Nothing here is new or exposes anything beyond what's already
          client-facing — no decision notes, no coach-only data. Gated on
          hasMeaningfulUpdate, same condition slice 5 already uses to decide
          whether there's anything worth acknowledging. */}
      {hasMeaningfulUpdate && (
        <div style={S.card}>
          <div style={{ ...S.label, marginBottom: 10 }}>This week's summary</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            <span style={badge(targets?.source === 'override' ? 'info' : 'neutral')}>
              {targets?.source === 'override' ? 'Targets changed this week' : 'Targets unchanged'}
            </span>
            <span style={badge(latest?.coach_feedback ? 'success' : 'warning')}>
              {latest?.coach_feedback ? 'Feedback delivered' : 'Feedback pending'}
            </span>
            <span style={badge(latestAck ? 'success' : 'neutral')}>
              {latestAck ? `Acknowledged ${formatDate(latestAck.acknowledged_at)}` : 'Awaiting your "Got it"'}
            </span>
          </div>
        </div>
      )}

      {/* Main content grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 16 }}>

        {/* Latest check-in stats */}
        {latest && (
          <div style={S.card}>
            <div style={{ ...S.label, marginBottom: 14 }}>
              Week {latest.week_number} · {formatDate(latest.submitted_at)}
            </div>
            <div style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
              <StatPill label="WEIGHT" value={displayLatest.weight} unit={weightUnit} target={displayTargetWeight} />
              <StatPill label="WAIST" value={displayLatest.waist} unit={measureUnit} />
              <StatPill label="SLEEP" value={latest.sleep} unit="hrs" />
            </div>
            {(latest.calories || latest.protein || latest.carbs || latest.fats) && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                  <div style={S.label}>Nutrition this week</div>
                  {/* Phase 4 slice 4 — targets.source is already computed by
                      getEffectiveTargets above; this just surfaces it. A
                      weekly override silently changed what the macro bars
                      below measure against, with no prior indication that
                      happened — this makes that visible without requiring
                      the client to notice a number changed on their own. */}
                  {targets?.source === 'override' && (
                    <span style={{ ...badge('info'), whiteSpace: 'nowrap' }}>Your targets changed this week</span>
                  )}
                </div>
                <MacroBar label="KCAL" value={latest.calories} unit="" color={color.forest} target={targets?.calories} />
                <MacroBar label="PRO" value={latest.protein} unit="g" color={color.forest} target={targets?.protein} />
                <MacroBar label="CARB" value={latest.carbs} unit="g" color={color.gold} target={targets?.carbs} />
                <MacroBar label="FAT" value={latest.fats} unit="g" color={color.textOnLight.faint} target={targets?.fats} />
              </div>
            )}
          </div>
        )}

        {/* Coach feedback */}
        {latest?.coach_feedback ? (
          <div style={S.card}>
            <div style={{ ...labelStyle(), color: color.forest, marginBottom: 12 }}>
              Coach feedback — Week {latest.week_number}
            </div>
            <div style={{ fontSize: type.body, color: color.textOnLight.primary, lineHeight: 1.8 }}>
              {latest.coach_feedback}
            </div>
            <AcknowledgeControl checkinId={latest.id} ack={latestAck} onAcknowledge={onAcknowledge} />
          </div>
        ) : latest && (
          <div style={S.card}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: color.gold, flexShrink: 0 }} />
              <div>
                <div style={{ fontSize: type.body, fontWeight: 500, color: color.textOnLight.primary }}>
                  Feedback pending
                </div>
                <div style={{ fontSize: type.label, color: color.textOnLight.secondary, marginTop: 2 }}>
                  Your coach hasn't reviewed Week {latest.week_number} yet.
                </div>
              </div>
            </div>
            {/* No written feedback yet, but a target override already went
                into effect this week — still something worth confirming. */}
            {hasMeaningfulUpdate && <AcknowledgeControl checkinId={latest.id} ack={latestAck} onAcknowledge={onAcknowledge} />}
          </div>
        )}
      </div>

      {/* Meal plan — the coach's prescribed meal-by-meal structure for the
          active phase, when one exists. Independent of check-in data, since
          it's what the client should be eating, not what they logged. */}
      {phaseMeals.length > 0 && (
        <div style={S.card}>
          <div onClick={() => setMealPlanExpanded(v => !v)}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}>
            <div style={{ ...S.label, marginBottom: 0 }}>Meal plan</div>
            <span style={{ fontSize: type.label, color: color.textOnLight.faint, fontFamily: font.mono }}>
              {mealPlanExpanded ? 'Hide' : 'Show'} {phaseMeals.length} meal{phaseMeals.length === 1 ? '' : 's'}
            </span>
          </div>
          {mealPlanExpanded && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 14 }}>
              {phaseMeals.map(meal => {
                const items = meal.diet_plan_meal_items || []
                const totals = items.reduce((acc, i) => ({
                  calories: acc.calories + (i.calories || 0), protein: acc.protein + (i.protein || 0),
                  carbs: acc.carbs + (i.carbs || 0), fats: acc.fats + (i.fats || 0),
                }), { calories: 0, protein: 0, carbs: 0, fats: 0 })
                return (
                  <div key={meal.id} style={{ background: color.bone, borderRadius: 10, padding: 12 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: items.length > 0 ? 8 : 0 }}>
                      <div style={{ fontSize: type.body, fontWeight: 500, color: color.textOnLight.primary }}>
                        {meal.name}
                        {meal.target_time && (
                          <span style={{ marginLeft: 8, fontSize: type.label, color: color.textOnLight.faint, fontFamily: font.mono }}>
                            {meal.target_time.slice(0, 5)}
                          </span>
                        )}
                      </div>
                      {items.length > 0 && (
                        <span style={{ fontSize: type.label, color: color.textOnLight.secondary, fontFamily: font.mono, whiteSpace: 'nowrap' }}>
                          {Math.round(totals.calories)} kcal
                        </span>
                      )}
                    </div>
                    {items.map(item => (
                      <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: type.label,
                        color: color.textOnLight.secondary, padding: '3px 0' }}>
                        <span>{item.food_name} <span style={{ color: color.textOnLight.faint, fontFamily: font.mono }}>· {item.quantity}{item.unit}</span></span>
                        <span style={{ fontFamily: font.mono, whiteSpace: 'nowrap' }}>
                          {item.protein != null ? `${item.protein}g P` : ''}
                        </span>
                      </div>
                    ))}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* Check-in history */}
      {checkins.length > 1 && (
        <div>
          <div style={{ ...S.label, marginBottom: 12 }}>History</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 10 }}>
            {displayCheckins.slice(1, 7).map(c => (
              <div key={c.id} style={{ ...S.card, display: 'flex', alignItems: 'center',
                justifyContent: 'space-between', padding: '14px 16px' }}>
                <div>
                  <div style={{ fontSize: type.body, fontWeight: 500, color: color.textOnLight.primary, display: 'flex', alignItems: 'center', gap: 6 }}>
                    Week {c.week_number}
                    {c.imported_backfill && <ImportedTag />}
                  </div>
                  <div style={{ fontSize: type.label, color: color.textOnLight.faint, marginTop: 2 }}>
                    {formatDate(c.submitted_at)}{c.weight ? ` · ${c.weight} ${weightUnit}` : ''}
                  </div>
                </div>
                <span style={badge(c.coach_feedback ? 'success' : 'neutral')}>
                  {c.coach_feedback ? 'Reviewed' : 'Pending'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Empty state */}
      {checkins.length === 0 && (
        <div style={{ ...S.card, textAlign: 'center', padding: '60px 20px' }}>
          <div style={{ fontSize: 36, marginBottom: 12 }}>📋</div>
          <div style={{ fontSize: type.bodyLg, fontWeight: 500, color: color.textOnLight.primary, marginBottom: 6 }}>
            No check-ins yet
          </div>
          <div style={{ fontSize: type.body, color: color.textOnLight.secondary, marginBottom: 24 }}>
            Submit your first check-in to get started.
          </div>
          <button onClick={onGoToCheckin}
            style={{ height: 44, padding: '0 24px', background: color.forest, border: 'none',
              borderRadius: 10, color: color.sage, fontSize: type.body, fontWeight: 500,
              cursor: 'pointer', fontFamily: font.sans }}>
            Submit Week 1 Check-in
          </button>
        </div>
      )}
    </div>
  )
}


// ─── Tab: Progress ────────────────────────────────────────────────────────────

const TabProgress = ({ profile, checkins }) => {
  const [activeSection, setActiveSection] = useState('overview')
  const [highlightWeek, setHighlightWeek] = useState(null)
  const units = profile?.units
  const weightUnit = weightUnitLabel(units)
  const measureUnit = measurementUnitLabel(units)

  // Sort check-ins chronologically for charts
  const sorted = withDisplayUnits(
    [...checkins].filter(c => c.week_number).sort((a, b) => a.week_number - b.week_number),
    units
  )

  // ── Countdown timer ──────────────────────────────────────────────────────
  const showDate = profile?.show_date ? new Date(profile.show_date) : null
  const daysOut = showDate
    ? Math.ceil((showDate - new Date()) / (1000 * 60 * 60 * 24))
    : null

  // ── Check-in streak ──────────────────────────────────────────────────────
  const streak = (() => {
    if (checkins.length === 0) return 0
    const byWeek = [...checkins].sort((a, b) =>
      new Date(b.submitted_at) - new Date(a.submitted_at)
    )
    let count = 1
    for (let i = 1; i < byWeek.length; i++) {
      const diff = (new Date(byWeek[i-1].submitted_at) - new Date(byWeek[i].submitted_at))
        / (1000 * 60 * 60 * 24)
      if (diff <= 10) count++
      else break
    }
    return count
  })()

  // ── Weight data ──────────────────────────────────────────────────────────
  const weightData = sorted.filter(c => c.weight)
  const weightChange = weightData.length >= 2
    ? (weightData[weightData.length - 1].weight - weightData[0].weight).toFixed(1)
    : null

  // ── Measurement data ─────────────────────────────────────────────────────
  const measureKeys = ['waist', 'chest', 'hips', 'arms', 'thighs']
  const latestMeasure = withDisplayUnits(
    [...checkins].sort((a, b) => new Date(b.submitted_at) - new Date(a.submitted_at)),
    units
  ).find(c => measureKeys.some(k => c[k]))

  // ── Feedback history ─────────────────────────────────────────────────────
  const feedbackHistory = [...checkins]
    .filter(c => c.coach_feedback)
    .sort((a, b) => new Date(b.submitted_at) - new Date(a.submitted_at))

  // ── Mini line chart helper ────────────────────────────────────────────────
  const MiniChart = ({ data, valueKey, label, unit, color: lineColor = color.forest }) => {
    const pts = data.filter(c => c[valueKey])
    if (pts.length < 2) return (
      <div style={{ ...S.card, textAlign: 'center', padding: '32px 20px' }}>
        <div style={{ fontSize: type.body, color: color.textOnLight.secondary }}>
          Not enough {label.toLowerCase()} data yet. Keep checking in.
        </div>
      </div>
    )

    const vals = pts.map(c => parseFloat(c[valueKey]))
    const min = Math.min(...vals)
    const max = Math.max(...vals)
    const range = max - min || 1
    const W = 600, H = 120, PAD = 16

    const points = pts.map((c, i) => {
      const x = PAD + (i / (pts.length - 1)) * (W - PAD * 2)
      const y = PAD + ((max - parseFloat(c[valueKey])) / range) * (H - PAD * 2)
      return { x, y, value: parseFloat(c[valueKey]), week: c.week_number }
    })

    const pathD = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ')
    const areaD = `${pathD} L ${points[points.length-1].x} ${H} L ${points[0].x} ${H} Z`

    const change = vals[vals.length - 1] - vals[0]
    const changeColor = label === 'Weight'
      ? (change < 0 ? color.forest : change > 0 ? color.alert : color.textOnLight.secondary)
      : color.forest

    return (
      <div style={S.card}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
          <div>
            <div style={{ ...S.label, marginBottom: 4 }}>{label}</div>
            <div style={{ fontSize: 24, fontWeight: 300, color: color.textOnLight.primary, letterSpacing: '-0.02em', fontFamily: font.mono }}>
              {vals[vals.length - 1]}<span style={{ fontSize: type.body, color: color.textOnLight.secondary, marginLeft: 3 }}>{unit}</span>
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: type.label, color: color.textOnLight.secondary, marginBottom: 2, fontFamily: font.mono }}>
              {pts.length} check-ins
            </div>
            {change !== 0 && (
              <div style={{ fontSize: type.body, fontWeight: 500, color: changeColor, fontFamily: font.mono }}>
                {change > 0 ? '+' : ''}{change.toFixed(1)} {unit}
              </div>
            )}
          </div>
        </div>
        <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', overflow: 'visible' }}>
          <defs>
            <linearGradient id={`grad-${valueKey}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={lineColor} stopOpacity="0.15" />
              <stop offset="100%" stopColor={lineColor} stopOpacity="0" />
            </linearGradient>
          </defs>
          <path d={areaD} fill={`url(#grad-${valueKey})`} />
          <path d={pathD} fill="none" stroke={lineColor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          {points.map((p, i) => (
            <g key={i}>
              <circle cx={p.x} cy={p.y} r="4" fill={lineColor} />
              {i === points.length - 1 && (
                <text x={p.x} y={p.y - 10} textAnchor="middle"
                  style={{ fontSize: type.label, fill: lineColor, fontFamily: font.mono }}>
                  {p.value}{unit}
                </text>
              )}
            </g>
          ))}
        </svg>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
          <span style={{ fontSize: type.label, color: color.textOnLight.faint, fontFamily: font.mono }}>
            WK {pts[0].week_number}
          </span>
          <span style={{ fontSize: type.label, color: color.textOnLight.faint, fontFamily: font.mono }}>
            WK {pts[pts.length - 1].week_number}
          </span>
        </div>
      </div>
    )
  }

  const sections = [
    { id: 'overview', label: 'Overview' },
    { id: 'weight', label: 'Weight' },
    { id: 'measurements', label: 'Measurements' },
    { id: 'photos', label: 'Photos' },
    { id: 'feedback', label: 'Feedback' },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* Section nav */}
      <div style={{ display: 'flex', gap: 4, background: color.surfaceSunken, borderRadius: 8, padding: 4, alignSelf: 'flex-start' }}>
        {sections.map(s => (
          <button key={s.id} onClick={() => setActiveSection(s.id)}
            style={{ padding: '6px 16px', border: 'none', cursor: 'pointer',
              fontFamily: font.sans, fontSize: type.body,
              transition: 'all 0.15s ease',
              ...navItemStyle(activeSection === s.id), borderRadius: 6 }}>
            {s.label}
          </button>
        ))}
      </div>

      {/* ── Overview ── */}
      {activeSection === 'overview' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Countdown */}
          {daysOut !== null && daysOut > 0 && (
            <div style={{ ...S.card, borderRadius: 14, padding: 24,
              display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <div style={{ ...S.label, color: color.forest, marginBottom: 6 }}>Show day countdown</div>
                <div style={{ fontSize: 42, fontWeight: 300, color: color.textOnLight.primary, letterSpacing: '-0.03em', lineHeight: 1, fontFamily: font.mono }}>
                  {daysOut}
                  <span style={{ fontSize: 16, color: color.textOnLight.faint, marginLeft: 8, fontWeight: 400, fontFamily: font.sans }}>days out</span>
                </div>
                <div style={{ fontSize: type.label, color: color.textOnLight.faint, marginTop: 6, fontFamily: font.mono }}>
                  {new Date(profile.show_date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                </div>
              </div>
              <div style={{ fontSize: 48 }}>🏆</div>
            </div>
          )}

          {/* Stats row */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12 }}>
            {/* Streak */}
            <div style={{ ...S.card, borderRadius: 12, padding: '16px 20px' }}>
              <div style={{ fontSize: 28, fontWeight: 500, color: streak >= 4 ? color.forest : color.textOnLight.primary,
                letterSpacing: '-0.02em', fontFamily: font.mono }}>{streak}</div>
              <div style={{ ...S.label, marginTop: 4 }}>Week streak</div>
              {streak >= 4 && (
                <div style={{ fontSize: type.label, color: color.forest, marginTop: 4 }}>🔥 On a roll</div>
              )}
            </div>

            {/* Total check-ins */}
            <div style={{ ...S.card, borderRadius: 12, padding: '16px 20px' }}>
              <div style={{ fontSize: 28, fontWeight: 500, color: color.textOnLight.primary, letterSpacing: '-0.02em', fontFamily: font.mono }}>
                {checkins.length}
              </div>
              <div style={{ ...S.label, marginTop: 4 }}>Check-ins total</div>
            </div>

            {/* Weight change */}
            {weightChange !== null && (
              <div style={{ ...S.card, borderRadius: 12, padding: '16px 20px' }}>
                <div style={{ fontSize: 28, fontWeight: 500, letterSpacing: '-0.02em', fontFamily: font.mono,
                  color: parseFloat(weightChange) < 0 ? color.forest : parseFloat(weightChange) > 0 ? color.alert : color.textOnLight.secondary }}>
                  {parseFloat(weightChange) > 0 ? '+' : ''}{weightChange}
                  <span style={{ fontSize: 13, marginLeft: 3 }}>{weightUnit}</span>
                </div>
                <div style={{ ...S.label, marginTop: 4 }}>Total change</div>
              </div>
            )}

            {/* Feedback received */}
            <div style={{ ...S.card, borderRadius: 12, padding: '16px 20px' }}>
              <div style={{ fontSize: 28, fontWeight: 500, color: color.textOnLight.primary, letterSpacing: '-0.02em', fontFamily: font.mono }}>
                {feedbackHistory.length}
              </div>
              <div style={{ ...S.label, marginTop: 4 }}>Feedback received</div>
            </div>
          </div>

          {/* Weight preview */}
          {weightData.length >= 2 && (
            <div onClick={() => setActiveSection('weight')} style={{ cursor: 'pointer' }}>
              <MiniChart data={sorted} valueKey="weight" label="Weight trend" unit={weightUnit} />
            </div>
          )}

          {/* No data state */}
          {checkins.length === 0 && (
            <div style={{ ...S.card, textAlign: 'center', padding: '60px 20px' }}>
              <div style={{ fontSize: 36, marginBottom: 12 }}>📈</div>
              <div style={{ fontSize: type.bodyLg, fontWeight: 500, color: color.textOnLight.primary, marginBottom: 6 }}>
                No progress data yet
              </div>
              <div style={{ fontSize: type.body, color: color.textOnLight.secondary }}>
                Your charts will build up as you submit weekly check-ins.
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Weight ── */}
      {activeSection === 'weight' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <MiniChart data={sorted} valueKey="weight" label="Weight" unit={weightUnit} color={color.forest} />
          <MiniChart data={sorted} valueKey="sleep" label="Avg sleep" unit="hrs" color={color.chartPurple} />
          <MiniChart data={sorted} valueKey="steps" label="Avg steps" unit="" color={color.gold} />
        </div>
      )}

      {/* ── Measurements ── */}
      {activeSection === 'measurements' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {latestMeasure ? (
            <>
              <div style={S.card}>
                <div style={{ ...S.label, marginBottom: 16 }}>Latest measurements</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 10 }}>
                  {[
                    { key: 'waist', label: 'Waist' },
                  ].map(({ key, label }) => latestMeasure[key] ? (
                    <div key={key} style={{ background: color.bone, borderRadius: 10, padding: '12px 14px' }}>
                      <div style={{ fontSize: 20, fontWeight: 500, color: color.textOnLight.primary, fontFamily: font.mono }}>
                        {latestMeasure[key]}<span style={{ fontSize: type.label, color: color.textOnLight.faint, marginLeft: 2 }}>{measureUnit}</span>
                      </div>
                      <div style={{ ...S.label, marginTop: 4 }}>{label}</div>
                    </div>
                  ) : null)}
                </div>
                <div style={{ fontSize: type.label, color: color.textOnLight.faint, marginTop: 12 }}>
                  Week {latestMeasure.week_number} · {new Date(latestMeasure.submitted_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                </div>
              </div>
              <MiniChart data={sorted} valueKey="waist" label="Waist" unit={measureUnit} color={color.forest} />
              <MiniChart data={sorted} valueKey="chest" label="Chest" unit={measureUnit} color={color.forest} />
              <MiniChart data={sorted} valueKey="hips" label="Hips" unit={measureUnit} color={color.forest} />
              <MiniChart data={sorted} valueKey="arms" label="Arms" unit={measureUnit} color={color.forest} />
              <MiniChart data={sorted} valueKey="thighs" label="Thighs" unit={measureUnit} color={color.forest} />
            </>
          ) : (
            <div style={{ ...S.card, textAlign: 'center', padding: '40px 20px', color: color.textOnLight.secondary, fontSize: type.body }}>
              No measurement data yet. Measurements are recorded every 4 weeks.
            </div>
          )}
        </div>
      )}

      {/* ── Progress photos ── */}
      {activeSection === 'photos' && (
        <ProgressPhotoGallery clientId={profile.id} coachId={profile.coach_id} checkins={checkins}
          canUpload
          onJumpToWeek={(week) => { setActiveSection('feedback'); setHighlightWeek(week) }} />
      )}

      {/* ── Feedback history ── */}
      {activeSection === 'feedback' && (
        <FeedbackSection feedbackHistory={feedbackHistory} highlightWeek={highlightWeek}
          onHighlightHandled={() => setHighlightWeek(null)} />
      )}

    </div>
  )
}

// The "Week N" badge on a linked progress photo jumps here and highlights
// the matching entry — the closest thing to a per-check-in detail view that
// exists on the client side (there's no standalone check-in page to link
// to). Falls back to a clear "no feedback for that week yet" message rather
// than a silent no-op if the coach hasn't reviewed that week.
const FeedbackSection = ({ feedbackHistory, highlightWeek, onHighlightHandled }) => {
  useEffect(() => {
    if (highlightWeek == null) return
    const el = document.getElementById(`feedback-week-${highlightWeek}`)
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' })
    const t = setTimeout(() => onHighlightHandled?.(), 2500)
    return () => clearTimeout(t)
  }, [highlightWeek, onHighlightHandled])

  const highlightedHasEntry = highlightWeek != null && feedbackHistory.some(c => c.week_number === highlightWeek)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {highlightWeek != null && !highlightedHasEntry && (
        <div style={{ ...S.card, padding: '12px 16px', fontSize: type.body, color: color.textOnLight.secondary }}>
          No feedback yet for Week {highlightWeek}.
        </div>
      )}
      {feedbackHistory.length === 0 ? (
        <div style={{ ...S.card, textAlign: 'center', padding: '40px 20px', color: color.textOnLight.secondary, fontSize: type.body }}>
          No feedback yet. Your coach's responses will appear here.
        </div>
      ) : feedbackHistory.map(c => (
        <div key={c.id} id={`feedback-week-${c.week_number}`} style={{ ...S.card, borderRadius: 12, padding: 20,
          border: `${c.week_number === highlightWeek ? '1.5px' : '0.5px'} solid ${c.week_number === highlightWeek ? color.forest : color.borderLight}`,
          transition: 'border-color 0.3s ease' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <span style={{ fontSize: type.label, color: color.forest, fontFamily: font.mono, letterSpacing: '0.06em', display: 'flex', alignItems: 'center', gap: 8 }}>
              WEEK {c.week_number}
              {c.imported_backfill && <ImportedTag />}
            </span>
            <span style={{ fontSize: type.label, color: color.textOnLight.faint, fontFamily: font.mono }}>
              {new Date(c.submitted_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
            </span>
          </div>
          <div style={{ fontSize: type.body, color: color.textOnLight.primary, lineHeight: 1.8 }}>
            {c.coach_feedback}
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── Check-in tab ─────────────────────────────────────────────────────────────

const TabCheckIn = ({ onSuccess }) => (
  <div>
    <CheckInForm onSuccess={onSuccess} />
  </div>
)

// ─── Food diary tab ───────────────────────────────────────────────────────────
// Daily logging — separate from Progress (weekly measurement trends) and
// Check-in (weekly submission), since a client eats every day but only
// checks in once a week. Scoped to today + the current Sun–Sat week only —
// no historical browsing beyond that and no barcode scanning, both
// explicitly deferred per the scoping doc. The week boundary matches
// CheckInForm's own Sun–Sat daily-log convention rather than inventing a
// different one just for this tab.

function startOfWeek(d = new Date()) {
  const s = new Date(d)
  s.setHours(0, 0, 0, 0)
  s.setDate(s.getDate() - s.getDay())
  return s
}

function isSameLocalDay(a, b) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

function formatTime(ts) {
  return new Date(ts).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
}

const TabDiary = ({ profile }) => {
  const [entries, setEntries] = useState(null)
  const [error, setError] = useState(null)
  const [adding, setAdding] = useState(false)

  const loadEntries = useCallback(async () => {
    const { data, error: err } = await supabase
      .from('food_log_entries')
      .select('*')
      .eq('client_id', profile.id)
      .gte('logged_at', startOfWeek().toISOString())
      .order('logged_at', { ascending: false })
    if (err) { setError(err.message); return }
    setEntries(data || [])
  }, [profile.id])

  useEffect(() => { loadEntries() }, [loadEntries])

  const handleAdd = async (item) => {
    setError(null)
    const { error: insertErr } = await supabase.from('food_log_entries').insert({
      client_id: profile.id,
      coach_id: profile.coach_id,
      food_name: item.food_name,
      calories: item.calories,
      protein: item.protein,
      carbs: item.carbs,
      fats: item.fats,
      source: 'nutritionix',
    })
    if (insertErr) { setError(insertErr.message); return }
    setAdding(false)
    loadEntries()
  }

  if (entries === null) {
    return <div style={{ fontSize: type.body, color: color.textOnLight.secondary }}>Loading diary...</div>
  }

  const today = new Date()
  const todayEntries = entries.filter(e => isSameLocalDay(new Date(e.logged_at), today))
  const todayTotals = todayEntries.reduce((acc, e) => ({
    calories: acc.calories + (e.calories || 0),
    protein: acc.protein + (e.protein || 0),
    carbs: acc.carbs + (e.carbs || 0),
    fats: acc.fats + (e.fats || 0),
  }), { calories: 0, protein: 0, carbs: 0, fats: 0 })
  const daysLoggedThisWeek = new Set(entries.map(e => new Date(e.logged_at).toDateString())).size

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={S.card}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <div style={S.label}>Today</div>
          <div style={{ fontSize: type.label, color: color.textOnLight.secondary, fontFamily: font.mono }}>
            {daysLoggedThisWeek} of 7 days logged this week
          </div>
        </div>

        {todayEntries.length === 0 ? (
          <div style={{ fontSize: type.body, color: color.textOnLight.secondary, marginBottom: 12 }}>
            No food logged yet today.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 14 }}>
            {todayEntries.map(entry => (
              <div key={entry.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '8px 12px', background: color.bone, borderRadius: 8 }}>
                <div>
                  <div style={{ fontSize: type.body, color: color.textOnLight.primary }}>{entry.food_name}</div>
                  <div style={{ fontSize: type.label, color: color.textOnLight.faint, fontFamily: font.mono, marginTop: 2 }}>
                    {formatTime(entry.logged_at)}
                  </div>
                </div>
                <div style={{ fontSize: type.label, color: color.textOnLight.secondary, fontFamily: font.mono, textAlign: 'right' }}>
                  {[
                    entry.calories != null && `${Math.round(entry.calories)} kcal`,
                    entry.protein != null && `${entry.protein}g P`,
                    entry.carbs != null && `${entry.carbs}g C`,
                    entry.fats != null && `${entry.fats}g F`,
                  ].filter(Boolean).join(' · ')}
                </div>
              </div>
            ))}
          </div>
        )}

        <div style={{ display: 'flex', gap: 14, marginBottom: 14, fontSize: type.label, color: color.forest,
          fontFamily: font.mono, flexWrap: 'wrap' }}>
          <span>TOTAL</span>
          <span>{round1(todayTotals.calories)} kcal</span>
          <span>{round1(todayTotals.protein)}g P</span>
          <span>{round1(todayTotals.carbs)}g C</span>
          <span>{round1(todayTotals.fats)}g F</span>
        </div>

        {adding ? (
          <FoodSearchPicker onAdd={handleAdd} onCancel={() => setAdding(false)} />
        ) : (
          <button onClick={() => setAdding(true)}
            style={{ fontSize: type.label, padding: '7px 14px', borderRadius: 6, border: `1px solid ${color.borderLight}`,
              background: 'transparent', color: color.textOnLight.secondary, cursor: 'pointer', fontFamily: font.mono }}>
            + Add food
          </button>
        )}

        {error && <div style={{ fontSize: type.body, color: color.alert, marginTop: 10 }}>{error}</div>}
      </div>
    </div>
  )
}

// ─── Tab: Calendar ────────────────────────────────────────────────────────────
// Read-only port of CoachDashboard.js's TabCalendar, scoped to a single
// client's own events. CALENDAR_COLORS/LABELS, ymd(), the month-weeks
// builder, and buildUpcomingEvents() are duplicated rather than imported —
// same per-file self-containment this file already applies to its local
// `color` shadow — so this screen has no import coupling to CoachDashboard.
// Keep any future edit to the color/label mapping in sync with
// CoachDashboard.js's copy by hand.
const CALENDAR_COLORS = { checkin: color.forest, peak: color.alert, show: color.gold }
const CALENDAR_LABELS = { checkin: 'Check-in', peak: 'Peak week', show: 'Show day' }
const CALENDAR_WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

// Local Y-M-D key — avoids the day-shifting toISOString() causes by
// converting to UTC first, since these are calendar dates, not instants.
function ymd(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// Single-client version of CoachDashboard's buildCalendarEvents — no
// clientId tagging or clients-array iteration, since every event here is
// already scoped to this one client.
function buildClientCalendarEvents(profile, checkins) {
  const events = {}
  const add = (dateKey, type) => {
    if (!events[dateKey]) events[dateKey] = []
    events[dateKey].push({ type })
  }
  if (profile.show_date) {
    const show = new Date(`${profile.show_date}T00:00:00`)
    add(ymd(show), 'show')
    const peakDays = profile.peak_week_days || 0
    for (let i = 1; i <= peakDays; i++) {
      const d = new Date(show)
      d.setDate(d.getDate() - i)
      add(ymd(d), 'peak')
    }
  }
  checkins.forEach(c => {
    if (!c.submitted_at) return
    add(ymd(new Date(c.submitted_at)), 'checkin')
  })
  return events
}

// Flattens the dateKey->events map into a single chronological list from
// today onward — identical logic to CoachDashboard's buildUpcomingEvents.
function buildUpcomingEvents(events, todayKey, limit) {
  return Object.entries(events)
    .filter(([dateKey]) => dateKey >= todayKey)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .flatMap(([dateKey, dayEvents]) => dayEvents.map(e => ({ ...e, dateKey })))
    .slice(0, limit)
}

function buildCalendarMonthWeeks(year, month) {
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

const TabCalendar = ({ profile, checkins }) => {
  const [viewDate, setViewDate] = useState(() => new Date())
  const [selectedDay, setSelectedDay] = useState(null)

  const events = useMemo(() => buildClientCalendarEvents(profile, checkins), [profile, checkins])
  const year = viewDate.getFullYear()
  const month = viewDate.getMonth()
  const weeks = useMemo(() => buildCalendarMonthWeeks(year, month), [year, month])

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

      {/* Static timezone label — a client only ever has one timezone to
          show, unlike the coach calendar's pinned-timezones strip (which
          exists to compare multiple clients' local times at once). No
          interaction, no write. */}
      {profile?.timezone && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: type.label,
          color: color.textOnLight.faint, fontFamily: font.mono, letterSpacing: '0.05em' }}>
          <span>YOUR TIMEZONE</span>
          <span style={{ color: color.textOnLight.secondary }}>{profile.timezone}</span>
        </div>
      )}

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
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
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
        {CALENDAR_WEEKDAY_LABELS.map(d => (
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
                    border: isSelected ? `1.5px solid ${color.forest}` : isToday ? `1px solid ${color.borderLight}` : `0.5px solid ${color.borderLight}`,
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

      {/* Selected day detail — dot + label only, no name (it's always this
          client's own events, so there's nothing to disambiguate). */}
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
                  <span style={{ fontSize: type.body, color: color.textOnLight.primary }}>{CALENDAR_LABELS[e.type]}</span>
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
            No upcoming events yet. They'll show up once your show date and peak week are set.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {upcoming.map((e, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: CALENDAR_COLORS[e.type], flexShrink: 0 }} />
                <span style={{ fontSize: type.label, color: color.textOnLight.faint, fontFamily: font.mono, minWidth: 80 }}>
                  {new Date(`${e.dateKey}T00:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                </span>
                <span style={{ fontSize: type.body, color: color.textOnLight.primary }}>{CALENDAR_LABELS[e.type]}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Main shell ───────────────────────────────────────────────────────────────

const TABS = [
  { id: 'home', label: 'Home' },
  { id: 'progress', label: 'Progress' },
  { id: 'calendar', label: 'Calendar' },
  { id: 'checkin', label: 'Check-in' },
  { id: 'diary', label: 'Diary' },
  { id: 'messages', label: 'Messages' },
]

export default function ClientHome() {
  // Restores the tab an appearance-change reload was stashed from (see
  // ClientSettings.js's SectionPreferences handleSave) — reads once and
  // clears immediately so a normal, non-reload page load still lands on
  // the real default.
  const [activeTab, setActiveTab] = useState(() => {
    try {
      const restore = sessionStorage.getItem('purema_restore_tab')
      if (restore) { sessionStorage.removeItem('purema_restore_tab'); return restore }
    } catch {}
    return 'home'
  })
  const [profile, setProfile] = useState(null)
  const [checkins, setCheckins] = useState([])
  const [dietPhases, setDietPhases] = useState([])
  const [targetOverrides, setTargetOverrides] = useState([])
  const [acknowledgments, setAcknowledgments] = useState([])
  const [mealPlan, setMealPlan] = useState([])
  const [messages, setMessages] = useState([])
  const [coachName, setCoachName] = useState(null)
  const [loading, setLoading] = useState(true)
  const [criticalLoadError, setCriticalLoadError] = useState(null)
  const [dataLoadError, setDataLoadError] = useState(null)

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const [profileRes, checkinsRes, phasesRes, overridesRes, acksRes, messagesRes, mealsRes] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', user.id).single(),
        supabase.from('check_ins').select('*').eq('client_id', user.id)
          .order('submitted_at', { ascending: false }),
        supabase.from('diet_plan_phases').select('*').eq('client_id', user.id),
        supabase.from('weekly_target_overrides').select('*').eq('client_id', user.id),
        supabase.from('check_in_acknowledgments').select('*').eq('client_id', user.id),
        supabase.from('messages').select('*').eq('client_id', user.id).order('created_at', { ascending: true }),
        supabase.from('diet_plan_meals').select('*, diet_plan_meal_items(*)').eq('client_id', user.id).order('sort_order', { ascending: true }),
      ])

      // Profile drives basically everything rendered below, so a failure
      // here can't just be swallowed like the others can.
      if (profileRes.error) {
        setCriticalLoadError("Couldn't load your account — try refreshing.")
        setLoading(false)
        return
      }
      setProfile(profileRes.data)

      const secondaryFailed = checkinsRes.error || phasesRes.error || overridesRes.error || messagesRes.error
      setDataLoadError(secondaryFailed ? "Couldn't load your data — try refreshing." : null)

      if (!checkinsRes.error) setCheckins(checkinsRes.data || [])
      if (!phasesRes.error) setDietPhases(phasesRes.data || [])
      if (!overridesRes.error) setTargetOverrides(overridesRes.data || [])
      // Not folded into secondaryFailed/dataLoadError — same treatment as
      // mealsRes below: a supplementary enhancement, not core data. Worst
      // case on failure, the acknowledgment control just doesn't know
      // prior state and re-shows "Got it" — harmless, not worth a banner.
      if (!acksRes.error) setAcknowledgments(acksRes.data || [])
      if (!messagesRes.error) setMessages(messagesRes.data || [])
      if (!mealsRes.error) setMealPlan(mealsRes.data || [])

      if (profileRes.data?.coach_id) {
        const { data: coachProfile } = await supabase
          .from('profiles').select('full_name').eq('id', profileRes.data.coach_id).single()
        if (coachProfile) setCoachName(coachProfile.full_name)
      }

      setLoading(false)
    }
    load()
  }, [])

  // Same reasoning as CoachDashboard: lifted to the top level so the
  // Messages nav badge is correct even while viewing a different tab.
  useEffect(() => {
    if (!profile?.id) return
    const channel = supabase
      .channel(`messages-client-${profile.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `client_id=eq.${profile.id}` }, payload => {
        setMessages(prev => (prev.some(m => m.id === payload.new.id) ? prev : [...prev, payload.new]))
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'messages', filter: `client_id=eq.${profile.id}` }, payload => {
        setMessages(prev => prev.map(m => (m.id === payload.new.id ? payload.new : m)))
      })
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [profile?.id])

  // A client has exactly one thread (their own coach), so opening the
  // Messages tab IS opening the thread — mark unread messages read here,
  // re-checking whenever new ones arrive while the tab stays open.
  useEffect(() => {
    if (activeTab !== 'messages' || !profile?.id || !profile?.coach_id) return
    const unread = messages.filter(m => m.sender_id === profile.coach_id && !m.read_at)
    if (unread.length === 0) return
    const nowIso = new Date().toISOString()
    supabase.from('messages').update({ read_at: nowIso })
      .eq('client_id', profile.id).eq('sender_id', profile.coach_id).is('read_at', null)
      .select()
      .then(({ data }) => {
        if (data?.length) setMessages(prev => prev.map(m => data.find(d => d.id === m.id) || m))
      })
  }, [activeTab, messages, profile?.id, profile?.coach_id])

  // Phase 4 slice 5 — client confirms they've seen a meaningful update
  // (coach feedback and/or a target change) on a check-in. One row per
  // check-in, immutable once inserted (see check_in_acknowledgments'
  // primary key) — this never un-acknowledges or re-confirms.
  const handleAcknowledge = async (checkinId) => {
    if (!profile?.id) return
    const { data, error } = await supabase.from('check_in_acknowledgments')
      .insert({ checkin_id: checkinId, client_id: profile.id })
      .select().single()
    if (error || !data) return
    setAcknowledgments(prev => [...prev, data])
  }

  const handleSendMessage = async (body) => {
    if (!profile?.coach_id) return { ok: false, message: 'No coach assigned yet.' }
    const { error } = await supabase.from('messages').insert({
      coach_id: profile.coach_id, client_id: profile.id, sender_id: profile.id, body,
    })
    if (error) return { ok: false, message: error.message }
    notify('message', profile.coach_id)
    return { ok: true }
  }

  const unreadMessageCount = messages.filter(m => m.sender_id === profile?.coach_id && !m.read_at).length

  const handleProfileUpdate = (updatedProfile) => {
    setProfile(updatedProfile)
  }

  // Called by CheckInForm on successful submission
  const handleCheckInSuccess = () => {
    // Reload check-ins so home tab reflects the new submission immediately
    async function reload() {
      const { data: { user } } = await supabase.auth.getUser()
      const { data } = await supabase
        .from('check_ins').select('*').eq('client_id', user.id)
        .order('submitted_at', { ascending: false })
      if (data) setCheckins(data)
    }
    reload()
    setActiveTab('home')
  }

  if (loading) return (
    <div style={{ minHeight: '100vh', background: color.bone, display: 'flex',
      alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ fontFamily: font.mono, fontSize: type.label,
        color: color.forest, letterSpacing: '0.1em' }}>LOADING...</div>
    </div>
  )

  if (criticalLoadError) return (
    <div style={{ minHeight: '100vh', background: color.bone, display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', padding: 24, gap: 16, textAlign: 'center' }}>
      <div style={{ fontFamily: font.sans, fontSize: type.bodyLg, fontWeight: 500, color: color.textOnLight.primary }}>
        {criticalLoadError}
      </div>
      <button onClick={() => window.location.reload()}
        style={{ padding: '10px 22px', borderRadius: 8, border: 'none', background: color.forest, color: color.sage,
          fontFamily: font.sans, fontSize: type.body, fontWeight: 500, cursor: 'pointer' }}>
        Try again
      </button>
    </div>
  )

  // Nav items shown in both the desktop sidebar and the mobile bottom tab bar —
  // generalized over TABS so adding/removing a tab doesn't require touching either.
  const navItems = [...TABS, { id: 'settings', label: 'Settings' }]

  return (
    <div className="purema-shell" style={{ background: color.bone, fontFamily: font.sans }}>

      {/* Desktop sidebar nav (900px+) */}
      <div className="purema-nav-desktop" style={{ flexDirection: 'column', justifyContent: 'space-between',
        background: color.surfaceNav, borderRight: `0.5px solid ${color.borderLight}`, padding: '28px 20px',
        position: 'sticky', top: 0, height: '100vh', boxSizing: 'border-box' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '0 4px', marginBottom: 36 }}>
            <Mark size={20} />
            <span style={{ ...displayStyle, fontSize: 18, color: color.textOnLight.primary }}>
              purema<span style={{ color: color.forest }}>.</span>
            </span>
          </div>
          <nav style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {navItems.map(item => (
              <button key={item.id} onClick={() => setActiveTab(item.id)}
                style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px',
                  border: 'none', textAlign: 'left', cursor: 'pointer',
                  fontFamily: font.sans, fontSize: type.body,
                  transition: 'all 0.15s ease',
                  ...navItemStyle(activeTab === item.id) }}>
                {item.id === 'settings' && <GearIcon />}
                {item.label}
                {item.id === 'messages' && unreadMessageCount > 0 && (
                  <span style={{ background: color.forest, color: color.sage, fontSize: type.label,
                    borderRadius: 999, padding: '1px 6px', fontFamily: font.mono }}>
                    {unreadMessageCount}
                  </span>
                )}
              </button>
            ))}
          </nav>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {profile?.full_name && (
            <span style={{ fontSize: type.label, color: color.textOnLight.secondary, fontFamily: font.sans,
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {profile.full_name}
            </span>
          )}
          <button onClick={() => supabase.auth.signOut()}
            style={{ fontSize: type.label, color: color.textOnLight.secondary, fontFamily: font.mono,
              letterSpacing: '0.1em', background: 'transparent', border: `1px solid ${color.borderLight}`,
              cursor: 'pointer', padding: '8px 12px', borderRadius: 6 }}>
            SIGN OUT
          </button>
        </div>
      </div>

      {/* Mobile header + page content + mobile bottom tab bar */}
      <div>
        <div className="purema-header-mobile" style={{ background: color.surfaceNav,
          borderBottom: `0.5px solid ${color.borderLight}`, position: 'sticky', top: 0,
          zIndex: 100, alignItems: 'center', justifyContent: 'space-between', padding: '0 20px', height: 56 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Mark size={20} />
            <span style={{ ...displayStyle, fontSize: 18, color: color.textOnLight.primary }}>
              purema<span style={{ color: color.forest }}>.</span>
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {profile?.full_name && (
              <span style={{ fontSize: type.label, color: color.textOnLight.secondary, fontFamily: font.sans,
                maxWidth: 100, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {profile.full_name}
              </span>
            )}
            <button onClick={() => supabase.auth.signOut()}
              style={{ fontSize: type.label, color: color.textOnLight.secondary, fontFamily: font.mono,
                letterSpacing: '0.1em', background: 'transparent', border: `1px solid ${color.borderLight}`,
                cursor: 'pointer', padding: '5px 12px', borderRadius: 6 }}>
              SIGN OUT
            </button>
          </div>
        </div>

        {/* Page content */}
        <div className="purema-content" style={{ padding: '32px 32px 100px', boxSizing: 'border-box' }}>
          {dataLoadError && (
            <div style={{ fontSize: type.body, color: color.alert, marginBottom: 20 }}>
              {dataLoadError}
            </div>
          )}
          {activeTab === 'home' && (
            <TabHome
              profile={profile}
              checkins={checkins}
              dietPhases={dietPhases}
              targetOverrides={targetOverrides}
              acknowledgments={acknowledgments}
              onAcknowledge={handleAcknowledge}
              mealPlan={mealPlan}
              onGoToCheckin={() => setActiveTab('checkin')}
            />
          )}
          {activeTab === 'progress' && (
            <TabProgress profile={profile} checkins={checkins} />
          )}
          {activeTab === 'calendar' && (
            <TabCalendar profile={profile} checkins={checkins} />
          )}
          {activeTab === 'checkin' && (
            <TabCheckIn onSuccess={handleCheckInSuccess} />
          )}
          {activeTab === 'diary' && (
            <TabDiary profile={profile} />
          )}
          {activeTab === 'messages' && (
            <div style={{ height: 'calc(100vh - 180px)', minHeight: 420 }}>
              <MessageThread
                title={coachName || 'Your coach'}
                messages={messages}
                currentUserId={profile?.id}
                onSend={handleSendMessage}
                emptyLabel="No messages yet — say hello to your coach."
              />
            </div>
          )}
          {activeTab === 'settings' && (
            <ClientSettings profile={profile} onProfileUpdate={handleProfileUpdate} />
          )}
        </div>

        {/* Mobile bottom tab bar (below 900px) — equal-width shrinkable
            columns (flex: 1 1 0%, minWidth: 0), same reasoning as
            .purema-kpi-grid's minmax(0, 1fr): this is glanceable primary
            nav, not something you'd swipe/scroll through, so unlike the
            Settings side-nav's horizontal-scroll pattern every item must
            always stay fully visible. 6 items' intrinsic content width
            (added up) used to overflow a 375px viewport by ~7.5px; equal
            sharing plus tighter horizontal padding fixes that regardless
            of how many tabs end up in navItems. */}
        <div className="purema-tabbar-mobile" style={{ position: 'fixed', bottom: 0, left: 0, right: 0,
          background: color.surfaceNav, borderTop: `0.5px solid ${color.borderLight}`, zIndex: 100 }}>
          {navItems.map(item => (
            <button key={item.id} onClick={() => setActiveTab(item.id)}
              style={{ flex: '1 1 0%', minWidth: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                cursor: 'pointer', padding: '6px 2px', boxSizing: 'border-box',
                border: 'none', fontFamily: font.sans, fontSize: type.label,
                ...navItemStyle(activeTab === item.id) }}>
              {item.id === 'settings' && <GearIcon />}
              <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '100%' }}>
                {item.label}
              </span>
              {item.id === 'messages' && unreadMessageCount > 0 && (
                <span style={{ background: color.forest, color: color.sage, fontSize: type.label,
                  borderRadius: 999, padding: '1px 5px', fontFamily: font.mono }}>
                  {unreadMessageCount}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}