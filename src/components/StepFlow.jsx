import { font, type } from '../lib/theme'
import { useAppearance } from '../lib/AppearanceContext'

// Shared step-form chrome, lifted out of CheckInForm.js (its original home)
// so a second multi-step form — PublicApply.jsx's intake questionnaire —
// doesn't have to reimplement the same numbered-section badge and progress
// header from scratch, or risk drifting from it over time. Both pieces are
// presentation-only: they take plain numbers/strings as props and know
// nothing about any particular form's fields, so they work the same way in
// an authenticated dashboard context (CheckInForm.js) and an anonymous
// pre-auth one (PublicApply.jsx) — color comes from useAppearance(), which
// is a plain object of CSS var() references, not React state, so it renders
// correctly under PublicApply's own forced `data-appearance="light"` with
// no extra wiring.

// Circular numbered badge + title + optional subtitle + bottom hairline —
// marks the start of one step's content.
export const SectionHeader = ({ number, title, subtitle }) => {
  const { color } = useAppearance()
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 24,
      paddingBottom: 16, borderBottom: `0.5px solid ${color.borderSubtle}` }}>
      <div style={{ width: 32, height: 32, borderRadius: '50%', background: color.forest,
        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        fontFamily: font.mono, fontSize: type.label, fontWeight: 500, color: color.sage }}>
        {number}
      </div>
      <div>
        <div style={{ fontSize: 17, fontWeight: 500, color: color.textOnLight.primary }}>{title}</div>
        {subtitle && <div style={{ fontSize: type.label, color: color.textOnLight.faint, marginTop: 2 }}>{subtitle}</div>}
      </div>
    </div>
  )
}

// "STEP n OF total" label + segmented bar row + a thin overall fill bar.
// `currentStep` is 0-indexed; `totalSteps` is the caller's own effective
// count for this render (CheckInForm.js, e.g., shrinks it when a
// conditional step is skipped) — this component doesn't need to know why.
export const StepProgress = ({ currentStep, totalSteps }) => {
  const { color } = useAppearance()
  return (
    <div style={{ marginBottom: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <span style={{ fontFamily: font.mono, fontSize: type.label, color: color.textOnLight.faint, letterSpacing: '0.1em' }}>
          STEP {currentStep + 1} OF {totalSteps}
        </span>
        <div style={{ display: 'flex', gap: 4 }}>
          {Array.from({ length: totalSteps }).map((_, i) => (
            <div key={i} style={{ width: 28, height: 3, borderRadius: 2,
              background: i <= currentStep ? color.forest : color.borderLight, transition: 'background 0.3s' }} />
          ))}
        </div>
      </div>
      <div style={{ height: 2, background: color.borderLight, borderRadius: 999 }}>
        <div style={{ height: '100%', width: `${((currentStep + 1) / totalSteps) * 100}%`,
          background: color.forest, borderRadius: 999, transition: 'width 0.4s ease' }} />
      </div>
    </div>
  )
}

// Back (shown only past the first step) + Continue/Submit nav row, matching
// CheckInForm.js's exact button treatment. `isLastStep` swaps the primary
// button from "Continue" to `submitLabel`, at which point it fires
// `onSubmit` instead of `onNext`.
export const StepNav = ({
  currentStep, isLastStep, onBack, onNext, onSubmit,
  submitLabel = 'Submit', submitting = false,
}) => {
  const { color } = useAppearance()
  return (
    <div style={{ display: 'flex', gap: 10, marginTop: 8 }}>
      {currentStep > 0 && (
        <button onClick={onBack} type="button"
          style={{ flex: 1, height: 48, background: color.bone, border: `1px solid ${color.borderLight}`,
            borderRadius: 10, fontSize: type.body, fontWeight: 500, color: color.textOnLight.secondary, cursor: 'pointer',
            fontFamily: font.sans }}>
          Back
        </button>
      )}
      {!isLastStep ? (
        <button onClick={onNext} type="button"
          style={{ flex: 3, height: 48, background: color.forest, border: 'none',
            borderRadius: 10, fontSize: type.body, fontWeight: 500, color: color.sage,
            cursor: 'pointer', fontFamily: font.sans }}>
          Continue
        </button>
      ) : (
        <button onClick={onSubmit} disabled={submitting} type="button"
          style={{ flex: 3, height: 48, background: submitting ? color.textOnLight.faint : color.forest, border: 'none',
            borderRadius: 10, fontSize: type.body, fontWeight: 500, color: color.sage,
            cursor: submitting ? 'not-allowed' : 'pointer', fontFamily: font.sans }}>
          {submitting ? 'Submitting...' : submitLabel}
        </button>
      )}
    </div>
  )
}
