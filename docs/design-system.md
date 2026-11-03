# VendorGuard AI — Design System

Single source of truth: [`src/design/tokens.css`](../frontend/src/design/tokens.css).
Component classes live in [`src/index.css`](../frontend/src/index.css).

## 1. Semantic tokens

Brand identity stays heritage (olive / beige-paper / espresso / brass), expressed as
semantic variables so themes swap without touching components.

| Token | Light | Dark | Use |
| --- | --- | --- | --- |
| `--surface-0` | `#F7F2E7` | `#0B0D0A` | page base |
| `--surface-1` | `#FDFAF3` | `#12150F` | cards, raised panels |
| `--surface-2` | `#F0E9D8` | `#191D14` | insets, chips, wells |
| `--surface-dark` | `#211A12` | `#15120C` | espresso panels |
| `--text-primary` | `#2E2011` | `#EDE8DA` | body/headings |
| `--text-secondary` | `#6E6656` | `#B3AC9C` | supporting copy |
| `--text-tertiary` | `#6B6355` | `#A09A8A` | captions (AA on surface-0) |
| `--border-subtle` | `rgba(62,48,26,.14)` | `rgba(237,232,218,.10)` | hairlines |
| `--accent` / `--accent-strong` | olive 600/700 | lighter olive | primary actions, bars |
| `--brass` / `--brass-deep` | `#B9975B` / `#96763F` | lighter | accent rules, highlights |
| `--ok` / `--warn` / `--danger` | sage / gold / terracotta | lighter | status only, always paired with icon + label |

Status is never colour-only: Supported carries a check icon, Contradicted an X,
Insufficient a question mark, alongside the label chip.

**Dark theme** is first-class: `html.dark` swaps tokens (near-black olive `#0B0D0A`
base — never pure black), a pre-paint bootstrap in `index.html` prevents flash, and
a bridging block in `index.css` flips legacy inline utilities (`bg-cream-*`,
`bg-linen*`, `text-espresso`, …) until they migrate to tokens.

## 2. Type

- **UI:** Inter Variable (self-hosted via Fontsource).
- **Display:** Fraunces Variable (self-hosted), used for headlines, supplier names,
  and the analyst quote. Italic for emphasis moments ("Verify the AI.").
- **Fluid scale (clamp):** display `3.25rem→7rem`, h1 `2.25→4.25`, h2 `1.6→2.6`,
  h3 `1.2→1.45`, body `1rem`, caption `0.75rem`.
- Display tracking `-0.03em`, headline line-height `1.05–1.1`, body `1.58`.
- **Tabular numerals** on all metrics, tables and IDs (`.tabular`, `td`, `.font-mono`).

## 3. Spacing & layout

- 4/8 grid; section padding `clamp(4.5rem, 10vw, 11rem)` (`--space-section`).
- Content max `1200px` (`--content-max`); text measure ≤ `66ch`.
- Radii: cards `20px`, large panels `26px`, buttons/inputs `12px`.
- Shadows are warm-tinted layered tokens (`--shadow-card`, `--shadow-lifted`), never pure black.
- Glass (backdrop-blur) is reserved for the nav, floating bars and chips — body
  content uses solid or 80%-opacity surfaces for readability.

## 4. Motion rules

- Easing: entrances `cubic-bezier(0.22, 1, 0.36, 1)` (`--ease-entrance`); interactive
  springs `{stiffness: 300, damping: 30}`.
- Durations: 150 / 250 / 450 / 800 ms (`--dur-1..4`). Scroll-driven stories may run longer.
- Animate **only** transform + opacity. Every animation has a job: reveal, focus,
  state change, or spatial continuity.
- Required mechanics:
  - Scroll-reveal via IntersectionObserver (`.reveal-init` → `.is-visible`); SPA-safe
    through a MutationObserver in `App.tsx`.
  - Nav active pill is a Framer Motion `layoutId` shared-layout spring.
  - Count-ups on first view; list staggers 40–60 ms; press scale `0.98`.
- `prefers-reduced-motion`: Lenis disabled, reveals rendered visible, all durations
  collapse to ~0.

## 5. Component inventory

Buttons (`btn-primary / -brass / -ghost / -dark / -danger / -quiet`, all with hover,
active, focus-visible ring, disabled, loading), inputs (`input-premium` with focus ring
+ brighten), badges (`badge-success / -warning / -danger / -info`), tabs with sliding
pill (`tab-active / -idle`), skeletons (`.skeleton` shimmer, shaped like final content),
cards (`card-premium` + optional `card-hover`), section label (`.section-label`, the one
header treatment), glass surfaces (`glass-dark`, `glass-chip`, `glass-light`),
`ScoreRing`, `CountUp`, pipeline stepper (with `aria-live="polite"`).

## 6. Accessibility

WCAG 2.2 AA targets: `--text-tertiary` was darkened specifically to hold 4.6:1 on
paper. Focus-visible brass ring on every interactive element; `aria-live` on the
pipeline stepper; keyboard shortcuts modal (`?`); 44px touch targets on mobile
controls; dark sections on the landing page keep cream text at AAA. Known gap:
full keyboard operation of the 3D graph (a semantic fallback table exists in the
workspace Graph tab).

## 7. Performance

- Three.js is lazy-loaded (`React.lazy`) and only where used; DPR capped at 2.
- Fonts self-hosted variable (Inter, Fraunces) — zero render-blocking CDN.
- Animations transform/opacity only; skeletons use a single composited shimmer.
- Landmark elements, semantic headings, and print styles that strip chrome.

## 8. Deliberately not done (and why)

- **Full per-screen dark tuning** — the token bridge covers every surface in use;
  bespoke dark art direction per tab is deferred until components migrate off
  inline utilities.
- **Command palette (Cmd+K)** — the keyboard-shortcuts modal ships; a full palette
  needs an action registry that should be designed with the backend team.
- **GSAP** — Framer Motion covered every scenario; adding GSAP would duplicate motion
  runtimes for no user-visible gain.
- **Lighthouse CI in-session** — the sandbox cannot launch Chrome; budgets are enforced
  by construction (lazy 3D, self-hosted fonts, transform-only animation) and should be
  verified with `npx lighthouse` on a deployed build.
