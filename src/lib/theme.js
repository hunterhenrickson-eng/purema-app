// Purema design tokens.
// Change brand values HERE — every screen should pull from this file
// instead of hardcoding hex/px values inline. That's how we keep every
// screen consistent, and how we keep a single place to verify legibility.
//
// Contrast targets: WCAG AA minimum is 4.5:1 for normal text, 3:1 for
// large text (18px+/14px bold). The "on dark" / "on light" text tokens
// below are pre-checked against their intended background and meet that
// bar at the sizes we use them at — do not swap in a lighter/darker
// one-off gray without checking contrast again.

// profiles.appearance ('light' | 'dark' | 'system') wiring lives in App.js
// (sets/clears documentElement's [data-appearance] attribute) and
// src/styles/tokens.css (defines what each mode's values actually are).
// Brand accents below route through those CSS custom properties, so they
// shift globally with the current appearance — verified safe (badge() and
// these four values are never used on the app's intentionally-always-dark
// screens: AcceptInvite.jsx, ClientOnboarding.jsx, PublicApply.jsx).
export const color = {
  // Brand
  forest: 'var(--brand-forest)',
  void: '#0D0D0D',
  bone: '#FAFAFA',
  sage: 'var(--brand-sage)',
  gold: 'var(--brand-gold)',
  alert: 'var(--brand-alert)',
  // Saved/active button state (was a bare '#0D5E49' literal in several
  // components) and the sleep-trend chart line color — both now real tokens.
  forestPressed: 'var(--brand-forest-pressed)',
  chartPurple: 'var(--chart-purple)',
  // Brand-new fields (no prior static meaning to preserve), so unlike
  // bone/surfaceLight/etc. below these are safe to make appearance-aware
  // globally — any file can reference color.surfaceSunken/borderSubtle
  // directly without needing the per-file shadow pattern the four
  // full-toggle screens use.
  surfaceSunken: 'var(--surface-sunken)',
  borderSubtle: 'var(--border-subtle)',
  // Popover/dropdown drop-shadow (CalendarClientFilter, AddTimezonePin).
  // Same rgba(0,0,0,x) value in both modes — a dark shadow reads correctly
  // against both a light and a dark surface, so unlike surfaceSunken/
  // borderSubtle above this doesn't need genuinely different light/dark
  // values, just a single named token instead of the literal repeated
  // inline at each call site.
  shadowSoft: 'var(--shadow-soft)',

  // Surfaces
  // void/surfaceDark/surfaceDarkRaised/borderDark/bone/surfaceLight/
  // surfaceNav/borderLight intentionally stay STATIC hex, not CSS vars —
  // they're the palette AcceptInvite.jsx/ClientOnboarding.jsx/PublicApply.jsx
  // (permanently-dark screens) and most of the rest of the light-chrome app
  // still consume directly. Making these appearance-aware here would leak
  // dark-mode into every one of those screens as an unintended side effect.
  // ClientHome.js/CoachDashboard.js/Auth.js/ResetPassword.jsx instead get a
  // LOCAL shadowed `color` (see each file's own top-of-file comment) that
  // overrides just these fields with the appearance.* tokens below —
  // everything else in this shared object stays exactly as it always has.
  surfaceDark: '#141414',
  surfaceDarkRaised: '#1A1A1A',
  borderDark: '#2A2A2A',
  surfaceLight: '#FFFFFF',
  // One shade darker than bone/the main content background — used for nav
  // surfaces on light dashboards so the nav still visually separates from
  // content even though neither is a dark fill anymore.
  surfaceNav: '#EEEBE4',
  borderLight: '#E8E8E8',

  // Text on dark backgrounds (Void / surfaceDark / surfaceDarkRaised)
  textOnDark: {
    primary: '#F5F2ED',   // headings, primary body copy
    secondary: '#B8B8B8', // supporting copy — was #888, too low-contrast at small sizes
    label: '#9A9A9A',     // field labels / eyebrows — unifies the #555 vs #888 split we had
    faint: '#767676',     // lowest-emphasis text that STILL must be readable (footers, timestamps)
  },
  // Text on light backgrounds (Bone / white)
  textOnLight: {
    primary: '#0D0D0D',
    secondary: '#5C5C5C', // was #888 on white/bone — failed AA at small sizes
    label: '#6B6B6B',
    faint: '#767676',
  },

  // "Text on a sage-tinted success card" — a heading + caption pairing that
  // shows up identically in ClientHome.js, ClientSettings.js, and
  // CoachDashboard.js (e.g. "All caught up" / "Week N submitted"). Distinct
  // from badge()'s small-pill success text below — this is for a larger,
  // full-card treatment.
  successBorder: 'var(--status-success-border)',
  successTextStrong: 'var(--status-success-text-strong)',
  successTextSoft: 'var(--status-success-text-soft)',

  // The inline error-banner treatment (bg/border/text) used by CheckInForm's
  // validation error and, once wired below, Auth.js/ResetPassword.jsx's
  // sign-in/reset error — distinct from badge()'s alert pill (a much
  // smaller, always-legible chip vs. a full readable paragraph banner,
  // which needs its own higher-contrast text color per mode).
  alertBanner: {
    bg: 'var(--status-alert-banner-bg)',
    border: 'var(--status-alert-banner-border)',
    text: 'var(--status-alert-banner-text)',
  },
}

// Appearance-aware surface/text/border roles — the actual mechanism
// ClientHome.js/CoachDashboard.js/Auth.js/ResetPassword.jsx shadow `color`
// with (see each file's top-of-file comment). Not used directly by most
// components; go through the shadowed `color` object in those four files
// instead, so every existing `color.bone`/`color.textOnLight.primary`/etc.
// call site in those files keeps working unchanged while actually
// resolving through these tokens under the hood.
export const appearance = {
  surfacePage: 'var(--surface-page)',
  surfaceCard: 'var(--surface-card)',
  surfaceRaised: 'var(--surface-raised)',
  surfaceNav: 'var(--surface-nav)',
  surfaceSunken: 'var(--surface-sunken)',
  borderDefault: 'var(--border-default)',
  borderSubtle: 'var(--border-subtle)',
  text: {
    primary: 'var(--text-primary)',
    secondary: 'var(--text-secondary)',
    label: 'var(--text-label)',
    faint: 'var(--text-faint)',
  },
}

export const font = {
  sans: '"DM Sans", sans-serif',
  mono: '"DM Mono", monospace',
}

// Fluid type scale: comfortable and roomy on desktop, scales down on
// narrow viewports via clamp() — no media query required for text size.
// Every floor here is at or above 12px; nothing in the app should render
// text smaller than that.
export const type = {
  label: 'clamp(12px, 0.4vw + 11px, 13px)',
  caption: 'clamp(12px, 0.4vw + 11px, 13px)',
  body: 'clamp(14px, 0.3vw + 13px, 15px)',
  bodyLg: 'clamp(15px, 0.35vw + 14px, 17px)',
  heading: 'clamp(22px, 1.2vw + 17px, 28px)',
  display: 'clamp(26px, 1.6vw + 19px, 34px)',
}

// Shared treatment for the "purema." wordmark and any large heading that
// should read as part of the same type family — DM Sans at a light weight
// with tightened tracking. Font-size isn't baked in here (the wordmark and
// page headings use different sizes) — spread this and set fontSize per use.
export const displayStyle = {
  fontFamily: font.sans,
  fontWeight: 300,
  letterSpacing: '-0.03em',
}

// Shared style for any field label / section eyebrow — use this instead
// of redefining label styling per-component.
export const labelStyle = (onDark = true) => ({
  fontSize: type.label,
  fontWeight: 500,
  color: onDark ? color.textOnDark.label : color.textOnLight.label,
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
  fontFamily: font.mono,
  display: 'block',
  marginBottom: 6,
})

// Appearance-aware sibling of labelStyle — used only by the files that
// shadow `color` with the appearance.* tokens (see theme.js's `color`
// comment above). No onDark param: every existing call site in those
// files already only ever passes one direction (false for the two
// dashboards, the default true for Auth.js/ResetPassword.jsx), so this
// mirrors whichever one each file needs via a single import alias rather
// than threading a param through.
export const labelStyleAppearance = () => ({
  fontSize: type.label,
  fontWeight: 500,
  color: appearance.text.label,
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
  fontFamily: font.mono,
  display: 'block',
  marginBottom: 6,
})

// Soft-tint background + dark-same-hue text for every status pill in the
// app (check-in Reviewed/Pending, Imported tag, attention queue, subscription
// tier, payment banners, calendar event types). Built on the existing brand
// hues (sage/gold/alert) rather than inventing new colors, so a "success"
// badge here is always the same green as everywhere else success shows up.
// Routes through the appearance CSS vars globally (verified badge() is
// never used on the app's permanently-dark screens) — background and text
// are paired per hue and must move together, since each pill's text is only
// legible against its OWN hue's background, not whatever surface it sits on.
const BADGE_HUES = {
  success: { background: 'var(--status-success-bg)', textColor: 'var(--status-success-text)' },
  warning: { background: 'var(--status-warning-bg)', textColor: 'var(--status-warning-text)' },
  alert: { background: 'var(--status-alert-bg)', textColor: 'var(--status-alert-text)' },
  neutral: { background: 'var(--status-neutral-bg)', textColor: 'var(--status-neutral-text)' },
  info: { background: 'var(--status-info-bg)', textColor: 'var(--status-info-text)' },
}

export function badge(kind = 'neutral') {
  const hue = BADGE_HUES[kind] || BADGE_HUES.neutral
  return {
    background: hue.background,
    color: hue.textColor,
    fontFamily: font.mono,
    fontSize: type.label,
    fontWeight: 500,
    padding: '3px 10px',
    borderRadius: 999,
    display: 'inline-block',
    lineHeight: 1.5,
  }
}

// Standard active/inactive treatment for any nav item (sidebar, top tabs,
// mobile tab bar) — one shared style so every nav surface in the app reads
// the same way instead of each screen inventing its own indicator (a gray
// background pill, a border-bottom underline, a border-top tick, etc).
// `color` alone is enough to tint both an icon (via stroke="currentColor")
// and its label, since both use the same hue in either state.
export function navItemStyle(active, onDark = true) {
  return {
    color: active ? color.forest : (onDark ? color.textOnDark.faint : color.textOnLight.secondary),
    fontWeight: active ? 500 : 400,
    background: active ? (onDark ? 'rgba(15,110,86,0.16)' : 'rgba(15,110,86,0.10)') : 'transparent',
    borderRadius: 8,
  }
}

// Appearance-aware sibling of navItemStyle — same reasoning as
// labelStyleAppearance above. Every existing call site in the two
// dashboards already only ever passes onDark=false, so one fixed opacity
// (between the old 0.16/0.10 split) reads fine in either resolved mode
// without needing a CSS-var-driven rgba(), which custom properties can't
// easily express without also splitting out r/g/b components separately.
export function navItemStyleAppearance(active) {
  return {
    color: active ? color.forest : appearance.text.secondary,
    fontWeight: active ? 500 : 400,
    background: active ? 'rgba(15,110,86,0.12)' : 'transparent',
    borderRadius: 8,
  }
}

export const inputStyle = {
  width: '100%',
  padding: '12px 14px',
  borderRadius: 8,
  border: `1px solid ${color.borderDark}`,
  background: color.surfaceDarkRaised,
  color: color.textOnDark.primary,
  fontSize: type.body,
  fontFamily: font.sans,
  outline: 'none',
  boxSizing: 'border-box',
  transition: 'border-color 0.15s ease',
}

// Appearance-aware sibling of inputStyle, for Auth.js only — inputStyle
// itself stays untouched since AcceptInvite.jsx/ClientOnboarding.jsx/
// PublicApply.jsx/MessageThread.jsx also consume it and must keep their
// current static-dark rendering.
export const inputStyleAppearance = {
  width: '100%',
  padding: '12px 14px',
  borderRadius: 8,
  border: `1px solid ${appearance.borderDefault}`,
  background: appearance.surfaceRaised,
  color: appearance.text.primary,
  fontSize: type.body,
  fontFamily: font.sans,
  outline: 'none',
  boxSizing: 'border-box',
  transition: 'border-color 0.15s ease',
}
