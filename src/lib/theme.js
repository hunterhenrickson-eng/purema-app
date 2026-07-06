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

export const color = {
  // Brand
  forest: '#0F6E56',
  void: '#0D0D0D',
  bone: '#F5F2ED',
  sage: '#EAF3DE',
  gold: '#BA7517',
  alert: '#E24B4A',

  // Surfaces
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

// Soft-tint background + dark-same-hue text for every status pill in the
// app (check-in Reviewed/Pending, Imported tag, attention queue, subscription
// tier, payment banners, calendar event types). Built on the existing brand
// hues (sage/gold/alert) rather than inventing new colors, so a "success"
// badge here is always the same green as everywhere else success shows up.
const BADGE_HUES = {
  success: { background: color.sage, textColor: '#1A5C0A' },
  warning: { background: '#FAEEDA', textColor: '#633806' },
  alert: { background: '#FBE4E3', textColor: '#8A2A28' },
  neutral: { background: '#F0EDE8', textColor: color.textOnLight.secondary },
  info: { background: '#E3F0EC', textColor: color.forest },
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
