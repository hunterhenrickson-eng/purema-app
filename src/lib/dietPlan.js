// Diet plan helpers — a plan is a sequence of phases (start_date + macros),
// stored in `diet_plan_phases`. The "active" phase is whichever one has the
// latest start_date that isn't in the future, since a plan can ramp targets
// up/down over several weeks (e.g. a reverse diet).

// Local Y-M-D key — matches the pattern used for calendar events, since
// start_date is a plain calendar date and comparing via toISOString() would
// shift it across a UTC boundary.
export function ymd(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

// referenceDate defaults to now — "active" almost always means "active as
// of today" (the phase list's ACTIVE badge, a form pre-fill, a before/after
// diff). Callers resolving targets for a SPECIFIC past check-in instead of
// "right now" pass that check-in's own submitted_at so a phase added/edited
// later doesn't get misattributed to an earlier check-in.
export function getActivePhase(phases, referenceDate = new Date()) {
  if (!phases || phases.length === 0) return null
  const todayKey = ymd(referenceDate)
  const eligible = phases.filter(p => p.start_date <= todayKey)
  if (eligible.length === 0) return null
  return eligible.reduce((latest, p) => (p.start_date > latest.start_date ? p : latest))
}

// Resolution order for a given check-in week: a coach's one-off weekly
// override > the plan's currently active phase > legacy flat profile
// columns (target_calories etc.) from before the plan builder existed, so
// clients who already had manual targets set don't lose them.
export function getEffectiveTargets(phases, overrides, weekNumber, legacy = {}, referenceDate = new Date()) {
  const override = overrides?.find(o => o.week_number === weekNumber)
  if (override) {
    return { calories: override.calories, protein: override.protein, carbs: override.carbs, fats: override.fats, source: 'override' }
  }
  const phase = getActivePhase(phases, referenceDate)
  if (phase) {
    return { calories: phase.calories, protein: phase.protein, carbs: phase.carbs, fats: phase.fats, source: 'plan' }
  }
  return {
    calories: legacy.target_calories ?? null,
    protein: legacy.target_protein ?? null,
    carbs: legacy.target_carbs ?? null,
    fats: legacy.target_fats ?? null,
    source: 'legacy',
  }
}
