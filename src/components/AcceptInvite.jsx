import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { color, font, type, labelStyle, inputStyle } from '../lib/theme';
import '../styles/purema-responsive.css';

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
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 40 }}>
      <Mark size={40} />
      <div style={{ fontSize: type.display, fontWeight: 300, letterSpacing: '-0.03em',
        color: color.textOnDark.primary, marginTop: 12 }}>
        purema<span style={{ color: color.forest }}>.</span>
      </div>
    </div>
    <div className="purema-card" style={{ background: color.surfaceDark,
      borderRadius: 16, border: `0.5px solid ${color.borderDark}`, padding: 32, maxWidth: 400, width: '100%' }}>
      {children}
    </div>
  </div>
)

export default function AcceptInvite({ token }) {
  const [invite, setInvite] = useState(null);
  const [status, setStatus] = useState('loading');
  const [fullName, setFullName] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function validateToken() {
      const { data, error } = await supabase
        .from('invites')
        .select('*')
        .eq('token', token)
        .single();

      if (error || !data) { setStatus('invalid'); return; }
      if (data.used) { setStatus('used'); return; }
      if (new Date(data.expires_at) < new Date()) { setStatus('expired'); return; }

      setInvite(data);
      setStatus('valid');
    }

    validateToken();
  }, [token]);

  async function handleSignup(e) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
      email: invite.email,
      password,
    });

    if (signUpError) {
      setError(signUpError.message);
      setSubmitting(false);
      return;
    }

    const newUserId = signUpData.user.id;
    // Previously collapsed anything non-'coach' to 'client', which would
    // have silently mis-provisioned an employee invite as a client account
    // — role must pass through all three values now that 'admin' exists.
    const role = invite.role === 'coach' ? 'coach' : invite.role === 'admin' ? 'admin' : 'client';

    const { error: profileError } = await supabase.from('profiles').insert({
      id: newUserId,
      role,
      full_name: fullName,
      email: invite.email,
      // coach_id links a client to the coach who invited them — a new coach
      // or employee isn't anyone's client, so this stays null for those.
      coach_id: role === 'client' ? invite.coach_id : null,
      admin_role_id: role === 'admin' ? invite.admin_role_id : null,
    });

    if (profileError) {
      setError(profileError.message);
      setSubmitting(false);
      return;
    }

    await supabase.from('invites').update({ used: true }).eq('id', invite.id);

    setSubmitting(false);
    window.location.href = '/';
  }

  if (status === 'loading') return <Shell><p style={{ color: color.textOnDark.secondary, fontSize: type.body, margin: 0 }}>Loading invite...</p></Shell>;
  if (status === 'invalid') return <Shell><p style={{ color: color.textOnDark.secondary, fontSize: type.body, margin: 0 }}>This invite link is invalid.</p></Shell>;
  if (status === 'used') return <Shell><p style={{ color: color.textOnDark.secondary, fontSize: type.body, margin: 0 }}>This invite has already been used.</p></Shell>;
  if (status === 'expired') return <Shell><p style={{ color: color.textOnDark.secondary, fontSize: type.body, margin: 0 }}>This invite link has expired.</p></Shell>;

  return (
    <Shell>
      <h2 style={{ fontWeight: 500, fontSize: type.heading, color: color.textOnDark.primary, margin: '0 0 8px' }}>Welcome to Purema</h2>
      <p style={{ marginBottom: 24, color: color.textOnDark.secondary, fontSize: type.body }}>
        You've been invited to join as a {invite.role === 'coach' ? 'coach' : invite.role === 'admin' ? 'team member' : 'client'}. Set a password to finish
        creating your account for <strong style={{ color: color.textOnDark.primary }}>{invite.email}</strong>.
      </p>

      <form onSubmit={handleSignup} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div>
          <label style={labelStyle(true)}>Full name</label>
          <input
            type="text"
            required
            placeholder="First and last name"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            style={inputStyle}
          />
        </div>
        <div>
          <label style={labelStyle(true)}>Password</label>
          <input
            type="password"
            required
            minLength={6}
            placeholder="Min 6 characters"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={inputStyle}
          />
        </div>
        <button
          type="submit"
          disabled={submitting}
          style={{
            padding: '12px',
            borderRadius: 8,
            border: 'none',
            background: submitting ? color.textOnDark.faint : color.forest,
            color: color.textOnDark.primary,
            fontWeight: 500,
            fontSize: type.body,
            fontFamily: font.sans,
            cursor: submitting ? 'not-allowed' : 'pointer',
            marginTop: 4,
          }}
        >
          {submitting ? 'Creating account...' : 'Create Account'}
        </button>
      </form>

      {error && <p style={{ color: color.alert, marginTop: 12, fontSize: type.body }}>{error}</p>}
    </Shell>
  );
}