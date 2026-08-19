# Purema Design Tokens — Source of Truth

Full audit of colors, typography, spacing, and brand assets, pulled directly
from `src/styles/tokens.css`, `src/lib/theme.js`, and `src/styles/globals.css`
— not summarized from memory or from comments in those files, several of
which are themselves stale (see Findings below). Several values were also
live-verified against the actual running app via computed styles, marked
**✓ live-confirmed** below.

Audited 2026-08-19. Re-verify against the files directly before trusting this
doc long-term — it's a snapshot, not a live source.

---

## ⚠️ Findings

**1. `ZoneHeader`'s `fontWeight: 600` isn't a loaded font face.**
[src/pages/CoachDashboard.js:581](../src/pages/CoachDashboard.js#L581) (the
"What changed / What it means / What's next" zone labels in the check-in
review modal) sets `fontWeight: 600`. Only weights 300/400/500 are actually
`@font-face`-registered for DM Sans
([src/styles/globals.css:5](../src/styles/globals.css#L5):
`DM+Sans:wght@300;400;500`) — confirmed via `document.fonts` on the live
page; no 600 face is present. The browser still accepts and reports `600` in
computed style (✓ live-confirmed), but since there's no real 600 design, it
almost certainly renders as synthetic/faux-bold over the 500 face rather
than a true weight — the one outlier against the app's otherwise-consistent
300/400/500 scale.

**2. `manifest.json` still has stale CRA default colors.**
[public/manifest.json:23-24](../public/manifest.json#L23) still ships
Create React App's stock scaffold values — `theme_color: "#000000"`,
`background_color: "#ffffff"` — never updated to Bone/Forest. Low-impact
(only affects PWA install-splash theming), but worth a one-line fix
whenever someone's next in that file.

**3. `tokens.css`'s own file header is stale.** It claims *"THIS FILE IS
NOT WIRED INTO ANY COMPONENT YET... nothing in the app reads these custom
properties today"* ([tokens.css:1-7](../src/styles/tokens.css#L1)). False as
of now — `CoachDashboard.js`, `ClientHome.js`, `Auth.js`, and
`ResetPassword.jsx` all shadow their local `color` object with
`appearance.*` tokens that resolve straight to these CSS vars. Confirmed
live: computed sidebar/body backgrounds match `tokens.css`'s `:root` values
exactly (below).

**4. `tokens.css`'s own Bone comment is stale.** It claims theme.js's
`color.bone` and globals.css's `--bone` are "separate literal copies" that
"still read `#FAFAFA`" ([tokens.css:59-64](../src/styles/tokens.css#L59)).
False today — verified by reading both files directly and by live computed
style. All three sources agree on `#F5F2ED`. No `#FAFAFA` or `#FAFAF9`
exists anywhere in actual code anymore, only in this one outdated comment.

**5. Shadows exist — narrowly, deliberately.** Brand direction is
hairline-borders-over-shadows, and cards genuinely have zero shadow. But 3
real `boxShadow` call sites exist, all using the same named token
`color.shadowSoft` (`rgba(0,0,0,0.12)`): two calendar-filter dropdown
popovers in `CoachDashboard.js` (lines 2382, 2448) and one marketing-page
hero-screenshot frame in `Home.js` (line 150). Deliberate popover-elevation
exceptions — never used on cards or buttons.

**6. "Info" status color isn't a distinct hue in light mode.**
[tokens.css:113](../src/styles/tokens.css#L113):
`--status-info-text: #0F6E56` — byte-for-byte identical to `--brand-forest`.
Light-mode "info" is just Forest text on a teal-tinted background, not a
separate color family. Dark mode does get a genuinely distinct teal
(`#4FBFA8`).

---

## 1. Colors

| Token | Light hex | Dark hex | Source |
|---|---|---|---|
| **Forest** (primary brand green) | `#0F6E56` | `#16A085` | [tokens.css:36](../src/styles/tokens.css#L36) `--brand-forest`; consumed via `theme.js:21` `color.forest` |
| **Forest — pressed/active state** | `#0D5E49` | `#0F6E56` | [tokens.css:37](../src/styles/tokens.css#L37) `--brand-forest-pressed`. No separate hover shade exists — hover interactions reuse base Forest directly; this token is specifically the post-save/"pressed" button state. |
| **Sage** (light-green accent bg) | `#EAF3DE` | `#1A3620` | [tokens.css:40](../src/styles/tokens.css#L40) `--brand-sage` |
| **Bone** (main app background) | `#F5F2ED` | n/a (dark mode uses Void) | Three independent sources agree: [tokens.css:65](../src/styles/tokens.css#L65) `--surface-page`, [theme.js:27](../src/lib/theme.js#L27) `color.bone`, [globals.css:11](../src/styles/globals.css#L11) `--bone`. ✓ live-confirmed: `document.body` computed background = `rgb(245, 242, 237)`. |
| **Sidebar background** | `#EEEBE4` | `#161616` | Distinct from Bone. [tokens.css:68](../src/styles/tokens.css#L68) `--surface-nav`, applied at [CoachDashboard.js:3844](../src/pages/CoachDashboard.js#L3844). ✓ live-confirmed: sidebar computed bg = `rgb(238, 235, 228)`. |
| **Card/surface background** | `#FFFFFF` | `#141414` | [tokens.css:66](../src/styles/tokens.css#L66) `--surface-card`; static fallback `theme.js:64` `color.surfaceLight`. ✓ live-confirmed on a card: `rgb(255, 255, 255)`. |
| **Primary text (Void)** | `#0D0D0D` | `#F5F2ED` | [tokens.css:91](../src/styles/tokens.css#L91) `--text-primary`; static `theme.js:80`/`theme.js:22` |
| **Secondary text** | `#5C5C5C` | `#B8B8B8` | [tokens.css:92](../src/styles/tokens.css#L92) `--text-secondary`; static `theme.js:81` |
| **Label/eyebrow text** | `#6B6B6B` | `#9A9A9A` | [tokens.css:93](../src/styles/tokens.css#L93) `--text-label`; static `theme.js:82`. Middle tier of a four-step hierarchy — primary → secondary → label → faint. There's no token literally named "muted." |
| **Faint/lowest-emphasis text** | `#767676` | `#767676` (same both modes) | [tokens.css:94](../src/styles/tokens.css#L94) `--text-faint`; static `theme.js:83` |
| **Border/hairline divider** | `#E8E8E8` | `#2A2A2A` | [tokens.css:77](../src/styles/tokens.css#L77) `--border-default`; static `theme.js:69`. ✓ live-confirmed on a card: `0.5px solid rgb(232, 232, 232)`. A subtler internal-divider tier also exists: `--border-subtle` `#F0F0F0` light / `#232323` dark. |
| **Gold** | `#BA7517` | `#D4922A` | [tokens.css:38](../src/styles/tokens.css#L38) `--brand-gold` — confirmed accurate against the brand doc. |
| **Alert/red** | `#E24B4A` | `#E24B4A` (same both modes) | [tokens.css:39](../src/styles/tokens.css#L39) `--brand-alert` — confirmed accurate against the brand doc. |
| **Informational** | `#0F6E56` text / `#E3F0EC` bg | `#4FBFA8` text / `#16302B` bg | [tokens.css:112-113](../src/styles/tokens.css#L112). See Finding 6 — not a distinct hue in light mode. |
| **Chart accent** | `#7C6AF5` | `#9B8CF9` | [tokens.css:43](../src/styles/tokens.css#L43) `--chart-purple` — sleep-trend line, ClientHome.js only. |

Chevron mark stroke color ✓ live-confirmed as `rgb(15, 110, 86)` = `#0F6E56`
= Forest, exactly as the brand doc states.

## 2. Status colors (primary + pill-tint pair)

Source: `BADGE_HUES` in [theme.js:204-210](../src/lib/theme.js#L204), values
from [tokens.css:97-113](../src/styles/tokens.css#L97) (light) /
[:141-156](../src/styles/tokens.css#L141) (dark). The `badge()` function
styles every status pill in the app.

| Status | Bg tint (light) | Text (light) | Bg tint (dark) | Text (dark) |
|---|---|---|---|---|
| Success | `#EAF3DE` | `#1A5C0A` | `#16301C` | `#6FCF52` |
| Warning | `#FAEEDA` | `#633806` | `#3D2E0D` | `#E8B85C` |
| Alert (pill) | `#FBE4E3` | `#8A2A28` | `#3A1616` | `#F2938F` |
| Info | `#E3F0EC` | `#0F6E56` | `#16302B` | `#4FBFA8` |
| Neutral | `#F0EDE8` | `#5C5C5C` | `#232323` | `#B8B8B8` |

A separate, more prominent **alert banner** treatment also exists
([tokens.css:106-109](../src/styles/tokens.css#L106)): bg `#FCEBEB`, border
`#F9CCCC`, text `#791F1F` (light).

## 3. Typography

- **Font family**: `"DM Sans", sans-serif` for everything, including "mono"
  — [theme.js:136-139](../src/lib/theme.js#L136): `font.mono = font.sans`.
  DM Mono was genuinely retired sitewide; the only literal
  `"DM Mono", monospace` reference left anywhere in the codebase is the
  deliberate exception in `AdminDashboard.js` (lines 421, 426 — the JSON
  audit-log diff view, which needs real fixed-width glyphs). `globals.css:5`
  still imports DM Mono weight 400 *only* to serve that one exception.
- **Weights loaded**: 300, 400, 500 (`globals.css:5`). ✓ live-confirmed via
  `document.fonts`.
- **Weights actually used** (by frequency): 500 (159×, dominant — buttons,
  labels, emphasis), 300 (17×, display/heading/wordmark), 400 (2× explicit,
  otherwise the browser default), and 600 (1×, the `ZoneHeader` outlier —
  see Finding 1).
- **Headings/wordmark**: weight 300, via `displayStyle`
  ([theme.js:158-162](../src/lib/theme.js#L158)), letter-spacing `-0.03em`.
- **Body text**: no explicit weight (inherits 400).
- **UI labels/eyebrows**: weight 500, uppercase, letter-spacing `0.08em`,
  via `labelStyle()`/`labelStyleAppearance()`
  ([theme.js:166-193](../src/lib/theme.js#L166)).
- **Other letter-spacing values in active use**: `0.1em` (19×, section
  titles), `0.06em` (18×), `-0.02em`/`-0.03em` (8×/7×, headings), `0.08em`
  (4×, the shared label style), plus smaller one-offs (`0.04em`, `-0.01em`,
  `0.18em`, `0.05em`, `0.02em`).

## 4. UI styling — exact pixel values

| Element | Radius | Source |
|---|---|---|
| Card (`S.card`) | `12px` | [CoachDashboard.js:162](../src/pages/CoachDashboard.js#L162). ✓ live-confirmed. |
| Modal (CheckInDetail outer) | `16px` | [CoachDashboard.js:591](../src/pages/CoachDashboard.js#L591) |
| Filled primary button | `8px` | e.g. line 889 (Save feedback) |
| Outline/secondary button | `6px` | e.g. line 857 (Save override) |
| Pill/badge (incl. quick-select buttons) | `999px` (true pill) | [theme.js:221](../src/lib/theme.js#L221) `badge()` |
| Plain text `<input>` | `6px` | e.g. line 853 |
| `<textarea>` | `8px` | e.g. line 885 |
| Shared `inputStyle` token (Auth-family screens) | `8px` | [theme.js:260](../src/lib/theme.js#L260) |

**Card border**: `0.5px solid #E8E8E8` — hairline, exactly as the brand
direction states. ✓ live-confirmed: `0.5px solid rgb(232, 232, 232)`.

**Box-shadows**: exist in exactly 3 places, all popover-elevation, never on
cards — see Finding 5.

## 5. Brand assets

- **Wordmark + chevron mark**: not separate files — drawn entirely inline as
  JSX/SVG, duplicated per-file rather than shared (an established
  convention in this codebase). Canonical copy in `CoachDashboard.js`:
  - `Mark` component: lines 41-47 — three `<polyline>` chevrons, increasing
    stroke-width (2/3.5/5.5), `stroke={color.forest}`.
  - `Logo` (full wordmark): lines 3612-3620 — `Mark` + `"purema"` text in
    `displayStyle` + a separately-colored Forest `"."`.
  - ✓ live-confirmed: chevron stroke computed as `#0F6E56` (Forest),
    exactly as the brand doc claims.
- **Favicon/app icons**: real files in `public/` — `favicon.ico` (803
  bytes), `logo192.png`, `logo512.png`, referenced from `index.html` and
  `manifest.json`. `logo192.png` is genuinely the custom Purema chevron
  mark (verified by opening it, not the CRA default) — filled/solid green
  triple-chevron, consistent with the app's Forest.
- `index.html` is otherwise still the unmodified CRA scaffold template
  (comments, structure) apart from the `<title>` and meta description.

---

## Social-media palette (compiled for external marketing use)

Flat hex swatches, no internal token machinery or file references — the
values a designer or marketer actually needs when building an off-app asset
(social graphics, one-pagers, ads). Light-mode values only; dark mode is an
in-app appearance toggle, not a distinct brand identity.

| Swatch | Hex | Use |
|---|---|---|
| 🟢 Forest | `#0F6E56` | Primary brand color — logo, primary buttons, links |
| 🟢 Forest Pressed | `#0D5E49` | Darker accent / pressed state |
| 🟡 Gold | `#BA7517` | Secondary accent, highlights, "founding cohort" callouts |
| 🔴 Alert | `#E24B4A` | Error/urgency accent only — not a primary brand color |
| 🟢 Sage | `#EAF3DE` | Soft background tint, success framing |
| ⚪ Bone | `#F5F2ED` | Primary background |
| ⚪ White | `#FFFFFF` | Card/surface background |
| ⚫ Void | `#0D0D0D` | Primary text / ink, dark chrome |
| ⚫ Text Secondary | `#5C5C5C` | Body copy on light backgrounds |

**Typeface**: DM Sans (weights 300/400/500 only — do not request 600 or
above, no matching face exists; see Finding 1).

**Logo mark**: chevron triple-arrow in Forest (`#0F6E56`), available as
`public/logo192.png` / `public/logo512.png` (raster) — no standalone vector
export exists yet; the canonical source is the inline SVG `Mark` component
in `src/pages/CoachDashboard.js`.
