// Mints a real, short-lived session for a target coach so an admin can view
// (or, if permitted, act as) their account — "session swap via signed
// short-lived token", per spec. Unlike create-checkout-session.js/
// create-portal-session.js, this endpoint does NOT trust a client-supplied
// user id for who's calling — impersonation is exactly the kind of action
// where a spoofed caller id would be a critical privilege-escalation bug,
// so the caller is verified from their own auth token, not request.body.
const supabaseAdmin = require('./_supabaseAdmin')

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  const authHeader = req.headers.authorization || ''
  const callerToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null
  if (!callerToken) {
    res.status(401).json({ error: 'Missing Authorization header' })
    return
  }

  const { targetUserId, mode } = req.body || {}
  if (!targetUserId || !['full', 'readonly'].includes(mode)) {
    res.status(400).json({ error: 'targetUserId and a valid mode ("full" or "readonly") are required' })
    return
  }

  try {
    const admin = supabaseAdmin()

    const { data: { user: caller }, error: callerError } = await admin.auth.getUser(callerToken)
    if (callerError || !caller) {
      res.status(401).json({ error: 'Invalid or expired session' })
      return
    }

    const permissionKey = mode === 'full' ? 'accounts.impersonate' : 'support.impersonate_readonly'
    const { data: allowed, error: permError } = await admin.rpc('admin_has_permission', {
      p_user_id: caller.id, p_permission_key: permissionKey,
    })
    if (permError || allowed !== true) {
      res.status(403).json({ error: `Missing ${permissionKey} permission` })
      return
    }

    const { data: target, error: targetError } = await admin
      .from('profiles')
      .select('id, email, full_name, role, admin_suspended, deleted_at')
      .eq('id', targetUserId)
      .single()

    if (targetError || !target) {
      res.status(404).json({ error: 'Target account not found' })
      return
    }
    if (target.role !== 'coach') {
      res.status(400).json({ error: 'Only coach accounts can be impersonated' })
      return
    }
    if (target.admin_suspended || target.deleted_at) {
      res.status(400).json({ error: 'Cannot impersonate a suspended or deleted account' })
      return
    }

    // generateLink mints a one-time token without sending any actual email
    // — the client verifies it directly via verifyOtp, so nothing goes near
    // the coach's inbox and the coach is never notified in-band by this.
    const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({
      type: 'magiclink',
      email: target.email,
    })
    if (linkError || !linkData?.properties?.hashed_token) {
      res.status(500).json({ error: linkError?.message || 'Failed to generate impersonation session' })
      return
    }

    // Logged here, at the moment access was actually granted, rather than
    // trusting the client to report back that it started — the token has
    // already been minted by this point regardless of what the client does
    // with it, so this is the authoritative "impersonation began" record.
    await admin.from('admin_audit_log').insert({
      actor_id: caller.id, action: 'account.impersonate_started',
      target_type: 'profile', target_id: target.id,
      after_value: { mode, target_email: target.email },
    })

    res.status(200).json({
      tokenHash: linkData.properties.hashed_token,
      targetId: target.id,
      targetEmail: target.email,
      targetName: target.full_name,
      mode,
    })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}
