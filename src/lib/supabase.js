import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.REACT_APP_SUPABASE_URL
const supabaseAnonKey = process.env.REACT_APP_SUPABASE_ANON_KEY

const rawClient = createClient(supabaseUrl, supabaseAnonKey)

// Flips true only during a read-only impersonation session (see
// lib/impersonation.js) — blocks every mutating call at the query-builder
// level so no individual write call site anywhere in the app needs its own
// check. Module-level state resets on reload, so lib/impersonation.js
// re-applies it from sessionStorage on app boot.
let readOnlyImpersonation = false
export function setReadOnlyImpersonation(value) {
  readOnlyImpersonation = value
}

// Note: this only guards supabase.from(...).insert/update/upsert/delete —
// it doesn't cover supabase.rpc() calls that happen to mutate data. Those
// are rare in this app (most writes go through .from()), but not zero, so
// this is a strong-but-not-absolute safety net, not a substitute for the
// server's own RLS/permission checks.
const BLOCKED_METHODS = ['insert', 'update', 'upsert', 'delete']

// A blocked write can't just resolve a plain Promise — nearly every write
// call site in this app chains further (.eq().select().single(), etc.)
// after .insert()/.update()/etc, and a plain Promise has none of those
// methods. This proxy answers any property access with a function that
// returns itself (so arbitrary chains keep working) and is itself a
// thenable, so `await`-ing it anywhere in the chain resolves to the same
// blocked-write error regardless of how deep the chain goes.
function blockedResult() {
  const result = { data: null, error: { message: 'Read-only impersonation session — writes are disabled.' } }
  const handler = {
    get(_, prop) {
      if (prop === 'then') return (resolve) => resolve(result)
      if (prop === 'catch' || prop === 'finally') return () => proxy
      return () => proxy
    },
  }
  const proxy = new Proxy({}, handler)
  return proxy
}

function guardQueryBuilder(builder) {
  BLOCKED_METHODS.forEach(method => {
    const original = builder[method]?.bind(builder)
    if (!original) return
    builder[method] = (...args) => {
      if (readOnlyImpersonation) return blockedResult()
      return original(...args)
    }
  })
  return builder
}

export const supabase = new Proxy(rawClient, {
  get(target, prop) {
    if (prop === 'from') {
      return (...args) => guardQueryBuilder(target.from(...args))
    }
    return target[prop]
  },
})
