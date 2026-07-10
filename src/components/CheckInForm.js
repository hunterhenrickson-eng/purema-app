import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { supabase } from '../lib/supabase'
import { color, font, type, labelStyle as themeLabelStyle } from '../lib/theme'
import { weightUnitLabel, measurementUnitLabel, toCanonicalWeight, toCanonicalMeasurement } from '../lib/units'

// ─── Constants ────────────────────────────────────────────────────────────────

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

const TRAINING_OPTIONS = ['Rest', 'Upper', 'Lower', 'Full Body', 'Cardio', 'Other']

// Returns the date for each day of the current week (Sun–Sat)
function getWeekDates() {
  const today = new Date()
  const dayOfWeek = today.getDay() // 0=Sun, 6=Sat
  return DAYS.map((_, i) => {
    const d = new Date(today)
    d.setDate(today.getDate() - dayOfWeek + i)
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  })
}

const WEEK_DATES = getWeekDates()

const PERFORMANCE_OPTIONS = [
  { value: 0, label: '0 — Regression' },
  { value: 1, label: '1 — No change' },
  { value: 2, label: '2 — Progression' },
]

const emptyDay = () => ({
  weight: '',
  sleep: '',
  steps: '',
  water: '',
  training: 'Rest',
  performance: '',
  desire: '',
  on_plan: true,
  diet_notes: '',
  digestive_issues: false,
  digestive_notes: '',
  lifts: '',
  notes: '',
})

const initialDailyLog = () => DAYS.map(() => emptyDay())

// Shared by the submit-time payload and the live "this week so far" summary
// so both always agree on what counts as a loggable value — filter(Boolean)
// deliberately excludes '' (NaN) same as the original submit-only version.
function computeWeeklyAverages(dailyLog) {
  const weights = dailyLog.map(d => parseFloat(d.weight)).filter(Boolean)
  const avgWeight = weights.length ? (weights.reduce((a, b) => a + b, 0) / weights.length).toFixed(1) : null
  const steps = dailyLog.map(d => parseInt(d.steps)).filter(Boolean)
  const avgSteps = steps.length ? Math.round(steps.reduce((a, b) => a + b, 0) / steps.length) : null
  const sleeps = dailyLog.map(d => parseFloat(d.sleep)).filter(Boolean)
  const avgSleep = sleeps.length ? (sleeps.reduce((a, b) => a + b, 0) / sleeps.length).toFixed(1) : null
  const waters = dailyLog.map(d => parseFloat(d.water)).filter(Boolean)
  const avgWater = waters.length ? (waters.reduce((a, b) => a + b, 0) / waters.length).toFixed(1) : null
  const daysLogged = dailyLog.filter(d => d.weight || d.sleep || d.steps || d.water).length
  return { avgWeight, avgSteps, avgSleep, avgWater, daysLogged }
}

// ─── Mark ─────────────────────────────────────────────────────────────────────

const Mark = ({ size = 24 }) => (
  <svg width={size} height={size * 0.9} viewBox="0 0 52 48">
    <polyline points="6,10 18,24 6,38" fill="none" stroke={color.forest} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    <polyline points="19,10 31,24 19,38" fill="none" stroke={color.forest} strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"/>
    <polyline points="32,10 46,24 32,38" fill="none" stroke={color.forest} strokeWidth="5.5" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
)

// ─── Shared input styles ──────────────────────────────────────────────────────

const inputStyle = {
  width: '100%',
  padding: '9px 12px',
  borderRadius: 8,
  border: `1px solid ${color.borderLight}`,
  fontFamily: font.sans,
  fontSize: type.body,
  color: color.textOnLight.primary,
  background: color.surfaceLight,
  outline: 'none',
  boxSizing: 'border-box',
}

const labelStyle = themeLabelStyle(false)

const cardStyle = {
  background: color.surfaceLight,
  borderRadius: 14,
  border: `0.5px solid ${color.borderLight}`,
  padding: 24,
  marginBottom: 16,
}

const SectionHeader = ({ number, title, subtitle }) => (
  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 24,
    paddingBottom: 16, borderBottom: `0.5px solid ${color.borderSubtle}` }}>
    <div style={{ width: 32, height: 32, borderRadius: '50%', background: color.forest,
      display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
      fontFamily: font.mono, fontSize: type.label, fontWeight: 500, color: color.sage }}>
      {number}
    </div>
    <div>
      <div style={{ fontSize: 17, fontWeight: 500, color: color.textOnLight.primary }}>{title}</div>
      {subtitle && <div style={{ fontSize: type.label, color: color.textOnLight.faint, marginTop: 2 }}>{subtitle}</div>}
    </div>
  </div>
)

// ─── Weekly average strip ──────────────────────────────────────────────────────
// Live, in-progress preview of the same averages handleSubmit calculates —
// deliberately styled as provisional (muted/outline) rather than matching the
// confirmed post-submit stat treatment elsewhere in the app, so it doesn't
// read as a final number mid-week.

const AvgStat = ({ label, value, unit }) => (
  <div style={{ textAlign: 'center' }}>
    <div style={{ fontSize: type.label, color: color.textOnLight.faint, fontFamily: font.mono,
      letterSpacing: '0.06em', marginBottom: 2 }}>
      {label}
    </div>
    <div style={{ fontSize: 15, fontWeight: 500, color: value ? color.textOnLight.primary : color.textOnLight.faint,
      fontFamily: font.mono }}>
      {value ?? '—'}{value && unit ? <span style={{ fontSize: type.label, marginLeft: 2 }}>{unit}</span> : null}
    </div>
  </div>
)

const WeeklyAverageStrip = ({ dailyLog, weightUnit }) => {
  // dailyLog.weight is whatever the client is currently typing, in the
  // currently-selected display unit — this preview intentionally averages
  // that as-is rather than converting, since it's not persisted here.
  const { avgWeight, avgSteps, avgSleep, avgWater, daysLogged } = useMemo(
    () => computeWeeklyAverages(dailyLog),
    [dailyLog]
  )

  return (
    <div style={{ position: 'sticky', top: 0, zIndex: 1, background: color.bone,
      border: `0.5px solid ${color.borderLight}`, borderRadius: 10, padding: '10px 16px',
      marginBottom: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      gap: 12, flexWrap: 'wrap' }}>
      <div style={{ fontSize: type.label, color: color.textOnLight.secondary, fontFamily: font.sans,
        whiteSpace: 'nowrap' }}>
        This week so far <span style={{ color: color.textOnLight.faint }}>· {daysLogged} of 7 days logged</span>
      </div>
      <div style={{ display: 'flex', gap: 20 }}>
        <AvgStat label="AVG WEIGHT" value={avgWeight} unit={weightUnit} />
        <AvgStat label="AVG SLEEP" value={avgSleep} unit="hrs" />
        <AvgStat label="AVG STEPS" value={avgSteps} unit="" />
        <AvgStat label="AVG WATER" value={avgWater} unit="gal" />
      </div>
    </div>
  )
}

// ─── Toggle ───────────────────────────────────────────────────────────────────

const Toggle = ({ value, onChange, labelTrue = 'Yes', labelFalse = 'No' }) => (
  <div style={{ display: 'flex', gap: 6 }}>
    {[true, false].map(v => (
      <button key={String(v)} onClick={() => onChange(v)} type="button"
        style={{ padding: '6px 14px', borderRadius: 6, border: 'none', cursor: 'pointer',
          fontSize: type.label, fontWeight: 500, fontFamily: font.sans,
          background: value === v ? color.forest : color.surfaceSunken,
          color: value === v ? color.sage : color.textOnLight.secondary,
          transition: 'all 0.15s ease' }}>
        {v ? labelTrue : labelFalse}
      </button>
    ))}
  </div>
)

// ─── Day column ───────────────────────────────────────────────────────────────

const DayColumn = ({ day, date, index, data, onChange, weightUnit }) => {
  const isRest = data.training === 'Rest'

  const update = (field, value) => {
    onChange(index, { ...data, [field]: value })
  }

  return (
    <div style={{ background: color.surfaceSunken, borderRadius: 10, border: `0.5px solid ${color.borderSubtle}`,
      padding: '14px 12px', display: 'flex', flexDirection: 'column', gap: 12, minWidth: 0 }}>

      {/* Day header */}
      <div style={{ textAlign: 'center', paddingBottom: 8, borderBottom: `0.5px solid ${color.borderLight}` }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: color.textOnLight.primary, fontFamily: font.mono,
          letterSpacing: '0.06em' }}>
          {day}
        </div>
        <div style={{ fontSize: type.label, color: color.textOnLight.faint, fontFamily: font.mono,
          letterSpacing: '0.04em', marginTop: 2 }}>
          {date}
        </div>
      </div>

      {/* Weight */}
      <div>
        <label style={labelStyle}>Weight ({weightUnit})</label>
        <input type="number" step="0.1" placeholder="—" value={data.weight}
          onChange={e => update('weight', e.target.value)}
          style={{ ...inputStyle, textAlign: 'center' }} />
      </div>

      {/* Sleep */}
      <div>
        <label style={labelStyle}>Sleep hrs</label>
        <input type="number" step="0.5" placeholder="—" value={data.sleep}
          onChange={e => update('sleep', e.target.value)}
          style={{ ...inputStyle, textAlign: 'center' }} />
      </div>

      {/* Steps */}
      <div>
        <label style={labelStyle}>Steps</label>
        <input type="number" placeholder="—" value={data.steps}
          onChange={e => update('steps', e.target.value)}
          style={{ ...inputStyle, textAlign: 'center' }} />
      </div>

      {/* Water */}
      <div>
        <label style={labelStyle}>Water (gal)</label>
        <input type="number" step="0.1" placeholder="—" value={data.water}
          onChange={e => update('water', e.target.value)}
          style={{ ...inputStyle, textAlign: 'center' }} />
      </div>

      {/* Training */}
      <div>
        <label style={labelStyle}>Training</label>
        <select value={data.training} onChange={e => update('training', e.target.value)}
          style={{ ...inputStyle, cursor: 'pointer' }}>
          {TRAINING_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
        </select>
      </div>

      {/* Performance — only if not rest */}
      {!isRest && (
        <div>
          <label style={labelStyle}>Performance</label>
          <select value={data.performance} onChange={e => update('performance', e.target.value)}
            style={{ ...inputStyle, cursor: 'pointer' }}>
            <option value="">—</option>
            {PERFORMANCE_OPTIONS.map(o => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
      )}

      {/* Desire to train — only if not rest */}
      {!isRest && (
        <div>
          <label style={labelStyle}>Desire (0–5)</label>
          <input type="number" min="0" max="5" placeholder="—" value={data.desire}
            onChange={e => update('desire', e.target.value)}
            style={{ ...inputStyle, textAlign: 'center' }} />
        </div>
      )}

      {/* Lifts — only if not rest */}
      {!isRest && (
        <div>
          <label style={labelStyle}>Top sets</label>
          <textarea placeholder="e.g. Incline: 225×8" value={data.lifts}
            onChange={e => update('lifts', e.target.value)} rows={3}
            style={{ ...inputStyle, resize: 'none', fontSize: 12, lineHeight: 1.5 }} />
        </div>
      )}

      {/* Diet on plan */}
      <div>
        <label style={labelStyle}>On plan?</label>
        <Toggle value={data.on_plan} onChange={v => update('on_plan', v)} />
        {!data.on_plan && (
          <textarea placeholder="What was off plan?" value={data.diet_notes}
            onChange={e => update('diet_notes', e.target.value)} rows={2}
            style={{ ...inputStyle, marginTop: 6, resize: 'none', fontSize: 12 }} />
        )}
      </div>

      {/* Digestive issues */}
      <div>
        <label style={labelStyle}>Gut issues?</label>
        <Toggle value={data.digestive_issues} onChange={v => update('digestive_issues', v)} />
        {data.digestive_issues && (
          <textarea placeholder="Brief note..." value={data.digestive_notes}
            onChange={e => update('digestive_notes', e.target.value)} rows={2}
            style={{ ...inputStyle, marginTop: 6, resize: 'none', fontSize: 12 }} />
        )}
      </div>

      {/* Day notes */}
      <div>
        <label style={labelStyle}>Day notes</label>
        <textarea placeholder="How did the day feel?" value={data.notes}
          onChange={e => update('notes', e.target.value)} rows={3}
          style={{ ...inputStyle, resize: 'none', fontSize: 12, lineHeight: 1.5 }} />
      </div>

    </div>
  )
}

// ─── Main form ────────────────────────────────────────────────────────────────

export default function CheckInForm({ onSuccess }) {
  const [profile, setProfile] = useState(null)
  const [profileLoading, setProfileLoading] = useState(true)
  const [profileError, setProfileError] = useState(null)
  const [weekNumber, setWeekNumber] = useState('')
  const [showMeasurements, setShowMeasurements] = useState(false)
  const [dailyLog, setDailyLog] = useState(initialDailyLog())
  const [measurements, setMeasurements] = useState({
    weight_avg: '', waist: '', chest: '', hips: '', arms: '', thighs: ''
  })
  const [vitals, setVitals] = useState({ resting_hr: '', blood_pressure: '', blood_glucose: '' })
  const [reflection, setReflection] = useState({ win: '', improve: '', notes: '' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [step, setStep] = useState(0)
  const [draftSaving, setDraftSaving] = useState(false)
  const [draftSaved, setDraftSaved] = useState(false)
  const [draftId, setDraftId] = useState(null)
  const saveTimeoutRef = useRef(null)

  const totalSteps = 5
  const weightUnit = weightUnitLabel(profile?.units)
  const measureUnit = measurementUnitLabel(profile?.units)

  // ── Load profile + last check-in ──────────────────────────────────────────

  useEffect(() => {
    async function loadProfile() {
      const { data: { user }, error: authError } = await supabase.auth.getUser()
      if (authError || !user) { setProfileError('Could not load your account.'); setProfileLoading(false); return }

      const [profileRes, lastCheckinRes] = await Promise.all([
        supabase.from('profiles').select('id, full_name, coach_id, role, units').eq('id', user.id).single(),
        supabase.from('check_ins').select('week_number').eq('client_id', user.id)
          .order('submitted_at', { ascending: false }).limit(1).single(),
      ])

      if (profileRes.error || !profileRes.data) {
        setProfileError('Could not load your profile. Contact your coach.')
        setProfileLoading(false)
        return
      }
      if (!profileRes.data.coach_id) {
        setProfileError("Your account isn't linked to a coach yet.")
        setProfileLoading(false)
        return
      }

      setProfile(profileRes.data)

      // Auto-calculate week number from last check-in
      if (!lastCheckinRes.error && lastCheckinRes.data) {
        setWeekNumber(String(lastCheckinRes.data.week_number + 1))
        // Show measurements every 4 weeks
        const nextWeek = lastCheckinRes.data.week_number + 1
        setShowMeasurements(nextWeek % 4 === 1 || nextWeek === 1)
      } else {
        setWeekNumber('1')
        setShowMeasurements(true) // first check-in always gets measurements
      }

      // Load existing draft if one exists
      const { data: draft } = await supabase
        .from('drafts')
        .select('*')
        .eq('client_id', profileRes.data.id)
        .single()

      if (draft) {
        setDraftId(draft.id)
        if (draft.week_number) setWeekNumber(String(draft.week_number))
        if (draft.daily_log) setDailyLog(draft.daily_log)
        if (draft.measurements) setMeasurements(draft.measurements)
        if (draft.vitals) setVitals(draft.vitals)
        if (draft.reflection) setReflection(draft.reflection)
      }

      setProfileLoading(false)
    }
    loadProfile()
  }, [])

  const updateDay = (index, newData) => {
    setDailyLog(prev => {
      const updated = prev.map((d, i) => i === index ? newData : d)
      scheduleSave({ dailyLog: updated })
      return updated
    })
  }

  const saveDraft = useCallback(async (overrides = {}) => {
    if (!profile) return
    setDraftSaving(true)
    setDraftSaved(false)

    const payload = {
      client_id: profile.id,
      coach_id: profile.coach_id,
      week_number: parseInt(overrides.weekNumber ?? weekNumber) || 1,
      daily_log: overrides.dailyLog ?? dailyLog,
      measurements: overrides.measurements ?? measurements,
      vitals: overrides.vitals ?? vitals,
      reflection: overrides.reflection ?? reflection,
      updated_at: new Date().toISOString(),
    }

    const { data } = await supabase
      .from('drafts')
      .upsert(payload, { onConflict: 'client_id' })
      .select('id')
      .single()

    if (data?.id) setDraftId(data.id)
    setDraftSaving(false)
    setDraftSaved(true)
    setTimeout(() => setDraftSaved(false), 2000)
  }, [profile, weekNumber, dailyLog, measurements, vitals, reflection])

  // Debounced auto-save — fires 1.5s after last change
  const scheduleSave = useCallback((overrides = {}) => {
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current)
    saveTimeoutRef.current = setTimeout(() => saveDraft(overrides), 1500)
  }, [saveDraft])

  // ── Submit ─────────────────────────────────────────────────────────────────

  const handleSubmit = async () => {
    setLoading(true)
    setError(null)

    // Whatever's in dailyLog/measurements state was typed in the client's
    // currently-selected display unit (see DayColumn/Step 2 labels) — convert
    // back to canonical lbs/in exactly once, here, before anything derived
    // from it (averages, the stored payload, the daily_log JSON snapshot)
    // gets computed or persisted. Storage never varies by display preference.
    const canonicalDailyLog = dailyLog.map(d => ({
      ...d,
      weight: toCanonicalWeight(d.weight, profile.units),
    }))
    const canonicalMeasurements = {
      waist: toCanonicalMeasurement(measurements.waist, profile.units),
      chest: toCanonicalMeasurement(measurements.chest, profile.units),
      hips: toCanonicalMeasurement(measurements.hips, profile.units),
      arms: toCanonicalMeasurement(measurements.arms, profile.units),
      thighs: toCanonicalMeasurement(measurements.thighs, profile.units),
    }

    // Calculate weekly averages from daily log
    const { avgWeight, avgSteps, avgSleep } = computeWeeklyAverages(canonicalDailyLog)

    const payload = {
      client_id: profile.id,
      coach_id: profile.coach_id,
      client_name: profile.full_name,
      week_number: parseInt(weekNumber),
      // Weekly averages (for dashboard display)
      weight: avgWeight ? parseFloat(avgWeight) : null,
      sleep: avgSleep ? parseFloat(avgSleep) : null,
      steps: avgSteps,
      // Measurements (every 4 weeks)
      waist: parseFloat(canonicalMeasurements.waist) || null,
      chest: parseFloat(canonicalMeasurements.chest) || null,
      hips: parseFloat(canonicalMeasurements.hips) || null,
      arms: parseFloat(canonicalMeasurements.arms) || null,
      thighs: parseFloat(canonicalMeasurements.thighs) || null,
      // Vitals
      notes: JSON.stringify({
        daily_log: canonicalDailyLog,
        vitals,
        reflection,
        measurements_week: showMeasurements,
      }),
    }

    const { error: supabaseError } = await supabase.from('check_ins').insert([payload])
    setLoading(false)
    if (supabaseError) { setError(supabaseError.message) }
    else {
      // Delete draft on successful submit
      if (draftId) {
        await supabase.from('drafts').delete().eq('id', draftId)
      }
      if (onSuccess) { onSuccess() } else { setStep(-1) }
    }
  }

  // ── Loading / error / success states ──────────────────────────────────────

  if (profileLoading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 80 }}>
      <div style={{ fontFamily: font.mono, fontSize: type.label, color: color.forest, letterSpacing: '0.1em' }}>
        LOADING...
      </div>
    </div>
  )

  if (profileError) return (
    <div style={{ padding: 40, textAlign: 'center' }}>
      <div style={{ fontSize: 15, color: color.textOnLight.primary, marginBottom: 8 }}>Something went wrong</div>
      <div style={{ fontSize: type.body, color: color.textOnLight.secondary }}>{profileError}</div>
    </div>
  )

  if (step === -1) return (
    <div style={{ padding: 80, textAlign: 'center' }}>
      <Mark size={40} />
      <div style={{ marginTop: 24, fontSize: 24, fontWeight: 300, color: color.textOnLight.primary }}>Check-in submitted.</div>
      <div style={{ marginTop: 8, fontSize: type.body, color: color.textOnLight.secondary }}>Your coach will review it shortly.</div>
    </div>
  )

  // ── Progress bar ──────────────────────────────────────────────────────────

  const progressSteps = showMeasurements ? totalSteps : totalSteps - 1
  const adjustedStep = step

  return (
    <div style={{ fontFamily: font.sans }}>

      {/* Draft save indicator */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8, minHeight: 18 }}>
        {draftSaving && (
          <span style={{ fontSize: type.label, color: color.textOnLight.faint, fontFamily: font.mono, letterSpacing: '0.06em' }}>
            Saving...
          </span>
        )}
        {draftSaved && !draftSaving && (
          <span style={{ fontSize: type.label, color: color.forest, fontFamily: font.mono, letterSpacing: '0.06em' }}>
            ✓ Draft saved
          </span>
        )}
      </div>

      {/* Progress bar */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <span style={{ fontFamily: font.mono, fontSize: type.label, color: color.textOnLight.faint, letterSpacing: '0.1em' }}>
            STEP {adjustedStep + 1} OF {progressSteps}
          </span>
          <div style={{ display: 'flex', gap: 4 }}>
            {Array.from({ length: progressSteps }).map((_, i) => (
              <div key={i} style={{ width: 28, height: 3, borderRadius: 2,
                background: i <= adjustedStep ? color.forest : color.borderLight, transition: 'background 0.3s' }} />
            ))}
          </div>
        </div>
        <div style={{ height: 2, background: color.borderLight, borderRadius: 999 }}>
          <div style={{ height: '100%', width: `${((adjustedStep + 1) / progressSteps) * 100}%`,
            background: color.forest, borderRadius: 999, transition: 'width 0.4s ease' }} />
        </div>
      </div>

      {/* ── Step 0: Week confirmation ─────────────────────────────────────── */}
      {step === 0 && (
        <div style={cardStyle}>
          <SectionHeader number="01" title="Week confirmation" subtitle="Auto-calculated from your last check-in" />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div>
              <label style={labelStyle}>Your name</label>
              <div style={{ ...inputStyle, background: color.bone, color: color.textOnLight.primary,
                display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                {profile?.full_name}
                <span style={{ fontSize: type.label, color: color.forest, fontFamily: font.mono }}>CONFIRMED</span>
              </div>
            </div>
            <div>
              <label style={labelStyle}>Week number</label>
              <input type="number" value={weekNumber}
                onChange={e => { setWeekNumber(e.target.value); scheduleSave({ weekNumber: e.target.value }) }}
              style={inputStyle} />
              <div style={{ fontSize: type.label, color: color.textOnLight.faint, marginTop: 4 }}>
                Auto-filled from last check-in. Edit if needed.
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Step 1: Daily log ─────────────────────────────────────────────── */}
      {step === 1 && (
        <div style={cardStyle}>
          <SectionHeader number="02" title="Daily log" subtitle="Fill in each day of the week" />
          <WeeklyAverageStrip dailyLog={dailyLog} weightUnit={weightUnit} />
          {/* Scroll hint */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <div style={{ fontSize: type.label, color: color.textOnLight.faint, fontFamily: font.mono, letterSpacing: '0.06em' }}>
              SUN → SAT
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: type.label, color: color.textOnLight.faint, fontFamily: font.sans }}>
              <span>Scroll to see all 7 days</span>
              <span style={{ fontSize: 14 }}>→</span>
            </div>
          </div>

          {/* Scrollable container with right fade */}
          <div style={{ position: 'relative' }}>
            <div style={{ overflowX: 'auto', paddingBottom: 8 }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(170px, 1fr))', gap: 10, minWidth: 1190 }}>
                {DAYS.map((day, i) => (
                  <DayColumn key={day} day={day} date={WEEK_DATES[i]} index={i} data={dailyLog[i]} onChange={updateDay} weightUnit={weightUnit} />
                ))}
              </div>
            </div>
            <div style={{ position: 'absolute', top: 0, right: 0, bottom: 8, width: 80,
              background: 'linear-gradient(to right, transparent, rgba(255,255,255,0.95))',
              pointerEvents: 'none', borderRadius: '0 10px 10px 0' }} />
          </div>
        </div>
      )}

      {/* ── Step 2: Measurements (every 4 weeks) ──────────────────────────── */}
      {step === 2 && showMeasurements && (
        <div style={cardStyle}>
          <SectionHeader number="03" title="Measurements"
            subtitle={`Taken every 4 weeks — measurements in ${measureUnit === 'cm' ? 'centimeters' : 'inches'}, weight in ${weightUnit}`} />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 16 }}>
            {[
              { key: 'waist', label: `Waist (${measureUnit})` },
              { key: 'chest', label: `Chest (${measureUnit})` },
              { key: 'hips', label: `Hips (${measureUnit})` },
              { key: 'arms', label: `Arms (${measureUnit})` },
              { key: 'thighs', label: `Thighs (${measureUnit})` },
            ].map(({ key, label }) => (
              <div key={key}>
                <label style={labelStyle}>{label}</label>
                <input type="number" step="0.1" placeholder="—"
                  value={measurements[key]}
                  onChange={e => { const updated = { ...measurements, [key]: e.target.value }; setMeasurements(updated); scheduleSave({ measurements: updated }) }}
                  style={inputStyle} />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Step 3: Vitals ────────────────────────────────────────────────── */}
      {step === (showMeasurements ? 3 : 2) && (
        <div style={cardStyle}>
          <SectionHeader number={showMeasurements ? '04' : '03'} title="Weekly vitals"
            subtitle="Optional — include if your coach tracks these" />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 16 }}>
            <div>
              <label style={labelStyle}>Resting HR (bpm)</label>
              <input type="number" placeholder="e.g. 58" value={vitals.resting_hr}
                onChange={e => { const updated = { ...vitals, resting_hr: e.target.value }; setVitals(updated); scheduleSave({ vitals: updated }) }}
                style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Blood pressure</label>
              <input type="text" placeholder="e.g. 125/68" value={vitals.blood_pressure}
                onChange={e => { const updated = { ...vitals, blood_pressure: e.target.value }; setVitals(updated); scheduleSave({ vitals: updated }) }}
                style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Blood glucose (mg/dL)</label>
              <input type="text" placeholder="e.g. 85–90" value={vitals.blood_glucose}
                onChange={e => { const updated = { ...vitals, blood_glucose: e.target.value }; setVitals(updated); scheduleSave({ vitals: updated }) }}
                style={inputStyle} />
            </div>
          </div>
        </div>
      )}

      {/* ── Step 4: Weekly reflection ─────────────────────────────────────── */}
      {step === (showMeasurements ? 4 : 3) && (
        <div style={cardStyle}>
          <SectionHeader number={showMeasurements ? '05' : '04'} title="Weekly reflection"
            subtitle="Your coach reads every word of this" />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <label style={labelStyle}>Win of the week</label>
              <textarea placeholder="Something that made you happy or proud..." value={reflection.win}
                onChange={e => { const updated = { ...reflection, win: e.target.value }; setReflection(updated); scheduleSave({ reflection: updated }) }} rows={3}
                style={{ ...inputStyle, resize: 'none', lineHeight: 1.6 }} />
            </div>
            <div>
              <label style={labelStyle}>Areas to improve</label>
              <textarea placeholder="Where do you feel you fell short?" value={reflection.improve}
                onChange={e => { const updated = { ...reflection, improve: e.target.value }; setReflection(updated); scheduleSave({ reflection: updated }) }} rows={3}
                style={{ ...inputStyle, resize: 'none', lineHeight: 1.6 }} />
            </div>
            <div>
              <label style={labelStyle}>Additional notes for your coach</label>
              <textarea placeholder="Anything else they should know..." value={reflection.notes}
                onChange={e => { const updated = { ...reflection, notes: e.target.value }; setReflection(updated); scheduleSave({ reflection: updated }) }} rows={4}
                style={{ ...inputStyle, resize: 'none', lineHeight: 1.6 }} />
            </div>
            {error && (
              <div style={{ padding: '10px 14px', background: color.alertBanner.bg,
                border: `1px solid ${color.alertBanner.border}`, borderRadius: 8, fontSize: 13, color: color.alertBanner.text }}>
                {error}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Navigation ────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
        {step > 0 && (
          <button onClick={() => setStep(s => s - 1)} type="button"
            style={{ flex: 1, height: 48, background: color.bone, border: `1px solid ${color.borderLight}`,
              borderRadius: 10, fontSize: type.body, fontWeight: 500, color: color.textOnLight.secondary, cursor: 'pointer',
              fontFamily: font.sans }}>
            Back
          </button>
        )}
        {step < (showMeasurements ? 4 : 3) ? (
          <button onClick={() => setStep(s => s + 1)} type="button"
            style={{ flex: 3, height: 48, background: color.forest, border: 'none',
              borderRadius: 10, fontSize: type.body, fontWeight: 500, color: color.sage,
              cursor: 'pointer', fontFamily: font.sans }}>
            Continue
          </button>
        ) : (
          <button onClick={handleSubmit} disabled={loading} type="button"
            style={{ flex: 3, height: 48, background: loading ? color.textOnLight.faint : color.forest, border: 'none',
              borderRadius: 10, fontSize: type.body, fontWeight: 500, color: color.sage,
              cursor: loading ? 'not-allowed' : 'pointer', fontFamily: font.sans }}>
            {loading ? 'Submitting...' : 'Submit check-in'}
          </button>
        )}
      </div>
    </div>
  )
}