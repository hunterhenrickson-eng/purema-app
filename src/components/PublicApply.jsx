import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import {
  color as staticColor, appearance, font, type,
  labelStyleAppearance as labelStyle, inputStyleAppearance as inputStyle,
} from '../lib/theme';
import '../styles/purema-responsive.css';

// Pre-auth marketing/public page, deliberately converted to light — same
// light-side shadow pattern as Home.js/Pricing.js (see those files' own
// top-of-file comments). This is a one-page exception: AcceptInvite.jsx/
// ClientOnboarding.jsx/Auth.js/ResetPassword.jsx stay dark-only and are not
// touched here.
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

const Shell = ({ children }) => (
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
      borderRadius: 16, border: `0.5px solid ${color.borderLight}`, padding: 32, maxWidth: 400, width: '100%' }}>
      {children}
    </div>
  </div>
)

// Resolves the slug to a coach id via a security-definer RPC rather than a
// direct SELECT on profiles — keeps unauthenticated visitors from being able
// to read arbitrary profile columns, same reasoning as the existing
// my_coach_id() helper used elsewhere for RLS-safe scoped reads.
export default function PublicApply({ slug }) {
  const [status, setStatus] = useState('loading');
  const [coachId, setCoachId] = useState(null);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
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

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    const { error: insertError } = await supabase.from('client_applications').insert({
      coach_id: coachId,
      name,
      email,
      phone: phone || null,
      notes: notes || null,
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

  return (
    <Shell>
      <h2 style={{ fontWeight: 500, fontSize: type.heading, color: color.textOnLight.primary, margin: '0 0 8px' }}>Apply to work together</h2>
      <p style={{ marginBottom: 24, color: color.textOnLight.secondary, fontSize: type.body }}>
        Tell your coach a bit about yourself and your goals.
      </p>

      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
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
        <div>
          <label style={labelStyle()}>Goals / notes</label>
          <textarea rows={4} value={notes} onChange={(e) => setNotes(e.target.value)}
            style={{ ...inputStyle, resize: 'vertical' }} />
        </div>
        <button
          type="submit"
          disabled={submitting}
          style={{
            padding: '12px',
            borderRadius: 8,
            border: 'none',
            background: submitting ? color.borderLight : color.forest,
            color: submitting ? color.textOnLight.faint : color.sage,
            fontWeight: 500,
            fontSize: type.body,
            fontFamily: font.sans,
            cursor: submitting ? 'not-allowed' : 'pointer',
            marginTop: 4,
          }}
        >
          {submitting ? 'Submitting...' : 'Submit application'}
        </button>
      </form>

      {error && <p style={{ color: color.alert, marginTop: 12, fontSize: type.body }}>{error}</p>}
    </Shell>
  );
}
