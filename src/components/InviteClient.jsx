import { useState } from 'react';
import { supabase } from '../lib/supabase';

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
  const roleBg = role === 'client' ? '#EAF3DE' : '#FAEEDA';
  const roleColor = role === 'client' ? '#1A5C0A' : '#633806';

  return (
    <div>
      <div style={{ fontSize: 10, fontWeight: 500, color: '#888', letterSpacing: '0.1em',
        textTransform: 'uppercase', fontFamily: 'DM Mono, monospace', marginBottom: 14 }}>
        Invite someone
      </div>

      {/* Role toggle */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
        {['client', 'coach'].map(r => (
          <button key={r} onClick={() => setRole(r)}
            style={{ padding: '6px 14px', borderRadius: 6, border: 'none', cursor: 'pointer',
              fontFamily: 'DM Sans, sans-serif', fontSize: 12, fontWeight: 500,
              background: role === r ? '#0D0D0D' : '#F0EDE8',
              color: role === r ? '#F5F2ED' : '#888',
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
            border: '1px solid #E8E8E8', fontFamily: 'DM Sans',
            fontSize: 14, outline: 'none', color: '#0D0D0D' }}
        />
        <button type="submit" disabled={loading}
          style={{ padding: '10px 18px', borderRadius: 8, border: 'none',
            background: loading ? '#AAA' : '#0F6E56', color: '#F5F2ED',
            fontFamily: 'DM Sans', fontWeight: 500, cursor: loading ? 'not-allowed' : 'pointer',
            fontSize: 14, whiteSpace: 'nowrap' }}>
          {loading ? 'Generating...' : `Invite as ${roleLabel}`}
        </button>
      </form>

      {error && (
        <p style={{ color: '#E24B4A', marginTop: 8, fontSize: 13 }}>{error}</p>
      )}

      {link && (
        <div style={{ marginTop: 12, padding: 12, background: roleBg, borderRadius: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <span style={{ fontSize: 11, background: '#fff', color: roleColor,
              padding: '2px 8px', borderRadius: 999, fontFamily: 'DM Mono, monospace',
              fontWeight: 500, border: `1px solid ${roleBg}` }}>
              {roleLabel} invite
            </span>
            <span style={{ fontSize: 12, color: '#555' }}>Share this link:</span>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <code style={{ fontSize: 12, wordBreak: 'break-all', flex: 1, color: '#0D0D0D' }}>
              {link}
            </code>
            <button onClick={handleCopy}
              style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid #0F6E56',
                background: 'transparent', color: '#0F6E56', fontSize: 12,
                cursor: 'pointer', whiteSpace: 'nowrap' }}>
              {copied ? 'Copied!' : 'Copy'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}