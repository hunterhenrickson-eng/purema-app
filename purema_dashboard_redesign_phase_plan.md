# Purema Coach Dashboard & Product Redesign — Phase Plan
**Originally scoped:** August 16/17 session, based on direct investigation of the live `CoachDashboard.js`
**Reconciled:** August 20, 2026, against an external "Purema Claude Build Brief" (dated Aug 19) written without repository access. That brief independently converged on nearly the same architecture as Phases 1, 2, and 4 below — a good signal the direction is right. This revision strikes what's already shipped, corrects the brief's screenshot-based assumptions against real ground truth, and folds in its genuinely new ideas as new phases.
**Status:** Phases 1, 2, 4 shipped and live in production. Everything below that is planned, not built.

---

## The one insight that reshaped Phase 4 (still holds)

Several originally-separate-seeming ideas — the check-in review brief, decision templates, the client-facing "what changed" timeline, the weekly briefing, coach decision notes, and client acknowledgment — turned out to be facets of one thing: a structured review → decision → update pipeline. That's what Phase 4 built, in five slices, all shipped.

## What's already true (confirmed, no work needed)

- Phases 1, 2, and all 5 slices of Phase 4 are live in production. See commit history for exact hashes.
- The external brief's "Build area 1" (attention queue) and "Build area 2" (check-in review/decision workflow) are, almost line-for-line, what Phases 1/2/4 already built. Its status audit for these areas ("Partial — redesign," "Validate") is stale relative to what's actually shipped — it was written from a screenshot and public pages, not the repo.
- Direct messaging, the client's Progress/Calendar/Messages/Diary tabs, and the full diet-plan-phase architecture are all confirmed built (see project memory / prior ground-truth sweeps) — the brief's "Validate" marks on these were reasonable given it had no code access, but they're resolved.

## What the external brief got right that isn't in the plan yet — genuinely new
- **WhatsApp has zero code anywhere in this app** — confirmed via full-repo grep earlier this session. The brief's proposed v1 (consented deep links + templated outbound reminders, explicitly *not* promising full bidirectional sync until demand/legal/consent are validated) is a much better-scoped plan than the vague "Twilio integration" that's sat undefined in the roadmap since session one. Adopted below, folded into Phase 9.
- **Role-aware onboarding doesn't exist as its own decision flow.** Role today comes purely from which invite link someone clicks — there's no explicit "what are you here to do" moment, no coach setup questions (roster size, services offered, cadence). Real, confirmed gap. New Phase 6.
- **Modular workspace / entitlement separation is a genuinely new architectural idea**, not something already planned. Today's system is flat tier-gating (Free/Starter/Pro/Agency client limits). The brief proposes separating *what a plan entitles* from *what a coach chooses to show in their own workspace* — e.g. a Pro coach who doesn't do competition prep can hide that module without it being a plan restriction. New Phase 7.
- **AI review brief ("Purema Brief")** — not built, no LLM provider integrated anywhere in this stack today (a new external dependency, same category as Twilio/Nutritionix — needs its own provider/API-key decision before any build). The brief's guardrails are worth keeping intact: coach must approve every output, never auto-changes plans/macros/training, shows sources and uncertainty rather than presenting conclusions as fact, no hidden client-facing risk scores. New Phase 12, sequenced last per the brief's own reasoning — only valuable once the underlying workflow data (which Phase 4 now provides) is reliable.
- **The Thomas → Nick beta scenario** is a good practice worth adopting outright: a real, named coach/client pair as the concrete end-to-end acceptance test, rather than abstract "definition of done" criteria. Adopted as the closing acceptance bar for the whole plan, not a separate phase.

---

## Phase 1 — Dashboard layout reshuffle ✅ SHIPPED
Attention queue promoted to primary content, KPI grid demoted to a compact summary line, "time saved" line demoted below the fold, engagement-stat computation deduped between Dashboard/Overview. Commit `6a76c2f`.

## Phase 2 — Attention row redesign + urgency coloring ✅ SHIPPED
Who/why/next-action row structure, amber (`feedback_needed`) / red (`no_checkin`) urgency coloring. `isPastDue` deliberately excluded — confirmed coach-level (Purema subscription status), not a per-client signal; stays covered by the existing billing banner/notification bell. Commit `d548409`.

## Phase 3 — folded into Phase 1
Duplicate `weeklyRate`/`activeClients` computation extracted into shared `computeEngagementStats()`.

## Phase 4 — The decision pipeline ✅ SHIPPED (5 of 5 slices)
1. Check-in review brief — `CheckInDetail` restructured into What changed / What it means / What's next zones (`ZoneHeader` component). Commit `196f5b2`.
2. Decision templates — 5 quick-select feedback starters, confirm-gated overwrite. Commit `ab74ec0`.
3. Coach decision notes — private, coach-only rationale field. Pivoted from a column-based approach to a separate `check_in_decision_notes` table after discovering `REVOKE SELECT` didn't reliably enforce in this environment — verified client-invisible via RLS session impersonation, not just UI absence. Commit (see plan doc history).
4. Client-facing "what changed" surface — surfaced the previously-computed-but-unread `getEffectiveTargets()` source field as a "Your targets changed this week" badge.
5. Client acknowledgment — separate `check_in_acknowledgments` table, INSERT-only/immutable, mirroring slice 3's "don't grant unnecessary write access" reasoning.

**Not yet built — the one honest loose end:** the weekly briefing was never scoped as its own slice. See Phase 5 below.

## Phase 5 — Weekly briefing (small, closes out Phase 4)
**Risk: low. Should assemble cheaply from data the 5 completed slices already produce.**

A completed check-in's review should culminate in a clear closing artifact — what the coach noticed, what changed, what to focus on, when the next check-in is due — assembled from coach feedback, decision notes (coach-facing only), the targets-changed badge, and acknowledgment status. Investigate first: confirm whether this should be a persisted record or a computed view assembled fresh each time from existing tables.

## Phase 6 — Role-aware onboarding (NEW, from external brief)
**Risk: medium. Touches signup/invite flow, which is security-sensitive — investigate the current invite/role system thoroughly before changing it.**

- A light, reversible onboarding decision: manage my own training, coach clients, or join my coach
- Persist an explicit account role and active workspace context — don't infer from a single screen
- For coaches: collect coaching focus, current roster size, services offered, preferred communication channel, check-in cadence
- For clients: minimize setup — accept invite, confirm communication preference, see current phase/targets, only required profile fields
- Show only relevant modules after onboarding; keep a clear Settings path to change later
- Must not weaken the invite-only signup gate shipped `87f348d` — this is about the *experience* after a valid invite is accepted, not a new signup path

## Phase 7 — Modular workspace & entitlement separation (NEW, from external brief)
**Risk: medium-high. Architectural — touches navigation, settings, and the existing tier system broadly.**

- Separate entitlement (what a plan allows) from visibility (what a coach chooses to show in their own workspace)
- Keep the core coaching loop available at every tier; use limits/advanced tooling to differentiate paid tiers, not module hiding
- Workspace setup screen with presets (Physique coaching, High-touch coaching, Hybrid coaching, Minimal check-in coaching) plus toggles — investigate whether this maps cleanly onto existing `subscription_tier` logic before building a parallel system
- Disabling a module hides navigation and preserves data — never delete history or break deep links
- Map any new modules to the *existing* Stripe tier entitlement checks; do not implement a second, parallel feature-gating system

## Phase 8 — Surface phase-based coaching
**Risk: low. Mostly a UI job — the data model already exists** (`diet_plan_phases`).
Show current phase, objective, and next milestone as a first-class visible concept for coach and client.

## Phase 9 — Supportive re-engagement flow + WhatsApp handoff (merged, refined)
**Risk: medium-high. Genuinely new backend infrastructure.**

- Manual first: coach-triggered supportive message (editable, not a blunt reminder), client can respond restart/ask-for-help/overwhelmed — modeled on `api/notify-intake-booking.js`'s pattern
- Fold in the external brief's WhatsApp v1 approach at the same time, since it's the same UI surface: from a check-in review or attention item, a primary "Send in Purema" action and a secondary "Open WhatsApp" deep link (prefilled, editable message, logs that the coach initiated the handoff — never falsely marks it sent/read)
- Coach-level + client-level communication preference (Purema only / WhatsApp preferred / flexible)
- Full WhatsApp Business API integration explicitly deferred — only pursue after validating demand, legal/consent posture, and template-approval workflow
- Automatic/scheduled reminders (Vercel Cron) remain deferred separately — no `vercel.json` exists in this project yet

## Phase 10 — Nav/tab semantic cleanup (low priority, optional)
Align Check-ins tab filter labels with Phase 4's framing if mismatched; resolve the 3-entry-points-into-CheckInDetail question.

## Phase 11 — Intelligent attention queue + data-confidence indicator
**Risk: medium-high. Needs new signal computation — sequence after the rest.**
Expand `buildAttentionQueue` beyond its current two conditions: declining adherence, unusual weight trends, upcoming phase transitions (enabled by Phase 8), unread plan changes (enabled by Phase 4), missed coach contact. Private data-confidence indicator, framed as decision confidence — never a client-facing score.

## Phase 12 — AI review brief / "Purema Brief" assistant (NEW, from external brief)
**Risk: high. Requires a new external dependency (LLM provider) not yet integrated anywhere in this stack — needs its own provider/cost/privacy decision, same category as evaluating Twilio or Nutritionix originally.**

- Coach-only summarization of submitted check-in data and recent context — never presents medical conclusions as fact
- Must show sources and uncertainty explicitly ("Adherence fell from 6/7 to 4/7; client noted poor sleep twice"), linking every insight to source inputs
- Draft-only: can draft a review note, flag missing information, compare trends, suggest which decision template fits — coach must edit/approve before anything sends
- Hard guardrails, non-negotiable: never auto-changes macros/cardio/training/supplements/competition protocols; never generates a hidden client-facing risk score
- Needs data permissions, audit logging, eval cases, and an opt-out before wider rollout
- Sequenced last deliberately — only valuable once the workflow data Phase 4 produces is reliable, per the external brief's own reasoning

---

## Parked — good ideas, lower urgency, unchanged from original plan
- Contextual "Ask your coach" entry points
- Progress-photo comparison designed for decisions
- Full coaching timeline aggregation per client
- Coach-defined weekly non-negotiables
- "Coaching loop" as an overarching product narrative

---

## Suggested sequencing
**Superseded** — see "Updated suggested sequencing (full list, both briefs reconciled)" in the Aug 20 second-reconciliation section below. That version folds in Phases 13-17 and is the current one to follow.

## Definition of done — the Thomas → Nick beta test (adopted from the external brief)
Before calling any phase past Phase 5 genuinely done, run it end-to-end against a real named scenario: a specific coach (e.g. Thomas) and a specific client (e.g. Nick), not abstract test accounts. Check-in submitted → coach reviews → decision recorded → client sees clear next action → client acknowledges → nothing requires the coach to remember, screenshot, or search a long chat thread. If that flow doesn't hold up cleanly for one real relationship, it's not ready for a wider roster.

---

## Second reconciliation: "Growth & Operations" continuation brief (Aug 20)

A second external brief extended the first, explicitly building on top of it rather than replacing it. Investigated against the live codebase before adding anything below — see findings inline.

**Confirmed already true, no new work:**
- The dashboard's "All caught up" state, the Phase 2 green/amber/red urgency semantics, and decision templates beside the feedback composer were all independently re-recommended by this brief — already shipped.
- The admin permission model is genuinely granular (28 discrete permissions across 8 categories in `admin_permissions`, role + per-user override layers via `admin_role_permissions`/`admin_user_permission_overrides`) — not a flat "is admin" flag. This can extend to a future sub-coach tier without a schema rebuild.

**Confirmed as real gaps — new phases below:**
- No structured "request" entity exists anywhere — only plain conversational messages.
- No persistent, cross-check-in coach note exists (`check_in_decision_notes` is scoped to one specific check-in, not the relationship).
- No first-class client-facing status field exists in `ClientHome.js` — every state a client sees is inferred ad hoc from other data, never a named status.
- `profiles.role` is a mutually-exclusive `coach | client | admin` CHECK constraint — there's no identity slot for "coach's team member." The permission *system* could support sub-coaches; the *identity model* currently can't represent one.

**Partially exists, just unlabeled:**
- `client_applications.status` (`pending | approved | declined`) already functions as an unlabeled "lead" stage — a prospect exists in the system before becoming a client. Phase 16 below labels and surfaces this rather than building it from scratch.

---

### Open design decision — not resolved here, needs your call

Brief 02 recommends a **two-column check-in review layout** (client evidence/trends on the left, coach decision/feedback on the right, collapsing to a pinned-decision-after-evidence pattern on mobile). What's actually shipped (Phase 4 slice 1) is **single-column, vertically-stacked zones** (What changed → What it means → What's next, one below the other on both desktop and mobile) — confirmed via direct code read, not assumed.

**Decided (2026-08-20):** keep the single-column layout — do not build the two-column version. Reasoning: Brief 02 is a hypothesis document written without repo or usage access, same caveat as Brief 01; nobody has actually used the shipped review screen with real coaches yet, so there's no observed friction to justify a rebuild. The cost isn't trivial either — `CheckInDetail` has two format branches (new/old) that would both need re-verification at desktop and 375px mobile, and per Brief 02's own admission mobile stays stacked regardless, so a full two-column rebuild would only ever benefit desktop review. This matches a call already made once this session (Phase 4 slice 4 deliberately didn't force the 3-zone framing onto the client home just because it came from the same source material) — not every brief recommendation should get built just because it's written down.

**Concrete trigger to revisit:** once founding coaches are live and actually reviewing real check-ins, ask directly whether scrolling through zones feels slow. Build against real signal, not a hypothesis.

**Cheap middle ground, worth doing now instead of a full rebuild:** make the "What's next" zone (feedback + decision) sticky/pinned on desktop while the evidence zones above it scroll underneath. This gets most of the practical benefit (seeing evidence while writing the decision) without restructuring the component or touching mobile at all — small, reversible, fast to verify. Investigate whether `CheckInDetail`'s current modal/scroll container supports `position: sticky` cleanly before committing to this approach; report back if the existing structure fights it.

---

## Phase 13 — Structured requests (NEW, from Brief 02 Build area 9)
**Risk: medium. Genuinely new entity — nothing to extend, has to be built from scratch.**

- A `client_requests`-style table: type (question / plan adjustment / form review / call request / admin request), lifecycle state (open / waiting on client / scheduled / resolved), linked context (which check-in/plan/message it relates to), owner, optional due date/SLA.
- "Make a request" entry point on client home and relevant check-in/plan contexts — keep the form short.
- A submitted request becomes an attention-queue item, using the existing `buildAttentionQueue` pattern rather than a competing inbox.
- Let a coach convert an existing message into a request without retyping — investigate `MessageThread.jsx` for the cleanest attach point before building.
- Never expose internal triage labels to the client — client sees plain-language status only.

## Phase 14 — Expand template library + save-as-template + usage analytics (extends shipped Phase 4 slice 2)
**Risk: low. Builds on `FEEDBACK_TEMPLATES`, does not reopen or restructure what's shipped.**

- Grow beyond the current 5 (Maintain/Adjust down/Adjust up/Request clarification/Change training volume) to cover onboarding messages, no-change weeks, travel weeks, missed check-ins, encouragement, offboarding — coach-configurable, not just Purema-authored.
- "Save this response as a template" directly from the feedback composer.
- Template variables (client name, phase, check-in date, target changes, next due date).
- Track usage + edit rate per template — a template edited almost every time it's used is a signal it's miscalibrated, not that it's working.

## Phase 15 — Client-facing accountability rhythm (NEW, from Brief 02 Build area 11)
**Risk: low-medium. A first-class status field where only inferred state exists today.**

- A single named client-facing status, computed from existing data (don't duplicate signals `buildAttentionQueue` already tracks — reuse or mirror that logic): Ready for check-in / Awaiting review / Updated this week / On track / Let's get back on track.
- Let a coach set desired accountability level per client (some clients want reminders, others want fewer notifications and more autonomy) — this is a coach preference, not automated.
- Never reduce a client to a single visible score — supportive states only, no public numeric compliance rating.

## Phase 16 — Relationship memory & client lifecycle (NEW, from Brief 02 Build area 12)
**Risk: medium. Touches client identity/status model — investigate current status transitions thoroughly first.**

- Persistent, cross-check-in coach relationship notes — distinct from `check_in_decision_notes` (which stays scoped to one check-in's review). New table, same RLS-table-not-column-revoke pattern already proven safe this session.
- Surface `client_applications`'s existing pending/approved/declined as a labeled lead stage in the coach's roster view, rather than building a new "lead" concept from scratch.
- A lightweight "last discussed / next promised action" summary on the client profile.
- Respectful offboarding flow: summary of progress, retained-history rules, next self-directed action, optional reactivation reminder — extends the existing pause/archive states, doesn't replace them.

## Phase 17 — Lead intake & business health (NEW, from Brief 02 Build area 13)
**Risk: medium. Explicitly deprioritized by the brief itself — "not a first-loop priority," "earn this expansion by proving the core workflow first." Sequence last, alongside Phase 12.**

- Coach-branded application link with service selection and fit questions — extends `PublicApply.jsx`, doesn't replace it.
- A compact pipeline (applied/invited/paid/onboarding/active/paused/completed) only if a coach has enough volume to need it — avoid building general CRM tooling nobody asked for.
- Agency-level operational view (capacity, workload, delayed responses, payment issues) — only once the underlying events from earlier phases actually exist to power it.

---

## Cross-cutting practice (not a phase — applies across all future work)
Brief 02's Build area 14 (trust/safety/notification discipline) isn't a single build — it's a standing checklist to apply to every phase above:
- Granular permissions for owner coach / sub-coach / ops-admin / client — the permission *system* supports this today; the *identity model* (Phase 16 context) doesn't yet have a slot for sub-coach. Don't build sub-coach permissions until the identity model question is deliberately resolved.
- Data controls: export, account deletion, retention expectations, photo visibility rules.
- Durable audit history for material plan changes, decision notes, and access changes — the admin audit log already covers some of this; confirm coverage extends to whatever Phases 13-16 add before considering it complete.
- One notification per event, one preferred channel — avoid broadcasting the same event through push/email/chat/WhatsApp by default.

## Definition of done — expanded with concrete journey scripts
The Thomas → Nick beta test (adopted from Brief 01) now has three concrete scripts to run, not just a general vibe check, before considering related work done:
1. **Invite through a confident first week** — invite → onboarding → first plan delivered → first week → first check-in, with no re-entered data and no ambiguity about what happens next at any step.
2. **Check-in → decision → plan update** — submission → review → decision → client sees the update → loop closes (acknowledged or a real follow-up), with the queue behaving predictably throughout.
3. **A question raised in WhatsApp or Purema chat** — question arrives → becomes tracked work if material → resolves with a visible state, never a shadow inbox.

Test each on desktop and mobile, including first-use, slow connection, incomplete data, no-action-needed, and error/recovery states, before calling a phase genuinely done.

---

## Updated suggested sequencing (full list, both briefs reconciled)
**5 → 6 → 13 → 14 → 7 → 15 → 8 → 16 → 10 → 9 → 11 → 17 → 12**

Reasoning: Phase 5 still closes the one loose end from the shipped core loop. Phase 6 (onboarding) and Phase 13 (requests) are both "Now" priority per Brief 02 and both foundational to daily coach workflow. Phase 14 (templates) is cheap and extends shipped work. Phase 7 (workspace) before Phase 15 (accountability rhythm) since workspace clarity should exist before adding another client-facing status concept. Phase 8 (phase-based coaching) before Phase 16 (relationship memory) since phase context feeds naturally into relationship history. Phases 10, 9, 11 keep their original relative order. Phases 17 and 12 are both explicitly "prove the core loop first" phases — sequenced last together.
