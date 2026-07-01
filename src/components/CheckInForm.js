import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

const initialState = {
  client_name: '', week_number: '',
  weight: '', waist: '', chest: '', hips: '', arms: '', thighs: '',
  calories: '', protein: '', carbs: '', fats: '',
  sleep: '', stress: 5, water: '', steps: '', adherence: 5,
  notes: '',
}

const Mark = ({ size = 24 }) => (
  <svg width={size} height={size * 0.9} viewBox="0 0 52 48">
    <polyline points="6,10 18,24 6,38" fill="none" stroke="#0F6E56" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    <polyline points="19,10 31,24 19,38" fill="none" stroke="#0F6E56" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"/>
    <polyline points="32,10 46,24 32,38" fill="none" stroke="#0F6E56" strokeWidth="5.5" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
)

const Field = ({ label, children }) => (
  <div className="field">
    <label className="label">{label}</label>
    {children}
  </div>
)

const Slider = ({ label, name, value, onChange }) => (
  <div className="field">
    <label className="label">{label}</label>
    <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
      <input type="range" name={name} min={1} max={10} value={value} onChange={onChange}
        style={{ flex: 1, accentColor: "#0F6E56", cursor: "pointer" }} />
      <span style={{ fontFamily: "DM Mono, monospace", fontSize: 18, fontWeight: 500,
        color: "#0F6E56", minWidth: 28, textAlign: "right" }}>{value}</span>
    </div>
  </div>
)

const SectionHeader = ({ number, title, subtitle }) => (
  <div style={{ display: "flex", alignItems: "flex-start", gap: 12, marginBottom: 20,
    paddingBottom: 16, borderBottom: "0.5px solid #E8E8E8" }}>
    <div style={{ width: 32, height: 32, borderRadius: "50%", background: "#0F6E56",
      display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
      fontFamily: "DM Mono, monospace", fontSize: 12, fontWeight: 500, color: "#EAF3DE" }}>
      {number}
    </div>
    <div>
      <div style={{ fontSize: 17, fontWeight: 500, color: "#0D0D0D" }}>{title}</div>
      {subtitle && <div style={{ fontSize: 12, color: "#AAAAAA", marginTop: 2 }}>{subtitle}</div>}
    </div>
  </div>
)

export default function CheckInForm() {
  const [form, setForm] = useState(initialState)
  const [profile, setProfile] = useState(null)
  const [profileLoading, setProfileLoading] = useState(true)
  const [profileError, setProfileError] = useState(null)
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState(null)
  const [step, setStep] = useState(0)
  const totalSteps = 5

  // ── Fetch the logged-in client's profile on mount ──────────────────────────
  useEffect(() => {
    async function loadProfile() {
      const { data: { user }, error: authError } = await supabase.auth.getUser()

      if (authError || !user) {
        setProfileError('Could not load your account. Please sign in again.')
        setProfileLoading(false)
        return
      }

      const { data, error: profileErr } = await supabase
        .from('profiles')
        .select('id, full_name, coach_id, role')
        .eq('id', user.id)
        .single()

      if (profileErr || !data) {
        setProfileError('Could not load your profile. Contact your coach.')
        setProfileLoading(false)
        return
      }

      if (!data.coach_id) {
        setProfileError('Your account isn\'t linked to a coach yet. Contact your coach for a new invite link.')
        setProfileLoading(false)
        return
      }

      setProfile(data)
      // Pre-fill client_name from profile so it's never blank
      setForm(prev => ({ ...prev, client_name: data.full_name || '' }))
      setProfileLoading(false)
    }

    loadProfile()
  }, [])

  const handleChange = (e) => {
    const { name, value } = e.target
    setForm(prev => ({ ...prev, [name]: value }))
  }

  const handleSubmit = async () => {
    if (!profile) return
    setLoading(true)
    setError(null)

    const payload = {
      // ── Account linkage — critical for RLS and dashboard display ──
      client_id: profile.id,
      coach_id: profile.coach_id,
      // ── Form fields ───────────────────────────────────────────────
      client_name: form.client_name || profile.full_name,
      week_number: parseInt(form.week_number),
      weight: parseFloat(form.weight) || null,
      waist: parseFloat(form.waist) || null,
      chest: parseFloat(form.chest) || null,
      hips: parseFloat(form.hips) || null,
      arms: parseFloat(form.arms) || null,
      thighs: parseFloat(form.thighs) || null,
      calories: parseFloat(form.calories) || null,
      protein: parseFloat(form.protein) || null,
      carbs: parseFloat(form.carbs) || null,
      fats: parseFloat(form.fats) || null,
      sleep: parseFloat(form.sleep) || null,
      stress: parseInt(form.stress),
      water: parseFloat(form.water) || null,
      steps: parseInt(form.steps) || null,
      adherence: parseInt(form.adherence),
      notes: form.notes || null,
    }

    const { error: supabaseError } = await supabase.from('check_ins').insert([payload])
    if (supabaseError) { setError(supabaseError.message); setLoading(false) }
    else { setSuccess(true); setLoading(false) }
  }

  // ── Loading state ──────────────────────────────────────────────────────────
  if (profileLoading) {
    return (
      <div style={{ maxWidth: 390, margin: '0 auto', minHeight: '100vh', background: '#0D0D0D',
        display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ fontFamily: 'DM Mono, monospace', fontSize: 12,
          color: '#0F6E56', letterSpacing: '0.1em' }}>LOADING...</div>
      </div>
    )
  }

  // ── Profile error state ────────────────────────────────────────────────────
  if (profileError) {
    return (
      <div style={{ maxWidth: 390, margin: '0 auto', minHeight: '100vh', background: '#0D0D0D',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        padding: 32, textAlign: 'center' }}>
        <Mark size={40} />
        <div style={{ marginTop: 24, fontSize: 16, fontWeight: 500, color: '#F5F2ED' }}>
          Something went wrong
        </div>
        <div style={{ marginTop: 8, fontSize: 13, color: '#888', lineHeight: 1.6 }}>
          {profileError}
        </div>
        <button onClick={() => supabase.auth.signOut()}
          style={{ marginTop: 24, background: 'transparent', border: '1px solid #333',
            color: '#AAA', padding: '10px 20px', borderRadius: 8, cursor: 'pointer',
            fontSize: 13, fontFamily: 'DM Sans, sans-serif' }}>
          Sign out
        </button>
      </div>
    )
  }

  // ── Success state ──────────────────────────────────────────────────────────
  if (success) {
    return (
      <div style={{ maxWidth: 390, margin: '0 auto', minHeight: '100vh', background: '#0D0D0D',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        padding: 32, textAlign: 'center' }}>
        <Mark size={48} />
        <div style={{ marginTop: 24, fontSize: 28, fontWeight: 300, letterSpacing: '-0.03em', color: '#F5F2ED' }}>
          Check-in submitted.
        </div>
        <div style={{ marginTop: 8, fontSize: 14, color: '#555', lineHeight: 1.6 }}>
          Your coach will review it and leave feedback within 24 hours.
        </div>
        <div style={{ marginTop: 32, padding: '10px 24px', background: '#EAF3DE', color: '#0F6E56',
          borderRadius: 8, fontSize: 13, fontWeight: 500, fontFamily: 'DM Mono, monospace' }}>
          Week {form.week_number} — {form.client_name}
        </div>
        <button onClick={() => { setSuccess(false); setForm({ ...initialState, client_name: profile?.full_name || '' }); setStep(0) }}
          style={{ marginTop: 24, background: 'transparent', border: '1px solid #1A1A1A',
            color: '#555', padding: '10px 20px', borderRadius: 8, cursor: 'pointer',
            fontSize: 13, fontFamily: 'DM Sans, sans-serif' }}>
          Submit another
        </button>
      </div>
    )
  }

  // ── Main form ──────────────────────────────────────────────────────────────
  return (
    <div style={{ maxWidth: 390, margin: '0 auto', minHeight: '100vh', background: '#F5F2ED', paddingBottom: 100 }}>
      <div style={{ height: 56, background: '#0D0D0D', display: 'flex', alignItems: 'center',
        justifyContent: 'space-between', padding: '0 20px', position: 'sticky', top: 0, zIndex: 100 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Mark size={20} />
          <span style={{ fontSize: 18, fontWeight: 300, letterSpacing: '-0.03em', color: '#F5F2ED' }}>
            purema<span style={{ color: '#0F6E56' }}>.</span>
          </span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2 }}>
          <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 11, color: '#0F6E56', letterSpacing: '0.1em' }}>
            WEEK {form.week_number || '?'} CHECK-IN
          </span>
          {profile?.full_name && (
            <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 9, color: '#555', letterSpacing: '0.06em' }}>
              {profile.full_name.toUpperCase()}
            </span>
          )}
        </div>
      </div>

      <div style={{ height: 3, background: '#E8E8E8' }}>
        <div style={{ height: '100%', width: ((step + 1) / totalSteps * 100) + '%',
          background: '#0F6E56', transition: 'width 0.4s ease' }} />
      </div>

      <div style={{ padding: '12px 20px 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontFamily: 'DM Mono, monospace', fontSize: 10, color: '#AAAAAA',
          letterSpacing: '0.1em', textTransform: 'uppercase' }}>Step {step + 1} of {totalSteps}</span>
        <div style={{ display: 'flex', gap: 4 }}>
          {Array.from({ length: totalSteps }).map((_, i) => (
            <div key={i} style={{ width: 24, height: 3, borderRadius: 2,
              background: i <= step ? '#0F6E56' : '#E8E8E8', transition: 'background 0.3s' }} />
          ))}
        </div>
      </div>

      <div style={{ padding: '20px 16px 0' }}>
        {step === 0 && (
          <div className="card" style={{ marginBottom: 12 }}>
            <SectionHeader number="01" title="Confirm your details" subtitle="Your week number for this check-in" />
            {/* Name is pre-filled and locked — client is identified by their account */}
            <Field label="Your name">
              <div style={{ padding: '10px 12px', background: '#F0EDE8', borderRadius: 8,
                fontSize: 14, color: '#0D0D0D', border: '1px solid #E8E8E8',
                fontFamily: 'DM Sans', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                {profile?.full_name || '—'}
                <span style={{ fontSize: 10, color: '#0F6E56', fontFamily: 'DM Mono, monospace' }}>CONFIRMED</span>
              </div>
            </Field>
            <Field label="Week number">
              <input className="input" name="week_number" type="number"
                value={form.week_number} onChange={handleChange} placeholder="e.g. 8" />
            </Field>
          </div>
        )}
        {step === 1 && (
          <div className="card" style={{ marginBottom: 12 }}>
            <SectionHeader number="02" title="Body metrics" subtitle="Measurements in lbs and inches" />
            <div className="grid-2">
              <Field label="Weight (lbs)"><input className="input" name="weight" type="number" value={form.weight} onChange={handleChange} placeholder="187.4" /></Field>
              <Field label="Waist (in)"><input className="input" name="waist" type="number" value={form.waist} onChange={handleChange} placeholder="32.0" /></Field>
              <Field label="Chest (in)"><input className="input" name="chest" type="number" value={form.chest} onChange={handleChange} placeholder="42.0" /></Field>
              <Field label="Hips (in)"><input className="input" name="hips" type="number" value={form.hips} onChange={handleChange} placeholder="38.0" /></Field>
              <Field label="Arms (in)"><input className="input" name="arms" type="number" value={form.arms} onChange={handleChange} placeholder="16.5" /></Field>
              <Field label="Thighs (in)"><input className="input" name="thighs" type="number" value={form.thighs} onChange={handleChange} placeholder="24.0" /></Field>
            </div>
          </div>
        )}
        {step === 2 && (
          <div className="card" style={{ marginBottom: 12 }}>
            <SectionHeader number="03" title="Nutrition" subtitle="Average daily intake this week" />
            <Field label="Calories"><input className="input" name="calories" type="number" value={form.calories} onChange={handleChange} placeholder="2380" /></Field>
            <div className="grid-2">
              <Field label="Protein (g)"><input className="input" name="protein" type="number" value={form.protein} onChange={handleChange} placeholder="220" /></Field>
              <Field label="Carbs (g)"><input className="input" name="carbs" type="number" value={form.carbs} onChange={handleChange} placeholder="260" /></Field>
              <Field label="Fats (g)"><input className="input" name="fats" type="number" value={form.fats} onChange={handleChange} placeholder="68" /></Field>
            </div>
          </div>
        )}
        {step === 3 && (
          <div className="card" style={{ marginBottom: 12 }}>
            <SectionHeader number="04" title="Lifestyle" subtitle="How the week felt beyond the gym" />
            <div className="grid-2">
              <Field label="Avg sleep (hrs)"><input className="input" name="sleep" type="number" value={form.sleep} onChange={handleChange} placeholder="7.5" /></Field>
              <Field label="Water (litres)"><input className="input" name="water" type="number" value={form.water} onChange={handleChange} placeholder="4.0" /></Field>
              <Field label="Avg steps/day"><input className="input" name="steps" type="number" value={form.steps} onChange={handleChange} placeholder="8500" /></Field>
            </div>
            <Slider label="Stress level" name="stress" value={form.stress} onChange={handleChange} />
            <Slider label="Overall adherence" name="adherence" value={form.adherence} onChange={handleChange} />
          </div>
        )}
        {step === 4 && (
          <div className="card" style={{ marginBottom: 12 }}>
            <SectionHeader number="05" title="Notes for your coach" subtitle="Wins, struggles, injuries, anything important" />
            <Field label="Your notes">
              <textarea className="input" name="notes" value={form.notes} onChange={handleChange}
                placeholder="How did the week go? Be honest, your coach needs the full picture."
                rows={6} style={{ resize: 'none', lineHeight: 1.6 }} />
            </Field>
            {error && (
              <div style={{ background: '#FCEBEB', border: '1px solid #F9CCCC', borderRadius: 8,
                padding: '10px 14px', marginTop: 8 }}>
                <div style={{ fontSize: 12, color: '#791F1F' }}>Error: {error}</div>
              </div>
            )}
          </div>
        )}
      </div>

      <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, maxWidth: 390, margin: '0 auto',
        background: '#fff', borderTop: '0.5px solid #E8E8E8', padding: '12px 16px',
        display: 'flex', gap: 10 }}>
        {step > 0 && (
          <button onClick={() => setStep(s => s - 1)}
            style={{ flex: 1, height: 48, background: '#F5F2ED', border: '1px solid #E8E8E8',
              borderRadius: 10, fontSize: 14, fontWeight: 500, color: '#555', cursor: 'pointer' }}>
            Back
          </button>
        )}
        {step < totalSteps - 1 ? (
          <button onClick={() => setStep(s => s + 1)}
            style={{ flex: 3, height: 48, background: '#0F6E56', border: 'none', borderRadius: 10,
              fontSize: 14, fontWeight: 500, color: '#EAF3DE', cursor: 'pointer' }}>
            Continue
          </button>
        ) : (
          <button onClick={handleSubmit} disabled={loading}
            style={{ flex: 3, height: 48, background: loading ? '#AAAAAA' : '#0F6E56', border: 'none',
              borderRadius: 10, fontSize: 14, fontWeight: 500, color: '#EAF3DE',
              cursor: loading ? 'not-allowed' : 'pointer' }}>
            {loading ? 'Submitting...' : 'Submit check-in'}
          </button>
        )}
      </div>
    </div>
  )
}