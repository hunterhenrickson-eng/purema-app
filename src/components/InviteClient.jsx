import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { font, type, labelStyleAppearance, badge } from '../lib/theme';
import { useAppearance } from '../lib/AppearanceContext';

// Shared with the Requests tab's Approve action and the admin employee-
// invite flow, so every invite path (client, coach, employee) funnels
// through one implementation rather than three parallel ones. adminRoleId
// is only meaningful when role === 'admin' — every other caller omits it.
export async function createInvite(coachId, email, role, adminRoleId = null) {
  const { data, error } = await supabase
    .from('invites')
    .insert({ coach_id: coachId, email, role, admin_role_id: adminRoleId })
    .select('id, token')
    .single();

  if (error) return { ok: false, message: error.message };
  return { ok: true, link: `${window.location.origin}/invite/${data.token}`, inviteId: data.id };
}

export default function InviteClient({ atLimit = false, onUpgradeClick } = {}) {
  const { color } = useAppearance();
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('client');
  const [link, setLink] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  // Coach invites aren't subject to a client-count limit — only blocks the
  // 'client' role.
  const blocked = atLimit && role === 'client';

  async function handleInvite(e) {
    e.preventDefault();
    if (blocked) return;
    setError(null);
    setLink(null);
    setLoading(true);

    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      setError('You must be logged in to send invites.');
      setLoading(false);
      return;
    }

    const result = await createInvite(user.id, email, role);
    setLoading(false);

    if (!result.ok) {
      setError(result.message);
      return;
    }

    setLink(result.link);
    setEmail('');
  }

  function handleCopy() {
    navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const roleLabel = role === 'client' ? 'Client' : 'Coach';
  const roleBadge = badge(role === 'client' ? 'success' : 'warning');

  return (
    <div>
      <div style={{ ...labelStyleAppearance(), marginBottom: 14 }}>
        Invite someone
      </div>

      {/* Role toggle */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
        {['client', 'coach'].map(r => (
          <button key={r} onClick={() => setRole(r)}
            style={{ padding: '6px 14px', borderRadius: 6, border: 'none', cursor: 'pointer',
              fontFamily: font.sans, fontSize: type.label, fontWeight: 500,
              background: role === r ? color.void : color.surfaceSunken,
              color: role === r ? color.textOnDark.primary : color.textOnLight.secondary,
              transition: 'all 0.15s ease' }}>
            {r === 'client' ? 'As a client' : 'As a coach'}
          </button>
        ))}
      </div>

      {blocked ? (
        <div style={{ padding: 12, background: badge('warning').background, borderRadius: 8,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
          <span style={{ fontSize: type.body, color: badge('warning').color }}>
            You've reached your plan's client limit.
          </span>
          {onUpgradeClick && (
            <button onClick={onUpgradeClick} type="button"
              style={{ padding: '6px 14px', borderRadius: 6, border: `1px solid ${color.gold}`,
                background: 'transparent', color: color.gold, fontFamily: font.sans,
                fontSize: type.label, fontWeight: 500, cursor: 'pointer', whiteSpace: 'nowrap' }}>
              Upgrade plan
            </button>
          )}
        </div>
      ) : (
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
      )}

      {error && (
        <p style={{ color: color.alert, marginTop: 8, fontSize: type.body }}>{error}</p>
      )}

      {link && (
        <div style={{ marginTop: 12, padding: 12, background: roleBadge.background, borderRadius: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
            <span style={{ ...roleBadge, background: color.surfaceLight, border: `1px solid ${roleBadge.background}` }}>
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