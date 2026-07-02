import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { color, font, type, labelStyle } from '../lib/theme';

export default function InviteClient() {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('client');
  const [link, setLink] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  async function handleInvite(e) {
    e.preventDefault();
    setError(null);
    setLink(null);
    setLoading(true);

    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      setError('You must be logged in to send invites.');
      setLoading(false);
      return;
    }

    const { data, error: insertError } = await supabase
      .from('invites')
      .insert({ coach_id: user.id, email, role })
      .select('token')
      .single();

    setLoading(false);

    if (insertError) {
      setError(insertError.message);
      return;
    }

    setLink(`${window.location.origin}/invite/${data.token}`);
    setEmail('');
  }

  function handleCopy() {
    navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const roleLabel = role === 'client' ? 'Client' : 'Coach';
  const roleBg = role === 'client' ? color.sage : '#FAEEDA';
  const roleColor = role === 'client' ? '#1A5C0A' : '#633806';

  return (
    <div>
      <div style={{ ...labelStyle(false), marginBottom: 14 }}>
        Invite someone
      </div>

      {/* Role toggle */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
        {['client', 'coach'].map(r => (
          <button key={r} onClick={() => setRole(r)}
            style={{ padding: '6px 14px', borderRadius: 6, border: 'none', cursor: 'pointer',
              fontFamily: font.sans, fontSize: type.label, fontWeight: 500,
              background: role === r ? color.void : '#F0EDE8',
              color: role === r ? color.textOnDark.primary : color.textOnLight.secondary,
              transition: 'all 0.15s ease' }}>
            {r === 'client' ? 'As a client' : 'As a coach'}
          </button>
        ))}
      </div>

      {/* Email + submit */}
      <form onSubmit={handleInvite} style={{ display: 'flex', gap: 8 }}>
        <input
          type="email"
          required
          placeholder="their@email.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          style={{ flex: 1, padding: '10px 12px', borderRadius: 8,
            border: `1px solid ${color.borderLight}`, fontFamily: font.sans,
            fontSize: type.body, outline: 'none', color: color.textOnLight.primary }}
        />
        <button type="submit" disabled={loading}
          style={{ padding: '10px 18px', borderRadius: 8, border: 'none',
            background: loading ? color.textOnLight.faint : color.forest, color: color.textOnDark.primary,
            fontFamily: font.sans, fontWeight: 500, cursor: loading ? 'not-allowed' : 'pointer',
            fontSize: type.body, whiteSpace: 'nowrap' }}>
          {loading ? 'Generating...' : `Invite as ${roleLabel}`}
        </button>
      </form>

      {error && (
        <p style={{ color: color.alert, marginTop: 8, fontSize: type.body }}>{error}</p>
      )}

      {link && (
        <div style={{ marginTop: 12, padding: 12, background: roleBg, borderRadius: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <span style={{ fontSize: type.label, background: '#fff', color: roleColor,
              padding: '2px 8px', borderRadius: 999, fontFamily: font.mono,
              fontWeight: 500, border: `1px solid ${roleBg}` }}>
              {roleLabel} invite
            </span>
            <span style={{ fontSize: type.label, color: color.textOnLight.secondary }}>Share this link:</span>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <code style={{ fontSize: type.label, wordBreak: 'break-all', flex: 1, color: color.textOnLight.primary }}>
              {link}
            </code>
            <button onClick={handleCopy}
              style={{ padding: '6px 10px', borderRadius: 6, border: `1px solid ${color.forest}`,
                background: 'transparent', color: color.forest, fontSize: type.label,
                cursor: 'pointer', whiteSpace: 'nowrap' }}>
              {copied ? 'Copied!' : 'Copy'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}