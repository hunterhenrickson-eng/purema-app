import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import CheckInForm from './CheckInForm'
import ClientSettings from './ClientSettings'
import { color, font, type, labelStyle } from '../lib/theme'
import { getEffectiveTargets } from '../lib/dietPlan'
import MessageThread from './MessageThread'
import '../styles/purema-responsive.css'

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

// ─── Shared styles ────────────────────────────────────────────────────────────

const S = {
  card: {
    background: color.surfaceLight,
    borderRadius: 14,
    border: `0.5px solid ${color.borderLight}`,
    padding: 20,
  },
  label: {
    ...labelStyle(false),
    letterSpacing: '0.1em',
  },
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

// ─── Stat pill ────────────────────────────────────────────────────────────────

const StatPill = ({ label, value, unit, target }) => {
  if (!value) return null
  return (
    <div style={{ background: color.bone, borderRadius: 10, padding: '12px 16px', flex: 1, minWidth: 0 }}>
      <div style={{ fontSize: 20, fontWeight: 500, color: color.textOnLight.primary, letterSpacing: '-0.01em' }}>
        {value}<span style={{ fontSize: type.label, color: color.textOnLight.faint, marginLeft: 3 }}>{unit}</span>
      </div>
      <div style={{ ...S.label, marginTop: 4 }}>{label}</div>
      {typeof target === 'number' && target > 0 && (
        <div style={{ fontSize: type.label, color: color.textOnLight.faint, marginTop: 2 }}>Goal: {target}{unit}</div>
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
      <div style={{ flex: 1, height: 6, background: '#F0EDE8', borderRadius: 999, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${pct}%`, background: barColor, borderRadius: 999, opacity: 0.85 }} />
      </div>
      <div style={{ fontSize: type.body, fontWeight: 500, color: color.textOnLight.primary, minWidth: 52, textAlign: 'right' }}>
        {value}{unit}
      </div>
    </div>
  )
}

// ─── Home tab ─────────────────────────────────────────────────────────────────

const TabHome = ({ profile, checkins, dietPhases, targetOverrides, onGoToCheckin }) => {
  const latest = checkins[0]
  const nextWeek = latest ? latest.week_number + 1 : 1
  const targets = latest ? getEffectiveTargets(dietPhases, targetOverrides, latest.week_number, profile) : null
  const hasCheckedInThisWeek = latest &&
    (new Date() - new Date(latest.submitted_at)) / (1000 * 60 * 60 * 24) < 7

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* Greeting + CTA row */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontSize: type.display, fontWeight: 300, color: color.textOnLight.primary, letterSpacing: '-0.02em' }}>
            {greeting(profile?.full_name)}
          </div>
          <div style={{ fontSize: type.body, color: color.textOnLight.secondary, marginTop: 4 }}>
            {latest
              ? `Last check-in was ${daysAgo(latest.submitted_at)}`
              : 'Welcome — submit your first check-in to get started.'}
          </div>
        </div>

        {!hasCheckedInThisWeek ? (
          <button onClick={onGoToCheckin}
            style={{ height: 44, padding: '0 24px', background: color.forest, border: 'none',
              borderRadius: 10, color: color.sage, fontSize: type.body, fontWeight: 500,
              cursor: 'pointer', fontFamily: font.sans, whiteSpace: 'nowrap',
              display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
            Submit Week {nextWeek} Check-in <span>→</span>
          </button>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: color.sage,
            padding: '10px 16px', borderRadius: 10 }}>
            <span style={{ fontSize: 16 }}>✓</span>
            <div>
              <div style={{ fontSize: type.body, fontWeight: 500, color: '#0D3D1F' }}>
                Week {latest.week_number} submitted
              </div>
              <div style={{ fontSize: type.label, color: '#3A7A4A' }}>Waiting for feedback</div>
            </div>
          </div>
        )}
      </div>

      {/* Main content grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 16 }}>

        {/* Latest check-in stats */}
        {latest && (
          <div style={S.card}>
            <div style={{ ...S.label, marginBottom: 14 }}>
              Week {latest.week_number} · {formatDate(latest.submitted_at)}
            </div>
            <div style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
              <StatPill label="WEIGHT" value={latest.weight} unit="lbs" target={profile?.target_weight} />
              <StatPill label="WAIST" value={latest.waist} unit="in" />
              <StatPill label="SLEEP" value={latest.sleep} unit="hrs" />
            </div>
            {(latest.calories || latest.protein || latest.carbs || latest.fats) && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ ...S.label, marginBottom: 2 }}>Nutrition this week</div>
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
          <div style={{ ...S.card, background: color.void, border: 'none' }}>
            <div style={{ ...labelStyle(true), color: color.forest, marginBottom: 12 }}>
              Coach feedback — Week {latest.week_number}
            </div>
            <div style={{ fontSize: type.body, color: color.textOnDark.primary, lineHeight: 1.8 }}>
              {latest.coach_feedback}
            </div>
          </div>
        ) : latest && (
          <div style={{ ...S.card, background: color.surfaceDarkRaised, border: 'none',
            display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ width: 8, height: 8, borderRadius: '50%', background: color.gold, flexShrink: 0 }} />
            <div>
              <div style={{ fontSize: type.body, fontWeight: 500, color: color.textOnDark.primary }}>
                Feedback pending
              </div>
              <div style={{ fontSize: type.label, color: color.textOnDark.secondary, marginTop: 2 }}>
                Your coach hasn't reviewed Week {latest.week_number} yet.
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Check-in history */}
      {checkins.length > 1 && (
        <div>
          <div style={{ ...S.label, marginBottom: 12 }}>History</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 10 }}>
            {checkins.slice(1, 7).map(c => (
              <div key={c.id} style={{ ...S.card, display: 'flex', alignItems: 'center',
                justifyContent: 'space-between', padding: '14px 16px' }}>
                <div>
                  <div style={{ fontSize: type.body, fontWeight: 500, color: color.textOnLight.primary, display: 'flex', alignItems: 'center', gap: 6 }}>
                    Week {c.week_number}
                    {c.imported_backfill && <ImportedTag />}
                  </div>
                  <div style={{ fontSize: type.label, color: color.textOnLight.faint, marginTop: 2 }}>
                    {formatDate(c.submitted_at)}{c.weight ? ` · ${c.weight} lbs` : ''}
                  </div>
                </div>
                <span style={{ fontSize: type.label,
                  background: c.coach_feedback ? color.sage : '#F0EDE8',
                  color: c.coach_feedback ? '#1A5C0A' : color.textOnLight.faint,
                  padding: '3px 10px', borderRadius: 999,
                  fontFamily: font.mono, fontWeight: 500 }}>
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

  // Sort check-ins chronologically for charts
  const sorted = [...checkins]
    .filter(c => c.week_number)
    .sort((a, b) => a.week_number - b.week_number)

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
  const latestMeasure = [...checkins]
    .sort((a, b) => new Date(b.submitted_at) - new Date(a.submitted_at))
    .find(c => measureKeys.some(k => c[k]))

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
            <div style={{ fontSize: 24, fontWeight: 300, color: color.textOnLight.primary, letterSpacing: '-0.02em' }}>
              {vals[vals.length - 1]}<span style={{ fontSize: type.body, color: color.textOnLight.secondary, marginLeft: 3 }}>{unit}</span>
            </div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: type.label, color: color.textOnLight.secondary, marginBottom: 2 }}>
              {pts.length} check-ins
            </div>
            {change !== 0 && (
              <div style={{ fontSize: type.body, fontWeight: 500, color: changeColor }}>
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
    { id: 'feedback', label: 'Feedback' },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* Section nav */}
      <div style={{ display: 'flex', gap: 4, background: '#F0EDE8', borderRadius: 8, padding: 4, alignSelf: 'flex-start' }}>
        {sections.map(s => (
          <button key={s.id} onClick={() => setActiveSection(s.id)}
            style={{ padding: '6px 16px', borderRadius: 6, border: 'none', cursor: 'pointer',
              fontFamily: font.sans, fontSize: type.body, fontWeight: activeSection === s.id ? 500 : 400,
              background: activeSection === s.id ? color.void : 'transparent',
              color: activeSection === s.id ? color.textOnDark.primary : color.textOnLight.secondary,
              transition: 'all 0.15s ease' }}>
            {s.label}
          </button>
        ))}
      </div>

      {/* ── Overview ── */}
      {activeSection === 'overview' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Countdown */}
          {daysOut !== null && daysOut > 0 && (
            <div style={{ background: color.void, borderRadius: 14, padding: 24,
              display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <div style={{ ...S.label, color: color.forest, marginBottom: 6 }}>Show day countdown</div>
                <div style={{ fontSize: 42, fontWeight: 300, color: color.textOnDark.primary, letterSpacing: '-0.03em', lineHeight: 1 }}>
                  {daysOut}
                  <span style={{ fontSize: 16, color: color.textOnDark.faint, marginLeft: 8, fontWeight: 400 }}>days out</span>
                </div>
                <div style={{ fontSize: type.label, color: color.textOnDark.faint, marginTop: 6 }}>
                  {new Date(profile.show_date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                </div>
              </div>
              <div style={{ fontSize: 48 }}>🏆</div>
            </div>
          )}

          {/* Stats row */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12 }}>
            {/* Streak */}
            <div style={{ background: color.void, borderRadius: 12, padding: '16px 20px' }}>
              <div style={{ fontSize: 28, fontWeight: 300, color: streak >= 4 ? color.forest : color.textOnDark.primary,
                letterSpacing: '-0.02em' }}>{streak}</div>
              <div style={{ ...S.label, color: color.textOnDark.label, marginTop: 4 }}>Week streak</div>
              {streak >= 4 && (
                <div style={{ fontSize: type.label, color: color.forest, marginTop: 4 }}>🔥 On a roll</div>
              )}
            </div>

            {/* Total check-ins */}
            <div style={{ background: color.void, borderRadius: 12, padding: '16px 20px' }}>
              <div style={{ fontSize: 28, fontWeight: 300, color: color.textOnDark.primary, letterSpacing: '-0.02em' }}>
                {checkins.length}
              </div>
              <div style={{ ...S.label, color: color.textOnDark.label, marginTop: 4 }}>Check-ins total</div>
            </div>

            {/* Weight change */}
            {weightChange !== null && (
              <div style={{ background: color.void, borderRadius: 12, padding: '16px 20px' }}>
                <div style={{ fontSize: 28, fontWeight: 300, letterSpacing: '-0.02em',
                  color: parseFloat(weightChange) < 0 ? color.forest : parseFloat(weightChange) > 0 ? color.alert : color.textOnDark.secondary }}>
                  {parseFloat(weightChange) > 0 ? '+' : ''}{weightChange}
                  <span style={{ fontSize: 13, marginLeft: 3 }}>lbs</span>
                </div>
                <div style={{ ...S.label, color: color.textOnDark.label, marginTop: 4 }}>Total change</div>
              </div>
            )}

            {/* Feedback received */}
            <div style={{ background: color.void, borderRadius: 12, padding: '16px 20px' }}>
              <div style={{ fontSize: 28, fontWeight: 300, color: color.textOnDark.primary, letterSpacing: '-0.02em' }}>
                {feedbackHistory.length}
              </div>
              <div style={{ ...S.label, color: color.textOnDark.label, marginTop: 4 }}>Feedback received</div>
            </div>
          </div>

          {/* Weight preview */}
          {weightData.length >= 2 && (
            <div onClick={() => setActiveSection('weight')} style={{ cursor: 'pointer' }}>
              <MiniChart data={sorted} valueKey="weight" label="Weight trend" unit="lbs" />
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
          <MiniChart data={sorted} valueKey="weight" label="Weight" unit="lbs" color={color.forest} />
          <MiniChart data={sorted} valueKey="sleep" label="Avg sleep" unit="hrs" color="#7C6AF5" />
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
                    { key: 'chest', label: 'Chest' },
                    { key: 'hips', label: 'Hips' },
                    { key: 'arms', label: 'Arms' },
                    { key: 'thighs', label: 'Thighs' },
                  ].map(({ key, label }) => latestMeasure[key] ? (
                    <div key={key} style={{ background: color.bone, borderRadius: 10, padding: '12px 14px' }}>
                      <div style={{ fontSize: 20, fontWeight: 500, color: color.textOnLight.primary }}>
                        {latestMeasure[key]}<span style={{ fontSize: type.label, color: color.textOnLight.faint, marginLeft: 2 }}>in</span>
                      </div>
                      <div style={{ ...S.label, marginTop: 4 }}>{label}</div>
                    </div>
                  ) : null)}
                </div>
                <div style={{ fontSize: type.label, color: color.textOnLight.faint, marginTop: 12 }}>
                  Week {latestMeasure.week_number} · {new Date(latestMeasure.submitted_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                </div>
              </div>
              <MiniChart data={sorted} valueKey="waist" label="Waist" unit="in" color={color.forest} />
            </>
          ) : (
            <div style={{ ...S.card, textAlign: 'center', padding: '40px 20px', color: color.textOnLight.secondary, fontSize: type.body }}>
              No measurement data yet. Measurements are recorded every 4 weeks.
            </div>
          )}
        </div>
      )}

      {/* ── Feedback history ── */}
      {activeSection === 'feedback' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {feedbackHistory.length === 0 ? (
            <div style={{ ...S.card, textAlign: 'center', padding: '40px 20px', color: color.textOnLight.secondary, fontSize: type.body }}>
              No feedback yet. Your coach's responses will appear here.
            </div>
          ) : feedbackHistory.map(c => (
            <div key={c.id} style={{ background: color.void, borderRadius: 12, padding: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <span style={{ fontSize: type.label, color: color.forest, fontFamily: font.mono, letterSpacing: '0.06em', display: 'flex', alignItems: 'center', gap: 8 }}>
                  WEEK {c.week_number}
                  {c.imported_backfill && <ImportedTag onDark />}
                </span>
                <span style={{ fontSize: type.label, color: color.textOnDark.faint, fontFamily: font.mono }}>
                  {new Date(c.submitted_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                </span>
              </div>
              <div style={{ fontSize: type.body, color: color.textOnDark.primary, lineHeight: 1.8 }}>
                {c.coach_feedback}
              </div>
            </div>
          ))}
        </div>
      )}

    </div>
  )
}

// ─── Check-in tab ─────────────────────────────────────────────────────────────

const TabCheckIn = ({ onSuccess }) => (
  <div>
    <CheckInForm onSuccess={onSuccess} />
  </div>
)

// ─── Main shell ───────────────────────────────────────────────────────────────

const TABS = [
  { id: 'home', label: 'Home' },
  { id: 'progress', label: 'Progress' },
  { id: 'checkin', label: 'Check-in' },
  { id: 'messages', label: 'Messages' },
]

export default function ClientHome() {
  const [activeTab, setActiveTab] = useState('home')
  const [profile, setProfile] = useState(null)
  const [checkins, setCheckins] = useState([])
  const [dietPhases, setDietPhases] = useState([])
  const [targetOverrides, setTargetOverrides] = useState([])
  const [messages, setMessages] = useState([])
  const [coachName, setCoachName] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const [profileRes, checkinsRes, phasesRes, overridesRes, messagesRes] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', user.id).single(),
        supabase.from('check_ins').select('*').eq('client_id', user.id)
          .order('submitted_at', { ascending: false }),
        supabase.from('diet_plan_phases').select('*').eq('client_id', user.id),
        supabase.from('weekly_target_overrides').select('*').eq('client_id', user.id),
        supabase.from('messages').select('*').eq('client_id', user.id).order('created_at', { ascending: true }),
      ])

      if (!profileRes.error) setProfile(profileRes.data)
      if (!checkinsRes.error) setCheckins(checkinsRes.data || [])
      if (!phasesRes.error) setDietPhases(phasesRes.data || [])
      if (!overridesRes.error) setTargetOverrides(overridesRes.data || [])
      if (!messagesRes.error) setMessages(messagesRes.data || [])

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

  const handleSendMessage = async (body) => {
    if (!profile?.coach_id) return { ok: false, message: 'No coach assigned yet.' }
    const { error } = await supabase.from('messages').insert({
      coach_id: profile.coach_id, client_id: profile.id, sender_id: profile.id, body,
    })
    if (error) return { ok: false, message: error.message }
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
    <div style={{ minHeight: '100vh', background: color.void, display: 'flex',
      alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ fontFamily: font.mono, fontSize: type.label,
        color: color.forest, letterSpacing: '0.1em' }}>LOADING...</div>
    </div>
  )

  // Nav items shown in both the desktop sidebar and the mobile bottom tab bar —
  // generalized over TABS so adding/removing a tab doesn't require touching either.
  const navItems = [...TABS, { id: 'settings', label: 'Settings' }]

  return (
    <div className="purema-shell" style={{ background: color.bone, fontFamily: font.sans }}>

      {/* Desktop sidebar nav (900px+) */}
      <div className="purema-nav-desktop" style={{ flexDirection: 'column', justifyContent: 'space-between',
        background: color.void, padding: '28px 20px', position: 'sticky', top: 0, height: '100vh',
        boxSizing: 'border-box' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '0 4px', marginBottom: 36 }}>
            <Mark size={20} />
            <span style={{ fontSize: 18, fontWeight: 300, letterSpacing: '-0.03em', color: color.textOnDark.primary }}>
              purema<span style={{ color: color.forest }}>.</span>
            </span>
          </div>
          <nav style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {navItems.map(item => (
              <button key={item.id} onClick={() => setActiveTab(item.id)}
                style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px',
                  border: 'none', borderRadius: 8, textAlign: 'left', cursor: 'pointer',
                  fontFamily: font.sans, fontSize: type.body,
                  fontWeight: activeTab === item.id ? 500 : 400,
                  background: activeTab === item.id ? color.surfaceDarkRaised : 'transparent',
                  color: activeTab === item.id ? color.textOnDark.primary : color.textOnDark.secondary,
                  transition: 'all 0.15s ease' }}>
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
            <span style={{ fontSize: type.label, color: color.textOnDark.secondary, fontFamily: font.sans,
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {profile.full_name}
            </span>
          )}
          <button onClick={() => supabase.auth.signOut()}
            style={{ fontSize: type.label, color: color.textOnDark.secondary, fontFamily: font.mono,
              letterSpacing: '0.1em', background: 'transparent', border: `1px solid ${color.borderDark}`,
              cursor: 'pointer', padding: '8px 12px', borderRadius: 6 }}>
            SIGN OUT
          </button>
        </div>
      </div>

      {/* Mobile header + page content + mobile bottom tab bar */}
      <div>
        <div className="purema-header-mobile" style={{ background: color.void, position: 'sticky', top: 0,
          zIndex: 100, alignItems: 'center', justifyContent: 'space-between', padding: '0 20px', height: 56 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Mark size={20} />
            <span style={{ fontSize: 18, fontWeight: 300, letterSpacing: '-0.03em', color: color.textOnDark.primary }}>
              purema<span style={{ color: color.forest }}>.</span>
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {profile?.full_name && (
              <span style={{ fontSize: type.label, color: color.textOnDark.secondary, fontFamily: font.sans,
                maxWidth: 100, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {profile.full_name}
              </span>
            )}
            <button onClick={() => supabase.auth.signOut()}
              style={{ fontSize: type.label, color: color.textOnDark.secondary, fontFamily: font.mono,
                letterSpacing: '0.1em', background: 'transparent', border: `1px solid ${color.borderDark}`,
                cursor: 'pointer', padding: '5px 12px', borderRadius: 6 }}>
              SIGN OUT
            </button>
          </div>
        </div>

        {/* Page content */}
        <div className="purema-content" style={{ padding: '32px 32px 100px', boxSizing: 'border-box' }}>
          {activeTab === 'home' && (
            <TabHome
              profile={profile}
              checkins={checkins}
              dietPhases={dietPhases}
              targetOverrides={targetOverrides}
              onGoToCheckin={() => setActiveTab('checkin')}
            />
          )}
          {activeTab === 'progress' && (
            <TabProgress profile={profile} checkins={checkins} />
          )}
          {activeTab === 'checkin' && (
            <TabCheckIn onSuccess={handleCheckInSuccess} />
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

        {/* Mobile bottom tab bar (below 900px) */}
        <div className="purema-tabbar-mobile" style={{ position: 'fixed', bottom: 0, left: 0, right: 0,
          background: color.void, borderTop: `1px solid ${color.borderDark}`, zIndex: 100,
          justifyContent: 'space-around' }}>
          {navItems.map(item => (
            <button key={item.id} onClick={() => setActiveTab(item.id)}
              style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                background: 'transparent', cursor: 'pointer', padding: '8px 10px 6px',
                border: 'none', borderTop: activeTab === item.id ? `2px solid ${color.forest}` : '2px solid transparent',
                fontFamily: font.sans, fontSize: type.label,
                fontWeight: activeTab === item.id ? 500 : 400,
                color: activeTab === item.id ? color.textOnDark.primary : color.textOnDark.secondary }}>
              {item.id === 'settings' && <GearIcon />}
              {item.label}
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