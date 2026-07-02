# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

This is a Create React App project (`react-scripts`), not ejected.

- `npm start` — run the dev server (localhost:3000)
- `npm test` — run tests in watch mode (Jest + React Testing Library via react-scripts)
- `npm test -- --watchAll=false` — run tests once (CI mode)
- `npm test -- --testPathPattern=App.test.js` — run a single test file
- `npm run build` — production build

There is no lint script defined; CRA's built-in ESLint (`eslintConfig` in `package.json`, extends `react-app`) runs as part of `start`/`build`.

## Architecture

**Product**: Purema — a coaching app connecting fitness coaches with clients. Coaches manage a roster of clients and review weekly check-ins; clients submit weekly check-ins and see their own progress/feedback.

**Stack**: React 19 (CRA, no TypeScript), `react-router-dom` is a dependency but is **not used** — routing is hand-rolled via `window.location.pathname` checks in `src/App.js`. Backend is Supabase (Postgres + Auth), accessed directly from client components via `src/lib/supabase.js` — there is no separate API server.

### Routing / top-level flow (`src/App.js`)

`App()` inspects `window.location.pathname` directly:
- `/invite/:token` → `AcceptInvite`
- `/reset-password` → `ResetPassword`
- everything else → `AuthRoutes`, which drives the session/role gate:
  1. Loads the Supabase session (`supabase.auth.getSession()` + `onAuthStateChange` listener).
  2. If session exists, fetches the row from `profiles` for that user id to get `role`.
  3. Renders `Auth` (no session) → `CoachDashboard` (`role === 'coach'`) → `ClientHome` (otherwise).

When adding a new top-level route, follow the same pattern (a pathname check in `App()`), not `react-router`.

### Data model (Supabase tables, inferred from query call sites — no local schema/migrations directory exists)

- **`profiles`** — one row per user, keyed by auth user id (`id`). Fields include `role` (`'coach'` | `'client'`), `full_name`, `email`, and for clients, `coach_id` linking to their coach's profile id.
- **`check_ins`** — weekly check-in submissions. Keyed by `client_id`, `week_number`, `submitted_at`; also carries `coach_feedback` (null until the coach reviews it) plus daily-log fields (weight, sleep, steps, water, training, performance, macros, notes, etc. — see `emptyDay()` in `CheckInForm.js`).
- **`drafts`** — in-progress (unsubmitted) check-in state per client, so a check-in can be resumed later.
- **`invites`** — coach-generated invite links (`token`, `email`, `coach_id`, `role`, `used`, `expires_at`), consumed by `AcceptInvite.jsx` to provision a new `profiles` row on signup.

Row-level security in Supabase is what actually enforces coach/client data isolation (see commit history — "RLS fixes"); there's no client-side authorization layer beyond the role check in `App.js`.

### Component structure

- `src/pages/Auth.js` — sign in / sign up / password reset request, role selection at signup.
- `src/pages/CoachDashboard.js` — coach's client roster, attention queue (clients needing feedback or who've gone quiet — see `buildAttentionQueue()`), check-in review, cross-client search. Large single file (~1000 lines) composed of local sub-components rather than split into separate files.
- `src/components/ClientHome.js` — client's tabbed home (progress charts, history, coach feedback) plus entry points into `CheckInForm` and `ClientSettings`.
- `src/components/CheckInForm.js` — the weekly check-in form itself; a full Sun–Sat daily log per submission, with autosave to `drafts`.
- `src/components/ClientSettings.js`, `InviteClient.jsx`, `AcceptInvite.jsx`, `ResetPassword.jsx` — settings, coach-side invite generation, invite redemption, password reset completion.

### Styling convention

No CSS framework/component library — all styling is inline `style={{...}}` objects on JSX elements, generally with a local `S = { card, label, sectionTitle, ... }` object at the top of a file for shared bits. Two font families are used throughout by name (`DM Sans` for body text, `DM Mono` for uppercase labels/mono accents) though they are not loaded via `@font-face` or a Google Fonts link in `public/index.html` — check before assuming they render as intended in a fresh environment. Brand palette is dark (`#0D0D0D` background) for auth/nav chrome and light (`#fff`/`#F5F2ED`) for dashboard content, with `#0F6E56` (teal-green) as the primary accent throughout.

### Environment / config notes

- `src/.env` defines `REACT_APP_SUPABASE_URL` / `REACT_APP_SUPABASE_ANON_KEY`, but `src/lib/supabase.js` currently hardcodes the Supabase URL and anon key instead of reading `process.env`. Be aware of this mismatch if rotating credentials or working across environments.
- `.env` is gitignored, but note `vercel recovery codes/recovery-codes.txt` **is currently tracked in git** — flag this if you notice it, since it's a credential file that shouldn't be committed.
