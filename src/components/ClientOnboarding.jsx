import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { color, font, type, labelStyle, inputStyle } from '../lib/theme'
import '../styles/purema-responsive.css'

const Mark = ({ size = 32 }) => (
  <svg width={size} height={size * 0.9} viewBox="0 0 52 48">
    <polyline points="6,10 18,24 6,38" fill="none" stroke={color.forest} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    <polyline points="19,10 31,24 19,38" fill="none" stroke={color.forest} strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"/>
    <polyline points="32,10 46,24 32,38" fill="none" stroke={color.forest} strokeWidth="5.5" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
)

const Shell = ({ children }) => (
  <div style={{ minHeight: '100vh', background: color.void, display: 'flex',
    flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
    padding: 24, fontFamily: font.sans }}>
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 32 }}>
      <Mark size={40} />
      <div style={{ fontSize: type.display, fontWeight: 300, letterSpacing: '-0.03em',
        color: color.textOnDark.primary, marginTop: 12 }}>
        purema<span style={{ color: color.forest }}>.</span>
      </div>
    </div>
    <div className="purema-card" style={{ background: color.surfaceDark,
      borderRadius: 16, border: `0.5px solid ${color.borderDark}`, padding: 32, maxWidth: 440, width: '100%' }}>
      {children}
    </div>
  </div>
)

// Three dots showing progress through the flow — deliberately not a full
// progress bar, since this is only ever 3 short screens.
const StepDots = ({ step }) => (
  <div style={{ display: 'flex', gap: 6, justifyContent: 'center', marginBottom: 24 }}>
    {[1, 2, 3].map(n => (
      <div key={n} style={{ width: 6, height: 6, borderRadius: '50%',
        background: n === step ? color.forest : color.borderDark }} />
    ))}
  </div>
)

const GOALS = [
  { value: 'fat_loss', label: 'Fat loss' },
  { value: 'muscle_gain', label: 'Muscle gain' },
  { value: 'competition_prep', label: 'Competition prep' },
]

const PrimaryButton = ({ children, ...props }) => (
  <button {...props}
    style={{ width: '100%', padding: '12px', borderRadius: 8, border: 'none',
      background: props.disabled ? color.textOnDark.faint : color.forest, color: color.textOnDark.primary,
      fontWeight: 500, fontSize: type.body, fontFamily: font.sans,
      cursor: props.disabled ? 'not-allowed' : 'pointer', marginTop: 4 }}>
    {children}
  </button>
)

const SecondaryButton = ({ children, ...props }) => (
  <button {...props} type="button"
    style={{ width: '100%', padding: '12px', borderRadius: 8, border: `1px solid ${color.borderDark}`,
      background: 'transparent', color: color.textOnDark.secondary,
      fontWeight: 500, fontSize: type.body, fontFamily: font.sans, cursor: 'pointer', marginTop: 8 }}>
    {children}
  </button>
)

export default function ClientOnboarding({ profile, onComplete }) {
  const [step, setStep] = useState(1)
  const [coachName, setCoachName] = useState(null)
  const [weight, setWeight] = useState('')
  const [goal, setGoal] = useState('fat_loss')
  const [dietary, setDietary] = useState('')
  const [competitionDate, setCompetitionDate] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  const weightUnit = profile?.units === 'metric' ? 'kg' : 'lbs'
  const firstName = profile?.full_name?.split(' ')[0] || 'there'

  useEffect(() => {
    if (!profile?.coach_id) return
    supabase.from('profiles').select('full_name').eq('id', profile.coach_id).single()
      .then(({ data }) => { if (data) setCoachName(data.full_name) })
  }, [profile?.coach_id])

  const goalLabel = GOALS.find(g => g.value === goal)?.label || goal

  const handleFinish = async () => {
    setSaving(true)
    setError(null)
    const payload = {
      starting_weight: weight === '' ? null : parseFloat(weight),
      intake_goal: goal,
      intake_dietary_restrictions: dietary.trim() || null,
      onboarding_completed: true,
    }
    if (goal === 'competition_prep' && competitionDate) {
      payload.show_date = competitionDate
    }
    const { data, error: updateError } = await supabase
      .from('profiles').update(payload).eq('id', profile.id).select().single()
    setSaving(false)
    if (updateError || !data) { setError(updateError?.message || "Couldn't save — try again."); return }
    onComplete(data)
  }

  return (
    <Shell>
      <StepDots step={step} />

      {step === 1 && (
        <div style={{ textAlign: 'center' }}>
          <h2 style={{ fontWeight: 500, fontSize: type.heading, color: color.textOnDark.primary, margin: '0 0 8px' }}>
            Welcome to Purema, {firstName}.
          </h2>
          <p style={{ color: color.textOnDark.secondary, fontSize: type.body, lineHeight: 1.6, marginBottom: 0 }}>
            {coachName
              ? <>You've been paired with <strong style={{ color: color.textOnDark.primary }}>{coachName}</strong>, who'll review your weekly check-ins and keep your plan on track.</>
              : "You're all set up with your coach, who'll review your weekly check-ins and keep your plan on track."}
          </p>
          <p style={{ color: color.textOnDark.faint, fontSize: type.label, marginTop: 16, marginBottom: 24 }}>
            First, a couple of quick questions so your coach has context from day one.
          </p>
          <PrimaryButton onClick={() => setStep(2)}>Get started</PrimaryButton>
        </div>
      )}

      {step === 2 && (
        <div>
          <h2 style={{ fontWeight: 500, fontSize: type.heading, color: color.textOnDark.primary, margin: '0 0 20px' }}>
            A bit about you
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <label style={labelStyle(true)}>Current weight ({weightUnit})</label>
              <input type="number" step="0.1" min="0" placeholder={`e.g. 165`}
                value={weight} onChange={e => setWeight(e.target.value)} style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle(true)}>Primary goal</label>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {GOALS.map(g => (
                  <button key={g.value} type="button" onClick={() => setGoal(g.value)}
                    style={{ padding: '8px 14px', borderRadius: 8, cursor: 'pointer',
                      border: `1px solid ${goal === g.value ? color.forest : color.borderDark}`,
                      background: goal === g.value ? color.forest : 'transparent',
                      color: goal === g.value ? color.textOnDark.primary : color.textOnDark.secondary,
                      fontFamily: font.sans, fontSize: type.body, fontWeight: goal === g.value ? 500 : 400 }}>
                    {g.label}
                  </button>
                ))}
              </div>
            </div>
            {goal === 'competition_prep' && (
              <div>
                <label style={labelStyle(true)}>Competition date (optional)</label>
                <input type="date" value={competitionDate} onChange={e => setCompetitionDate(e.target.value)} style={inputStyle} />
              </div>
            )}
            <div>
              <label style={labelStyle(true)}>Dietary restrictions or allergies (optional)</label>
              <textarea rows={3} placeholder="e.g. lactose intolerant, tree nut allergy, vegetarian..."
                value={dietary} onChange={e => setDietary(e.target.value)}
                style={{ ...inputStyle, resize: 'none', fontFamily: font.sans }} />
            </div>
          </div>
          <PrimaryButton onClick={() => setStep(3)} disabled={!weight || !goal}>Continue</PrimaryButton>
          <SecondaryButton onClick={() => setStep(1)}>Back</SecondaryButton>
        </div>
      )}

      {step === 3 && (
        <div>
          <h2 style={{ fontWeight: 500, fontSize: type.heading, color: color.textOnDark.primary, margin: '0 0 20px' }}>
            Look good?
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 8 }}>
            {[
              ['Starting weight', weight ? `${weight} ${weightUnit}` : '—'],
              ['Primary goal', goalLabel],
              ...(goal === 'competition_prep' ? [['Competition date', competitionDate || 'Not set yet']] : []),
              ['Dietary notes', dietary.trim() || 'None'],
            ].map(([label, value]) => (
              <div key={label} style={{ display: 'flex', justifyContent: 'space-between', gap: 12,
                padding: '10px 0', borderBottom: `0.5px solid ${color.borderDark}` }}>
                <span style={{ fontSize: type.body, color: color.textOnDark.secondary }}>{label}</span>
                <span style={{ fontSize: type.body, color: color.textOnDark.primary, fontWeight: 500, textAlign: 'right' }}>{value}</span>
              </div>
            ))}
          </div>
          <p style={{ fontSize: type.label, color: color.textOnDark.faint, marginTop: 12, marginBottom: 4 }}>
            {coachName || 'Your coach'} will see this on your profile. You can update it anytime in Settings.
          </p>
          {error && <p style={{ color: color.alert, fontSize: type.body, marginTop: 8 }}>{error}</p>}
          <PrimaryButton onClick={handleFinish} disabled={saving}>
            {saving ? 'Saving...' : 'Get started'}
          </PrimaryButton>
          <SecondaryButton onClick={() => setStep(2)} disabled={saving}>Back</SecondaryButton>
        </div>
      )}
    </Shell>
  )
}
