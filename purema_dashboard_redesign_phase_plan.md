# Coach Dashboard Redesign — Phase Plan

Tracks the coach dashboard redesign across phases. Each phase is scoped,
built, and verified live before moving to the next — this file is the
running record of what's shipped and what's still ahead.

---

## Phase 1 — Dashboard layout reshuffle + dedupe engagement stat computation

**Status: Done** (commit `6a76c2f`, 2026-08-17)

- `TabDashboard` reordered: greeting + attention-count header → attention
  queue (primary content) → compact summary line (active athletes /
  check-ins to review) → time saved line, replacing the old 4-tile KPI
  grid → time-saved → queue ordering.
- Extracted `computeEngagementStats(clients, checkins)` — previously
  duplicated near-identically between `TabDashboard` and `TabOverview` —
  into one shared function both tabs now call, eliminating the risk of
  the two drifting apart.
- No visual/brand system changes, no new functionality — pure layout
  hierarchy + internal dedup.

**Verification**: live against the real running app (not a mock) as
`purema.test.coach@gmail.com`, both attention-queue states exercised
(feedback-needed and no-recent-checkin), Dashboard and Overview confirmed
showing matching numbers post-dedupe. Test data used for verification
cleaned up, nothing left in production.

---

## Phase 2 — Attention row redesign + urgency coloring (scoped to real data today)
**Risk: low-medium. New functionality: minor (folding in an existing signal).**

**Status: Done** (commit `d548409`, 2026-08-17)

- Redesign each row to clearly show who/why/next-action, using the `type` + sublabel data `buildAttentionQueue` already outputs
- Two-color version first: amber = `feedback_needed`, red = `no_checkin`
- Optional extension: fold `isPastDue` in as a third red-tier condition (already computed elsewhere in this file — wiring, not new logic)
- Explicitly park: general inactivity beyond check-in timing (login/session staleness) — this data doesn't exist anywhere yet. Full intelligent version lives in Phase 8.

**What shipped**: rows now split into explicit who / why / next-action zones.
`no_checkin`'s badge moved from neutral gray to the alert (red) pill;
`feedback_needed` keeps its existing warning (amber) pill. Next-action is
real navigation only — "Review check-in" opens `CheckInDetail`, "View
client" reuses the existing `goToClient()` (same jump-to-roster-row
behavior the sidebar mini-list already has) — nothing aspirational was
added.

**Scope change**: the `isPastDue` fold-in was investigated and dropped
for this phase. `isPastDue(profile)` reads the **coach's own** Purema
subscription payment status (`profile.payment_status`, see `billing.js`)
— it's account-level, not per-client, so it doesn't fit into a per-client
queue row without fabricating data that doesn't exist. Confirmed with the
user; it stays covered by the existing dashboard-wide past-due banner and
notification bell. A true per-client payment/billing concept doesn't
exist anywhere in this app's schema.

**Priority ordering**: kept `feedback_needed` above `no_checkin` (now
documented inline in code) — a client who submitted and is waiting on
feedback is a concrete, resolvable backlog item, while a quiet client is
real but doesn't have anything currently pending on the coach's side.

**Verification**: live against `purema.test.coach@gmail.com` on the
running dev server — both badge states and both next-actions exercised
(a temporary check-in was added to trigger `feedback_needed`, confirmed
"Review check-in" opens the right modal, then deleted and confirmed the
queue reverted). `CI=true` build clean, zero console errors.

## Phase 3 — Consolidate duplicate stat computation (DONE, bundled into Phase 1)

Completed as part of commit `6a76c2f` — `computeEngagementStats()` now shared
between `TabDashboard` and `TabOverview`. No longer a separate phase.

## Phase 4 — The decision pipeline (centerpiece phase)
**Risk: medium. This is real, valuable new structure — the core of the redesign, not a side item.**

Build one real "decision" concept that a check-in review produces, and let it power multiple surfaces instead of building each separately:

- Check-in review brief: restructure CheckInDetail's existing (already-grouped) data around "what changed → what does it mean → what's next" — **Done, slice 1** (commit `196f5b2`, 2026-08-17)
- Decision templates: fast, consistent actions for repeated calls (maintain targets, adjust calories, request clarification, change training volume) — pre-filled but always editable — **not yet built**
- Coach decision notes: a short private rationale field attached to the decision, for the coach's own future reference, not client-facing — **not yet built**
- Client-facing "what changed" surface: whatever the coach decided, rendered clearly for the client — **not yet built**
- Client acknowledgment: a simple confirm-you've-seen-this on meaningful updates — **not yet built**
- Weekly briefing: a completed check-in culminates in a clear closing ritual — what the coach noticed, what changed, what to focus on, when the next check-in is due — assembled from the same decision data — **not yet built**

Also: keep coach feedback positioned near the relevant evidence, not always trailing at the bottom. Decide whether the 3 existing entry points into CheckInDetail (Check-ins tab, attention queue, global search) stay as-is or get consolidated.

**Slice 1 — Check-in review brief — what shipped**: investigation before
building found the existing section order in `CheckInDetail` already
matched the 3-zone framing (weekly averages/metrics grid leading, evidence
in the middle, override+feedback last) — so this was a labeling/grouping
pass, not a reorder. New `ZoneHeader` component (mono uppercase label +
hairline divider, same brand tokens as everywhere else) now groups both
formats into explicit "What changed / What it means / What's next" zones:
new-format's weekly-averages tiles, and old-format's body-metrics/
nutrition/lifestyle grid (which plays the same role, since old-format has
no daily granularity to separate out), both lead as "What changed";
daily log/lift tracker/day notes/measurements/vitals/reflection (new-
format) and client notes (old-format, pulled out of the grid container
into its own labeled block) sit under "What it means"; override targets
+ coach feedback are grouped last under "What's next" for both. No new
data, no new fields, every existing conditional preserved as-is.

**Remaining Phase 4 slices, explicitly not built yet**: decision
templates, coach decision notes, the client-facing "what changed"
surface, client acknowledgment, and the weekly briefing — each is a
separate follow-up slice, still to be scoped.

## Phase 5 — Surface phase-based coaching
**Risk: low. Mostly a UI job — the data model already exists.**

Show current phase (maintenance/building/fat loss/contest prep/peak week/recovery), objective, and next milestone as a first-class visible concept, built on the existing diet_plan_phases structure.

## Phase 6 — Supportive re-engagement flow (redesigned from "Send reminder")
**Risk: medium-high. Genuinely new backend infrastructure.**

Coach sends an editable supportive message, client gets a simple way to respond — restart, ask for help, or say they're overwhelmed.
- Manual (do this first): coach-triggered send via a new API endpoint modeled on api/notify-intake-booking.js's pattern
- Automatic/scheduled (defer): requires Vercel Cron setup (no vercel.json exists yet) and wiring the currently-inert notify_weekly_reminder/notify_show_day_countdown toggles

## Phase 7 — Nav/tab semantic cleanup (low priority, optional)

- Align Check-ins tab's filter labels with whatever framing Phase 4 settles on, if mismatched
- Resolve the 3-entry-points question from Phase 4, if not already decided there

## Phase 8 — Intelligent attention queue + data-confidence indicator
**Risk: medium-high. Needs new signal computation — sequence after the rest.**

- Expand buildAttentionQueue beyond its current two conditions: declining adherence, unusual weight trends, upcoming phase transitions (enabled by Phase 5), unread plan changes (enabled by Phase 4), missed coach contact, payment issues
- Private data-confidence indicator for coaches — framed as decision confidence, never a client-facing score

---

## Parked — good ideas, lower urgency

- Contextual "Ask your coach" entry points
- Progress-photo comparison designed for decisions
- Full coaching timeline aggregation per client (more valuable once Phase 4 exists)
- Coach-defined weekly non-negotiables
- "Coaching loop" as an overarching product narrative

---

## Suggested sequencing

1 → 2 → 4 → 5 → 7 → 6 → 8 (Phase 3 already done, folded into Phase 1)
