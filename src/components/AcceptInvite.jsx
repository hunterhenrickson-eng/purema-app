import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { color, font } from '../lib/theme';

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

    const { error: profileError } = await supabase.from('profiles').insert({
      id: newUserId,
      role: 'client',
      full_name: fullName,
      email: invite.email,
      coach_id: invite.coach_id,
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

  if (status === 'loading') return <p style={{ padding: 40, fontFamily: font.sans }}>Loading invite...</p>;
  if (status === 'invalid') return <p style={{ padding: 40, fontFamily: font.sans }}>This invite link is invalid.</p>;
  if (status === 'used') return <p style={{ padding: 40, fontFamily: font.sans }}>This invite has already been used.</p>;
  if (status === 'expired') return <p style={{ padding: 40, fontFamily: font.sans }}>This invite link has expired.</p>;

  return (
    <div style={{ maxWidth: 400, margin: '60px auto', fontFamily: font.sans }}>
      <h2 style={{ fontWeight: 500 }}>Welcome to Purema</h2>
      <p style={{ marginBottom: 24, color: color.textOnLight.secondary }}>
        You've been invited to join as a client. Set a password to finish
        creating your account for <strong>{invite.email}</strong>.
      </p>

      <form onSubmit={handleSignup} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <input
          type="text"
          required
          placeholder="Full name"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          style={{ padding: '10px 12px', borderRadius: 8, border: `1px solid ${color.borderLight}` }}
        />
        <input
          type="password"
          required
          minLength={6}
          placeholder="Create a password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          style={{ padding: '10px 12px', borderRadius: 8, border: `1px solid ${color.borderLight}` }}
        />
        <button
          type="submit"
          disabled={submitting}
          style={{
            padding: '12px',
            borderRadius: 8,
            border: 'none',
            background: color.forest,
            color: color.sage,
            fontWeight: 500,
            cursor: 'pointer',
          }}
        >
          {submitting ? 'Creating account...' : 'Create Account'}
        </button>
      </form>

      {error && <p style={{ color: color.alert, marginTop: 12 }}>{error}</p>}
    </div>
  );
}