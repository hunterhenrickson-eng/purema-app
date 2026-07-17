import { createContext, useContext } from 'react'
import { color as staticColor, appearance, font, type } from './theme'

// Centralizes the per-file "shadowed color" pattern that ClientHome.js/
// CoachDashboard.js/Auth.js/ResetPassword.jsx each currently reimplement
// locally (see their own top-of-file comments). That pattern only ever
// remaps `color` — font/type have no light/dark variation at all, so
// they're passed through unchanged here purely so a consumer can pull all
// three from one hook instead of one shadowed import plus a separate plain
// theme.js import.
//
// The value below is a plain object of literal 'var(--...)' strings, same
// as `appearance` itself — the actual light/dark switch happens entirely
// via CSS, driven by the [data-appearance] attribute AuthRoutes (App.js)
// and the force-light screens (Home.js/Pricing.js/PublicApply.jsx) set on
// documentElement, and tokens.css's corresponding selectors. Nothing here
// needs to react to that: the object itself never changes, only which
// values its var() references resolve to. So this is a plain constant, not
// state — no provider re-render, ever, is expected or needed.
//
// ClientHome.js/CoachDashboard.js shadow the LIGHT-named keys (bone,
// surfaceLight, surfaceNav, borderLight, textOnLight) since their JSX was
// originally written entirely in those terms (light-chrome dashboards).
// Auth.js/ResetPassword.jsx shadow the DARK-named keys (void, surfaceDark,
// surfaceDarkRaised, borderDark, textOnDark) for the same reason in the
// other direction (dark-chrome auth screens). The two key sets don't
// overlap, so both are merged into one `color` object here — any consumer
// can use whichever family its own JSX already relies on.
const appearanceColor = {
  ...staticColor,
  bone: appearance.surfacePage,
  surfaceLight: appearance.surfaceCard,
  surfaceNav: appearance.surfaceNav,
  borderLight: appearance.borderDefault,
  textOnLight: appearance.text,
  surfaceSunken: appearance.surfaceSunken,
  borderSubtle: appearance.borderSubtle,
  void: appearance.surfacePage,
  surfaceDark: appearance.surfaceCard,
  surfaceDarkRaised: appearance.surfaceRaised,
  borderDark: appearance.borderDefault,
  textOnDark: appearance.text,
}

const APPEARANCE_VALUE = { color: appearanceColor, font, type }

const AppearanceContext = createContext(APPEARANCE_VALUE)

export function AppearanceProvider({ children }) {
  return (
    <AppearanceContext.Provider value={APPEARANCE_VALUE}>
      {children}
    </AppearanceContext.Provider>
  )
}

// Default value on the context itself (above) already covers a
// missing-Provider case with the correct data, but useContext still needs
// a call site — this hook is that single, discoverable call site, importable
// from the same place a component would look for `color`/`font`/`type`.
export function useAppearance() {
  return useContext(AppearanceContext)
}
