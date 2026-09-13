import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import {
  color as staticColor, appearance, font, type,
  labelStyleAppearance as labelStyle, inputStyleAppearance as inputStyle,
} from '../lib/theme';
import { SectionHeader, StepProgress, StepNav } from './StepFlow';
import '../styles/purema-responsive.css';

// Pre-auth marketing/public page, deliberately converted to light — same
// light-side shadow pattern as Home.js/Pricing.js (see those files' own
// top-of-file comments), including forcing data-appearance="light" so it
// ignores system dark-mode preference like they do. This is a one-page
// exception: AcceptInvite.jsx/ClientOnboarding.jsx/Auth.js/ResetPassword.jsx
// stay dark-only and are not touched here.
const color = {
  ...staticColor,
  bone: appearance.surfacePage,
  surfaceLight: appearance.surfaceCard,
  borderLight: appearance.borderDefault,
  textOnLight: appearance.text,
}

const Mark = ({ size = 32 }) => (
  <svg width={size} height={size * 0.9} viewBox="0 0 52 48">
    <polyline points="6,10 18,24 6,38" fill="none" stroke={color.forest} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    <polyline points="19,10 31,24 19,38" fill="none" stroke={color.forest} strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"/>
    <polyline points="32,10 46,24 32,38" fill="none" stroke={color.forest} strokeWidth="5.5" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
)

// Wider than the original single-card Shell (400px) now that the form has
// real content per step — matches CheckInForm.js's card width class for the
// same reason (`purema-card` still supplies the same shadow/radius rules).
const Shell = ({ children, wide = false }) => (
  <div style={{ minHeight: '100vh', background: color.bone, display: 'flex',
    flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
    padding: 24, fontFamily: font.sans }}>
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 40 }}>
      <Mark size={40} />
      <div style={{ fontSize: type.display, fontWeight: 300, letterSpacing: '-0.03em',
        color: color.textOnLight.primary, marginTop: 12 }}>
        purema<span style={{ color: color.forest }}>.</span>
      </div>
    </div>
    <div className="purema-card" style={{ background: color.surfaceLight,
      borderRadius: 16, border: `0.5px solid ${color.borderLight}`, padding: 32,
      maxWidth: wide ? 520 : 400, width: '100%' }}>
      {children}
    </div>
  </div>
)

// Every jsonb group is stored null rather than {} when the applicant left
// the whole section blank — cleaner for the coach-side "no data" check than
// an empty object, and avoids writing 4 near-empty jsonb blobs on every row.
function cleanGroup(obj) {
  const entries = Object.entries(obj).filter(([, v]) => v !== '' && v != null)
  return entries.length ? Object.fromEntries(entries) : null
}

const TOTAL_STEPS = 6

// Resolves the slug to a coach id via a security-definer RPC rather than a
// direct SELECT on profiles — keeps unauthenticated visitors from being able
// to read arbitrary profile columns, same reasoning as the existing
// my_coach_id() helper used elsewhere for RLS-safe scoped reads.
export default function PublicApply({ slug }) {
  // Force light regardless of system preference — see Home.js's top-of-file
  // comment for the full mechanism/reasoning. No unmount cleanup needed for
  // the same reason as Home.js (no client-side routing in this app).
  useEffect(() => {
    document.documentElement.setAttribute('data-appearance', 'light');
  }, []);

  const [status, setStatus] = useState('loading');
  const [coachId, setCoachId] = useState(null);
  const [step, setStep] = useState(0);

  // ── Step 1: Basics ──
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');

  // ── Step 2: Goals ──
  const [goals, setGoals] = useState({ primary_goal: '', target_show_date: '', competition_history: '' });
  // ── Step 3: Training ──
  const [training, setTraining] = useState({ experience_level: '', current_split: '', injuries_limitations: '' });
  // ── Step 4: Nutrition ──
  const [nutrition, setNutrition] = useState({ tracking_experience: '', dietary_restrictions: '' });
  // ── Step 5: Logistics ──
  const [logistics, setLogistics] = useState({ budget_tier_interest: '', checkin_availability: '' });
  // ── Step 6: Notes ──
  const [notes, setNotes] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function resolveSlug() {
      const { data, error } = await supabase.rpc('coach_id_for_slug', { p_slug: slug });
      if (error || !data) { setStatus('invalid'); return; }
      setCoachId(data);
      setStatus('ready');
    }
    resolveSlug();
  }, [slug]);

  async function handleSubmit() {
    setError(null);
    setSubmitting(true);

    const { error: insertError } = await supabase.from('client_applications').insert({
      coach_id: coachId,
      name,
      email,
      phone: phone || null,
      notes: notes || null,
      goals: cleanGroup(goals),
      training: cleanGroup(training),
      nutrition: cleanGroup(nutrition),
      logistics: cleanGroup(logistics),
    });

    setSubmitting(false);

    if (insertError) {
      setError(insertError.message);
      return;
    }

    setStatus('submitted');
  }

  if (status === 'loading') return <Shell><p style={{ color: color.textOnLight.secondary, fontSize: type.body, margin: 0 }}>Loading...</p></Shell>;
  if (status === 'invalid') return <Shell><p style={{ color: color.textOnLight.secondary, fontSize: type.body, margin: 0 }}>This application link isn't valid.</p></Shell>;

  if (status === 'submitted') {
    return (
      <Shell>
        <h2 style={{ fontWeight: 500, fontSize: type.heading, color: color.textOnLight.primary, margin: '0 0 8px' }}>Application received</h2>
        <p style={{ color: color.textOnLight.secondary, fontSize: type.body, margin: 0 }}>
          Thanks — your coach will be in touch soon.
        </p>
      </Shell>
    );
  }

  // Basics (step 0) requires name + email before moving on — every later
  // step is optional, matching the original form's low-friction intent for
  // everything past identity/contact info.
  const basicsValid = name.trim() !== '' && email.trim() !== '';
  const canAdvance = step !== 0 || basicsValid;

  return (
    <Shell wide>
      <h2 style={{ fontWeight: 500, fontSize: type.heading, color: color.textOnLight.primary, margin: '0 0 4px' }}>Apply to work together</h2>
      <p style={{ marginBottom: 20, color: color.textOnLight.secondary, fontSize: type.body }}>
        Tell your coach a bit about yourself and your goals.
      </p>

      <StepProgress currentStep={step} totalSteps={TOTAL_STEPS} />

      {/* ── Step 0: Basics ─────────────────────────────────────────────── */}
      {step === 0 && (
        <div>
          <SectionHeader number="01" title="Basics" subtitle="How your coach will reach you" />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <label style={labelStyle()}>Name</label>
              <input type="text" required value={name} onChange={(e) => setName(e.target.value)} style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle()}>Email</label>
              <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle()}>Phone (optional)</label>
              <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} style={inputStyle} />
            </div>
          </div>
        </div>
      )}

      {/* ── Step 1: Goals ──────────────────────────────────────────────── */}
      {step === 1 && (
        <div>
          <SectionHeader number="02" title="Goals" subtitle="What you're working toward" />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <label style={labelStyle()}>Primary goal</label>
              <input type="text" placeholder="e.g. Fat loss, competition prep, general health"
                value={goals.primary_goal} onChange={(e) => setGoals(g => ({ ...g, primary_goal: e.target.value }))}
                style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle()}>Target show date (optional)</label>
              <input type="date" value={goals.target_show_date}
                onChange={(e) => setGoals(g => ({ ...g, target_show_date: e.target.value }))}
                style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle()}>Competition history (optional)</label>
              <textarea rows={3} value={goals.competition_history}
                onChange={(e) => setGoals(g => ({ ...g, competition_history: e.target.value }))}
                style={{ ...inputStyle, resize: 'vertical' }} />
            </div>
          </div>
        </div>
      )}

      {/* ── Step 2: Training ───────────────────────────────────────────── */}
      {step === 2 && (
        <div>
          <SectionHeader number="03" title="Training" subtitle="Your current training background" />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <label style={labelStyle()}>Experience level</label>
              <input type="text" placeholder="e.g. Beginner, 2 years lifting, former competitor"
                value={training.experience_level} onChange={(e) => setTraining(t => ({ ...t, experience_level: e.target.value }))}
                style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle()}>Current split</label>
              <input type="text" placeholder="e.g. Push/pull/legs, upper/lower, none right now"
                value={training.current_split} onChange={(e) => setTraining(t => ({ ...t, current_split: e.target.value }))}
                style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle()}>Injuries / limitations (optional)</label>
              <textarea rows={3} value={training.injuries_limitations}
                onChange={(e) => setTraining(t => ({ ...t, injuries_limitations: e.target.value }))}
                style={{ ...inputStyle, resize: 'vertical' }} />
            </div>
          </div>
        </div>
      )}

      {/* ── Step 3: Nutrition ──────────────────────────────────────────── */}
      {step === 3 && (
        <div>
          <SectionHeader number="04" title="Nutrition" subtitle="Your background with tracking and diet" />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <label style={labelStyle()}>Tracking experience</label>
              <input type="text" placeholder="e.g. Never tracked, count macros daily"
                value={nutrition.tracking_experience} onChange={(e) => setNutrition(n => ({ ...n, tracking_experience: e.target.value }))}
                style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle()}>Dietary restrictions (optional)</label>
              <textarea rows={3} placeholder="e.g. Vegetarian, lactose intolerant, none"
                value={nutrition.dietary_restrictions} onChange={(e) => setNutrition(n => ({ ...n, dietary_restrictions: e.target.value }))}
                style={{ ...inputStyle, resize: 'vertical' }} />
            </div>
          </div>
        </div>
      )}

      {/* ── Step 4: Logistics ──────────────────────────────────────────── */}
      {step === 4 && (
        <div>
          <SectionHeader number="05" title="Logistics" subtitle="Fit and availability" />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <label style={labelStyle()}>Budget / tier interest</label>
              <input type="text" placeholder="e.g. Looking for monthly check-ins under $200"
                value={logistics.budget_tier_interest} onChange={(e) => setLogistics(l => ({ ...l, budget_tier_interest: e.target.value }))}
                style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle()}>Check-in availability</label>
              <input type="text" placeholder="e.g. Weekly, Sunday evenings work best"
                value={logistics.checkin_availability} onChange={(e) => setLogistics(l => ({ ...l, checkin_availability: e.target.value }))}
                style={inputStyle} />
            </div>
          </div>
        </div>
      )}

      {/* ── Step 5: Notes ──────────────────────────────────────────────── */}
      {step === 5 && (
        <div>
          <SectionHeader number="06" title="Notes" subtitle="Anything else worth knowing" />
          <div>
            <label style={labelStyle()}>Anything else you'd like your coach to know? (optional)</label>
            <textarea rows={4} value={notes} onChange={(e) => setNotes(e.target.value)}
              style={{ ...inputStyle, resize: 'vertical' }} />
          </div>
        </div>
      )}

      <div style={{ marginTop: 20 }}>
        <StepNav
          currentStep={step}
          isLastStep={step === TOTAL_STEPS - 1}
          onBack={() => setStep(s => s - 1)}
          onNext={() => canAdvance && setStep(s => s + 1)}
          onSubmit={handleSubmit}
          submitLabel="Submit application"
          submitting={submitting}
        />
        {step === 0 && !basicsValid && (
          <p style={{ color: color.textOnLight.faint, fontSize: type.label, marginTop: 8 }}>
            Name and email are required to continue.
          </p>
        )}
      </div>

      {error && <p style={{ color: color.alert, marginTop: 12, fontSize: type.body }}>{error}</p>}
    </Shell>
  );
}
