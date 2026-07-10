import { useState, useEffect, useCallback } from 'react'
import Papa from 'papaparse'
import { supabase } from '../lib/supabase'
import { createInvite } from '../components/InviteClient'
import { color, font, type, labelStyle, badge, displayStyle, navItemStyle } from '../lib/theme'
import { hasPermission } from '../lib/adminPermissions'
import { planById } from '../lib/billing'
import { startImpersonation } from '../lib/impersonation'

function downloadFile(content, filename, mimeType) {
  const blob = new Blob([content], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

// The first real admin screen — everything else in the suite needs a way
// to onboard an employee before it's useful, so this comes before any of
// Phase 5's account/billing/platform panels.
const InviteEmployeePanel = ({ actorId }) => {
  const [roles, setRoles] = useState([])
  const [email, setEmail] = useState('')
  const [roleId, setRoleId] = useState('')
  const [loading, setLoading] = useState(false)
  const [link, setLink] = useState(null)
  const [error, setError] = useState(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    async function loadRoles() {
      const { data, error: rolesError } = await supabase.from('admin_roles').select('*').order('name')
      if (!rolesError && data) {
        setRoles(data)
        if (data.length > 0) setRoleId(data[0].id)
      }
    }
    loadRoles()
  }, [])

  const handleInvite = async (e) => {
    e.preventDefault()
    setError(null)
    setLink(null)
    if (!roleId) { setError('Pick a role.'); return }
    setLoading(true)

    const result = await createInvite(actorId, email, 'admin', roleId)
    setLoading(false)

    if (!result.ok) {
      setError(result.message)
      return
    }

    // Best-effort — the invite itself is already created either way, so a
    // logging failure here shouldn't block the coach from getting their link.
    await supabase.from('admin_audit_log').insert({
      actor_id: actorId, action: 'employee.invite_created',
      target_type: 'invite', target_id: result.inviteId,
      after_value: { email, admin_role_id: roleId },
    })

    setLink(result.link)
    setEmail('')
  }

  const handleCopy = () => {
    navigator.clipboard.writeText(link)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div style={{ background: color.surfaceLight, border: `0.5px solid ${color.borderLight}`,
      borderRadius: 12, padding: 20, maxWidth: 480 }}>
      <div style={{ ...labelStyle(false), marginBottom: 14 }}>Invite employee</div>

      <form onSubmit={handleInvite} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div>
          <label style={labelStyle(false)}>Email</label>
          <input type="email" required placeholder="their@email.com" value={email}
            onChange={e => setEmail(e.target.value)}
            style={{ width: '100%', padding: '10px 12px', borderRadius: 8,
              border: `1px solid ${color.borderLight}`, fontFamily: font.sans,
              fontSize: type.body, outline: 'none', color: color.textOnLight.primary, boxSizing: 'border-box' }} />
        </div>
        <div>
          <label style={labelStyle(false)}>Role</label>
          <select value={roleId} onChange={e => setRoleId(e.target.value)}
            style={{ width: '100%', padding: '10px 12px', borderRadius: 8,
              border: `1px solid ${color.borderLight}`, fontFamily: font.sans,
              fontSize: type.body, outline: 'none', color: color.textOnLight.primary,
              background: color.surfaceLight, boxSizing: 'border-box' }}>
            {roles.map(r => (
              <option key={r.id} value={r.id}>{r.name}</option>
            ))}
          </select>
          {roles.find(r => r.id === roleId)?.description && (
            <div style={{ fontSize: type.label, color: color.textOnLight.faint, marginTop: 4 }}>
              {roles.find(r => r.id === roleId).description}
            </div>
          )}
        </div>
        <button type="submit" disabled={loading}
          style={{ padding: '10px 18px', borderRadius: 8, border: 'none',
            background: loading ? color.textOnLight.faint : color.forest, color: color.sage,
            fontFamily: font.sans, fontWeight: 500, cursor: loading ? 'not-allowed' : 'pointer',
            fontSize: type.body, alignSelf: 'flex-start' }}>
          {loading ? 'Generating...' : 'Invite as employee'}
        </button>
      </form>

      {error && <p style={{ color: color.alert, marginTop: 12, fontSize: type.body }}>{error}</p>}

      {link && (
        <div style={{ marginTop: 16, padding: 12, background: color.sage, borderRadius: 8 }}>
          <div style={{ fontSize: type.label, color: color.textOnLight.secondary, marginBottom: 6 }}>
            Share this link:
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
  )
}

// Filterable by actor/action/date range, exportable as CSV/JSON — the
// original standalone priority item, now living inside the broader suite.
// admin_audit_log's SELECT policy already lets any admin see every actor's
// entries (an oversight tool, not scoped to "your own actions"), so no new
// RLS is needed here — this is a pure read + client-side filter/export.
const AuditLogViewer = () => {
  const [entries, setEntries] = useState(null)
  const [admins, setAdmins] = useState([])
  const [actorFilter, setActorFilter] = useState('')
  const [actionFilter, setActionFilter] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [expandedId, setExpandedId] = useState(null)

  const LIMIT = 200

  useEffect(() => {
    async function loadAdmins() {
      const { data } = await supabase.from('profiles').select('id, full_name, email').eq('role', 'admin').order('full_name')
      setAdmins(data || [])
    }
    loadAdmins()
  }, [])

  const runQuery = useCallback(async () => {
    setLoading(true)
    setError(null)

    let query = supabase.from('admin_audit_log')
      .select('*, actor:profiles(full_name, email)')
      .order('created_at', { ascending: false })
      .limit(LIMIT)

    if (actorFilter) query = query.eq('actor_id', actorFilter)
    if (actionFilter.trim()) query = query.ilike('action', `%${actionFilter.trim()}%`)
    if (startDate) query = query.gte('created_at', `${startDate}T00:00:00`)
    if (endDate) query = query.lte('created_at', `${endDate}T23:59:59`)

    const { data, error: queryError } = await query
    setLoading(false)

    if (queryError) { setError(queryError.message); return }
    setEntries(data || [])
  }, [actorFilter, actionFilter, startDate, endDate])

  useEffect(() => { runQuery() }, [runQuery])

  const actorLabel = (e) => e.actor?.full_name || e.actor?.email || e.actor_id || '—'

  const exportRows = () => (entries || []).map(e => ({
    timestamp: e.created_at,
    actor: actorLabel(e),
    action: e.action,
    target_type: e.target_type,
    target_id: e.target_id || '',
    before_value: e.before_value ? JSON.stringify(e.before_value) : '',
    after_value: e.after_value ? JSON.stringify(e.after_value) : '',
  }))

  const exportCSV = () => {
    const csv = Papa.unparse(exportRows())
    downloadFile(csv, `audit-log-${new Date().toISOString().slice(0, 10)}.csv`, 'text/csv')
  }

  const exportJSON = () => {
    downloadFile(JSON.stringify(entries || [], null, 2), `audit-log-${new Date().toISOString().slice(0, 10)}.json`, 'application/json')
  }

  const selectStyle = {
    width: '100%', padding: '8px 10px', borderRadius: 8, border: `1px solid ${color.borderLight}`,
    fontFamily: font.sans, fontSize: type.body, outline: 'none', color: color.textOnLight.primary,
    background: color.surfaceLight, boxSizing: 'border-box',
  }

  return (
    <div style={{ background: color.surfaceLight, border: `0.5px solid ${color.borderLight}`,
      borderRadius: 12, padding: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, flexWrap: 'wrap', gap: 10 }}>
        <div style={{ ...labelStyle(false), marginBottom: 0 }}>Audit log</div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={exportCSV} disabled={!entries || entries.length === 0}
            style={{ padding: '6px 12px', borderRadius: 6, border: `1px solid ${color.borderLight}`,
              background: 'transparent', color: color.textOnLight.secondary, fontFamily: font.mono,
              fontSize: type.label, cursor: entries?.length ? 'pointer' : 'not-allowed' }}>
            Export CSV
          </button>
          <button onClick={exportJSON} disabled={!entries || entries.length === 0}
            style={{ padding: '6px 12px', borderRadius: 6, border: `1px solid ${color.borderLight}`,
              background: 'transparent', color: color.textOnLight.secondary, fontFamily: font.mono,
              fontSize: type.label, cursor: entries?.length ? 'pointer' : 'not-allowed' }}>
            Export JSON
          </button>
        </div>
      </div>

      {/* Filters */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 10, marginBottom: 16 }}>
        <div>
          <label style={labelStyle(false)}>Actor</label>
          <select value={actorFilter} onChange={e => setActorFilter(e.target.value)} style={selectStyle}>
            <option value="">All actors</option>
            {admins.map(a => (
              <option key={a.id} value={a.id}>{a.full_name || a.email}</option>
            ))}
          </select>
        </div>
        <div>
          <label style={labelStyle(false)}>Action contains</label>
          <input type="text" placeholder="e.g. invite" value={actionFilter}
            onChange={e => setActionFilter(e.target.value)} style={selectStyle} />
        </div>
        <div>
          <label style={labelStyle(false)}>From</label>
          <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} style={selectStyle} />
        </div>
        <div>
          <label style={labelStyle(false)}>To</label>
          <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} style={selectStyle} />
        </div>
      </div>

      {error && <div style={{ fontSize: type.body, color: color.alert, marginBottom: 12 }}>{error}</div>}

      {loading ? (
        <div style={{ fontSize: type.body, color: color.textOnLight.secondary }}>Loading...</div>
      ) : !entries || entries.length === 0 ? (
        <div style={{ fontSize: type.body, color: color.textOnLight.secondary, textAlign: 'center', padding: '32px 0' }}>
          No entries match these filters.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {entries.map(e => (
            <div key={e.id} style={{ background: color.bone, borderRadius: 8, padding: '10px 12px' }}>
              <div onClick={() => setExpandedId(expandedId === e.id ? null : e.id)}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  cursor: (e.before_value || e.after_value) ? 'pointer' : 'default', gap: 12, flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: type.label, color: color.textOnLight.faint, fontFamily: font.mono, whiteSpace: 'nowrap' }}>
                    {new Date(e.created_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                  </span>
                  <span style={{ fontSize: type.body, color: color.textOnLight.primary, fontWeight: 500 }}>
                    {actorLabel(e)}
                  </span>
                  <span style={{ fontSize: type.label, color: color.forest, fontFamily: font.mono }}>
                    {e.action}
                  </span>
                  <span style={{ fontSize: type.label, color: color.textOnLight.secondary }}>
                    {e.target_type}{e.target_id ? ` · ${e.target_id}` : ''}
                  </span>
                </div>
                {(e.before_value || e.after_value) && (
                  <span style={{ fontSize: type.label, color: color.textOnLight.faint, fontFamily: font.mono }}>
                    {expandedId === e.id ? 'Hide' : 'Details'}
                  </span>
                )}
              </div>
              {expandedId === e.id && (e.before_value || e.after_value) && (
                <div style={{ marginTop: 10, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                  {e.before_value && (
                    <pre style={{ flex: 1, minWidth: 200, background: color.surfaceLight, borderRadius: 6, padding: 10,
                      fontSize: type.label, fontFamily: font.mono, color: color.textOnLight.secondary,
                      overflowX: 'auto', margin: 0 }}>{JSON.stringify(e.before_value, null, 2)}</pre>
                  )}
                  {e.after_value && (
                    <pre style={{ flex: 1, minWidth: 200, background: color.surfaceLight, borderRadius: 6, padding: 10,
                      fontSize: type.label, fontFamily: font.mono, color: color.textOnLight.secondary,
                      overflowX: 'auto', margin: 0 }}>{JSON.stringify(e.after_value, null, 2)}</pre>
                  )}
                </div>
              )}
            </div>
          ))}
          {entries.length === LIMIT && (
            <div style={{ fontSize: type.label, color: color.textOnLight.faint, textAlign: 'center', marginTop: 8 }}>
              Showing the latest {LIMIT} matching entries — narrow the filters to see more specific results.
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// Account management — view/suspend/restore/soft-delete coach accounts.
// Every mutating action is gated individually by hasPermission() (not just
// the blanket /admin route check), per the Phase 5 spec: accounts.view for
// the list itself, accounts.suspend/accounts.restore/accounts.delete for
// each respective button. Suspend/delete require a typed confirmation
// (name for delete, since it's the more destructive of the two) rather than
// a bare click, matching the weight of what they do — this UI is the only
// thing standing between a click and a coach losing dashboard access.
const AccountsPanel = ({ actorId }) => {
  const [perms, setPerms] = useState(null)
  const [accounts, setAccounts] = useState(null)
  const [error, setError] = useState(null)
  const [actionError, setActionError] = useState(null)
  const [expandedId, setExpandedId] = useState(null)
  const [expandedMode, setExpandedMode] = useState(null) // 'suspend' | 'delete'
  const [reason, setReason] = useState('')
  const [confirmName, setConfirmName] = useState('')
  const [actingOn, setActingOn] = useState(null)
  const [impersonating, setImpersonating] = useState(null)
  const [impersonateError, setImpersonateError] = useState(null)
  const [impersonateErrorTargetId, setImpersonateErrorTargetId] = useState(null)

  const loadAccounts = useCallback(async () => {
    const { data, error: queryError } = await supabase
      .from('profiles')
      .select('id, full_name, email, subscription_tier, subscription_status, payment_status, admin_suspended, admin_suspended_reason, deleted_at')
      .eq('role', 'coach')
      .order('full_name')

    if (queryError) { setError(queryError.message); return }
    setAccounts(data || [])
  }, [])

  useEffect(() => {
    async function init() {
      const [view, suspend, restore, del, impersonate, impersonateReadonly] = await Promise.all([
        hasPermission(actorId, 'accounts.view'),
        hasPermission(actorId, 'accounts.suspend'),
        hasPermission(actorId, 'accounts.restore'),
        hasPermission(actorId, 'accounts.delete'),
        hasPermission(actorId, 'accounts.impersonate'),
        hasPermission(actorId, 'support.impersonate_readonly'),
      ])
      setPerms({ view, suspend, restore, del, impersonate, impersonateReadonly })
      if (view) await loadAccounts()
    }
    if (actorId) init()
  }, [actorId, loadAccounts])

  const closeExpanded = () => {
    setExpandedId(null)
    setExpandedMode(null)
    setReason('')
    setConfirmName('')
    setActionError(null)
  }

  // Best-effort, same as InviteEmployeePanel's logging — the account action
  // itself already succeeded by the time this runs, so a logging failure
  // shouldn't surface as an action failure or block the UI from reflecting
  // what the database now actually has.
  const logAction = (action, target, beforeValue, afterValue) => {
    supabase.from('admin_audit_log').insert({
      actor_id: actorId, action, target_type: 'profile', target_id: target.id,
      before_value: beforeValue, after_value: afterValue,
    }).then(({ error: logError }) => {
      if (logError) console.error('Audit log write failed:', logError.message)
    })
  }

  // Goes through a security-definer RPC rather than a raw .update() — RLS
  // has no path today for one user to update a different user's profile row
  // for this purpose, and a policy broad enough to open one would have no
  // column-level restriction (same pitfall as the earlier self-update
  // policy this session), letting any admin edit a coach's other fields
  // too. The RPC only ever touches admin_suspended/admin_suspended_at/
  // admin_suspended_reason/deleted_at and does its own permission check.
  const runAction = async (targetId, action, reasonArg) => {
    const { data, error: rpcError } = await supabase.rpc('admin_set_account_status', {
      p_target_id: targetId, p_action: action, p_reason: reasonArg ?? null,
    })
    if (rpcError || !data) throw new Error(rpcError?.message || 'Action did not apply — check your permissions.')
    return data
  }

  const handleSuspend = async (target) => {
    if (!reason.trim()) { setActionError('A reason is required.'); return }
    setActingOn(target.id)
    setActionError(null)
    try {
      const before = { admin_suspended: target.admin_suspended, admin_suspended_reason: target.admin_suspended_reason }
      const updated = await runAction(target.id, 'suspend', reason.trim())
      setAccounts(prev => prev.map(a => a.id === target.id ? updated : a))
      closeExpanded()
      logAction('account.suspended', target, before, { admin_suspended: true, admin_suspended_reason: reason.trim() })
    } catch (e) {
      setActionError(e.message)
    } finally {
      setActingOn(null)
    }
  }

  const handleRestore = async (target) => {
    setActingOn(target.id)
    setActionError(null)
    try {
      const wasDeleted = !!target.deleted_at
      const before = { admin_suspended: target.admin_suspended, deleted_at: target.deleted_at }
      const updated = await runAction(target.id, wasDeleted ? 'undelete' : 'restore')
      setAccounts(prev => prev.map(a => a.id === target.id ? updated : a))
      logAction(wasDeleted ? 'account.undeleted' : 'account.restored', target, before,
        wasDeleted ? { deleted_at: null } : { admin_suspended: false, admin_suspended_reason: null })
    } catch (e) {
      setActionError(e.message)
    } finally {
      setActingOn(null)
    }
  }

  const handleDelete = async (target) => {
    // Falls back to email when full_name is unset — never compares against
    // an empty string, which would let a blank confirm box pass.
    const expected = target.full_name || target.email
    if (!confirmName.trim() || confirmName.trim() !== expected) {
      setActionError(`Type "${expected}" exactly to confirm.`)
      return
    }
    setActingOn(target.id)
    setActionError(null)
    try {
      const before = { deleted_at: target.deleted_at }
      const updated = await runAction(target.id, 'delete')
      setAccounts(prev => prev.map(a => a.id === target.id ? updated : a))
      closeExpanded()
      logAction('account.deleted', target, before, { deleted_at: updated.deleted_at })
    } catch (e) {
      setActionError(e.message)
    } finally {
      setActingOn(null)
    }
  }

  // Prefers full impersonation when the actor holds both permissions — a
  // Support-role actor only ever has the read-only one, so this naturally
  // resolves to the weaker mode for them without needing a mode picker UI.
  const handleImpersonate = async (target) => {
    const mode = perms.impersonate ? 'full' : 'readonly'
    setImpersonating(target.id)
    setImpersonateError(null)
    setImpersonateErrorTargetId(null)
    try {
      await startImpersonation(target.id, mode)
      window.location.href = '/'
    } catch (e) {
      setImpersonateError(e.message)
      setImpersonateErrorTargetId(target.id)
      setImpersonating(null)
    }
  }

  const statusOf = (a) => {
    if (a.deleted_at) return { kind: 'alert', label: 'Deleted' }
    if (a.admin_suspended) return { kind: 'alert', label: 'Suspended' }
    if (a.payment_status === 'suspended') return { kind: 'warning', label: 'Payment suspended' }
    if (a.payment_status === 'past_due') return { kind: 'warning', label: 'Past due' }
    return { kind: 'success', label: 'Active' }
  }

  const actionBtnStyle = {
    padding: '6px 12px', borderRadius: 6, border: `1px solid ${color.borderLight}`,
    background: 'transparent', color: color.textOnLight.secondary, fontFamily: font.sans,
    fontSize: type.label, cursor: 'pointer', whiteSpace: 'nowrap',
  }

  if (perms === null) {
    return <div style={{ fontSize: type.body, color: color.textOnLight.secondary }}>Loading...</div>
  }

  if (!perms.view) {
    return (
      <div style={{ background: color.surfaceLight, border: `0.5px solid ${color.borderLight}`,
        borderRadius: 12, padding: 20, fontSize: type.body, color: color.textOnLight.secondary }}>
        You don't have permission to view accounts.
      </div>
    )
  }

  return (
    <div style={{ background: color.surfaceLight, border: `0.5px solid ${color.borderLight}`,
      borderRadius: 12, padding: 20 }}>
      <div style={{ ...labelStyle(false), marginBottom: 14 }}>Coach accounts</div>

      {error && <div style={{ fontSize: type.body, color: color.alert, marginBottom: 12 }}>{error}</div>}

      {!accounts ? (
        <div style={{ fontSize: type.body, color: color.textOnLight.secondary }}>Loading...</div>
      ) : accounts.length === 0 ? (
        <div style={{ fontSize: type.body, color: color.textOnLight.secondary, textAlign: 'center', padding: '32px 0' }}>
          No coach accounts yet.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {accounts.map(a => {
            const status = statusOf(a)
            const plan = planById(a.subscription_tier)
            const isExpanded = expandedId === a.id
            return (
              <div key={a.id} style={{ background: color.bone, borderRadius: 8, padding: '12px 14px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: type.body, fontWeight: 500, color: color.textOnLight.primary }}>
                        {a.full_name || '—'}
                      </span>
                      <span style={badge(status.kind)}>{status.label}</span>
                    </div>
                    <div style={{ fontSize: type.label, color: color.textOnLight.faint, marginTop: 2 }}>
                      {a.email} · {plan?.name || 'No plan'}
                    </div>
                    {a.admin_suspended && a.admin_suspended_reason && (
                      <div style={{ fontSize: type.label, color: color.textOnLight.secondary, marginTop: 4 }}>
                        "{a.admin_suspended_reason}"
                      </div>
                    )}
                  </div>

                  <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                    {!a.deleted_at && !a.admin_suspended && (perms.impersonate || perms.impersonateReadonly) && (
                      <button style={actionBtnStyle} disabled={impersonating === a.id}
                        onClick={() => handleImpersonate(a)}>
                        {impersonating === a.id ? 'Starting...' : perms.impersonate ? 'Impersonate' : 'Impersonate (read-only)'}
                      </button>
                    )}
                    {!a.deleted_at && !a.admin_suspended && perms.suspend && (
                      <button style={actionBtnStyle}
                        onClick={() => { closeExpanded(); setExpandedId(a.id); setExpandedMode('suspend') }}>
                        Suspend
                      </button>
                    )}
                    {!a.deleted_at && a.admin_suspended && perms.restore && (
                      <button style={actionBtnStyle} disabled={actingOn === a.id}
                        onClick={() => handleRestore(a)}>
                        {actingOn === a.id ? 'Restoring...' : 'Restore'}
                      </button>
                    )}
                    {a.deleted_at && perms.restore && (
                      <button style={actionBtnStyle} disabled={actingOn === a.id}
                        onClick={() => handleRestore(a)}>
                        {actingOn === a.id ? 'Restoring...' : 'Undelete'}
                      </button>
                    )}
                    {!a.deleted_at && perms.del && (
                      <button style={{ ...actionBtnStyle, borderColor: color.alert, color: color.alert }}
                        onClick={() => { closeExpanded(); setExpandedId(a.id); setExpandedMode('delete') }}>
                        Delete
                      </button>
                    )}
                  </div>
                </div>

                {isExpanded && expandedMode === 'suspend' && (
                  <div style={{ marginTop: 12, paddingTop: 12, borderTop: `0.5px solid ${color.borderLight}` }}>
                    <label style={labelStyle(false)}>Reason (shown to the coach)</label>
                    <textarea rows={2} value={reason} onChange={e => setReason(e.target.value)}
                      placeholder="e.g. Repeated ToS violation — contact support to appeal"
                      style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: `1px solid ${color.borderLight}`,
                        fontFamily: font.sans, fontSize: type.body, outline: 'none', color: color.textOnLight.primary,
                        resize: 'none', boxSizing: 'border-box', marginTop: 4 }} />
                    <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                      <button disabled={actingOn === a.id} onClick={() => handleSuspend(a)}
                        style={{ padding: '6px 14px', borderRadius: 6, border: 'none', background: color.alert,
                          color: '#fff', fontFamily: font.sans, fontSize: type.label, fontWeight: 500,
                          cursor: actingOn === a.id ? 'not-allowed' : 'pointer' }}>
                        {actingOn === a.id ? 'Suspending...' : 'Confirm suspend'}
                      </button>
                      <button onClick={closeExpanded} style={actionBtnStyle}>Cancel</button>
                    </div>
                  </div>
                )}

                {isExpanded && expandedMode === 'delete' && (
                  <div style={{ marginTop: 12, paddingTop: 12, borderTop: `0.5px solid ${color.borderLight}` }}>
                    <div style={{ fontSize: type.body, color: color.textOnLight.primary, marginBottom: 8 }}>
                      This soft-deletes the account — it stays in the database (nothing is destroyed) but the coach
                      loses dashboard access immediately. Type <strong>{a.full_name || a.email}</strong> to confirm.
                    </div>
                    <input type="text" value={confirmName} onChange={e => setConfirmName(e.target.value)}
                      placeholder={a.full_name || a.email}
                      style={{ width: '100%', padding: '8px 10px', borderRadius: 8, border: `1px solid ${color.borderLight}`,
                        fontFamily: font.sans, fontSize: type.body, outline: 'none', color: color.textOnLight.primary,
                        boxSizing: 'border-box' }} />
                    <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                      <button disabled={actingOn === a.id} onClick={() => handleDelete(a)}
                        style={{ padding: '6px 14px', borderRadius: 6, border: 'none', background: color.alert,
                          color: '#fff', fontFamily: font.sans, fontSize: type.label, fontWeight: 500,
                          cursor: actingOn === a.id ? 'not-allowed' : 'pointer' }}>
                        {actingOn === a.id ? 'Deleting...' : 'Confirm delete'}
                      </button>
                      <button onClick={closeExpanded} style={actionBtnStyle}>Cancel</button>
                    </div>
                  </div>
                )}

                {isExpanded && actionError && (
                  <div style={{ fontSize: type.label, color: color.alert, marginTop: 8 }}>{actionError}</div>
                )}
                {impersonateErrorTargetId === a.id && impersonateError && (
                  <div style={{ fontSize: type.label, color: color.alert, marginTop: 8 }}>{impersonateError}</div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

const ADMIN_TABS = [
  { id: 'invite', label: 'Invite employee' },
  { id: 'audit', label: 'Audit log' },
  { id: 'accounts', label: 'Accounts' },
]

export default function AdminDashboard() {
  const [profile, setProfile] = useState(null)
  const [activeTab, setActiveTab] = useState('invite')

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data } = await supabase.from('profiles').select('*').eq('id', user.id).single()
      setProfile(data)
    }
    load()
  }, [])

  return (
    <div style={{ minHeight: '100vh', background: color.bone, fontFamily: font.sans, padding: 32 }}>
      <div style={{ ...displayStyle, fontSize: type.display, color: color.textOnLight.primary, marginBottom: 4 }}>
        Admin
      </div>
      <div style={{ fontSize: type.body, color: color.textOnLight.secondary, marginBottom: 20 }}>
        Signed in as {profile?.full_name || profile?.email}
      </div>

      <nav style={{ display: 'flex', gap: 4, marginBottom: 20 }}>
        {ADMIN_TABS.map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            style={{ padding: '8px 14px', border: 'none', cursor: 'pointer',
              fontFamily: font.sans, fontSize: type.body, transition: 'all 0.15s ease',
              ...navItemStyle(activeTab === tab.id, false) }}>
            {tab.label}
          </button>
        ))}
      </nav>

      {profile && activeTab === 'invite' && <InviteEmployeePanel actorId={profile.id} />}
      {profile && activeTab === 'audit' && <AuditLogViewer />}
      {profile && activeTab === 'accounts' && <AccountsPanel actorId={profile.id} />}
    </div>
  )
}
