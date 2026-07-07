import { supabase } from './supabase'

// Resolution order (enforced identically at the DB layer by the
// admin_has_permission() Postgres function, used both here and inside the
// admin_role_permissions/admin_user_permission_overrides RLS policies):
//   1. admin_user_permission_overrides for (userId, permissionKey) — if a
//      row exists, its `granted` value wins outright, regardless of role
//   2. else, whether permissionKey is in the user's admin_role_id's bundle
//      (admin_role_permissions)
//   3. else false
// This calls that same RPC rather than re-querying the two tables here, so
// there's exactly one place this security-relevant logic lives — a second,
// hand-rolled copy in JS could drift from the DB-enforced version over time.
export async function hasPermission(userId, permissionKey) {
  if (!userId || !permissionKey) return false

  const { data, error } = await supabase.rpc('admin_has_permission', {
    p_user_id: userId,
    p_permission_key: permissionKey,
  })

  if (error) {
    console.error('hasPermission check failed:', error.message)
    return false
  }

  return data === true
}
