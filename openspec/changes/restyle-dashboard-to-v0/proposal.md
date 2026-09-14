## Why

`land-finance-dashboard` split the v0 dashboard into atoms, molecules, organisms and a template, but rebuilt every component with generic utility classes. `/demo` works, yet it no longer looks like the v0 design: radii, sizes, typography, lime accents, the hero glow, the brushed background, the glass menu and the font are all gone. The v0 styles were never ported. Its CSS (`surface`, `lime`, `hero-card`, `app-shell`) did not exist in the repo, and no spec or verification step asked for visual fidelity.

## What Changes

- Port the v0 design tokens and global CSS from `referencia/globals-referencia.css` into `app/globals.css`, keeping the existing `light-dark()` + `data-theme` structure and the rule that components carry no literal colours. This covers the page shell gradient, hero card (gradient, border, shadow, orb, text glow), glass sheet, scrim, radius scale and the base border colour.
- Use Geist Sans as the body font. Remove the `Arial` override in `app/globals.css`.
- Restyle every dashboard atom, molecule, organism and the template to match its counterpart in `referencia/components-referencia/finance-dashboard-referencia.tsx`: 24/22/26px radii, 72px card headers, 64px hero number, 18px titles, 16px tabular amounts, tracked uppercase labels, lime open chevrons, dashed add rows, a pill month selector, summary panels spanning the full row, lime bars with glow, and a floating glass account sheet.
- Add a top bar with the Mango logo and the app name on the left and the avatar on the right. The logo is `public/mango-logo.svg` in light theme and `public/mango-logo-dark.svg` in dark theme (the dark file is supplied by the user).
- Add the v0 UI text that has no message yet (app name, "available" badge, hero income line, section and chart titles) to `messages/es.json` and `messages/en.json`.
- Change dashboard behaviour where v0 differs from the current specs, as decided by the user:
  - A budgeted category shows its progress bar and remaining-per-week text while collapsed.
  - The expanded card border uses the category colour.
  - The pie chart has a legend.
  - The avatar is 40px and brand-tinted.
  - The account menu becomes a floating glass sheet. It keeps rows ≥ 48px, text ≥ 12px, and no e-mail or plan badge.
- Exclude `referencia/` from `tsconfig.json` and ESLint. Its `.tsx` files make `npx tsc --noEmit` fail today.

## Capabilities

### New Capabilities
_None._

### Modified Capabilities
- `dashboard-ui`: collapsed expense cards show budget progress; the category colour also marks the expanded card border and the pie legend; the cycle header gains the logo top bar and the hero's "available" badge and income line; the avatar and account menu take the v0 look; a new requirement pins the v0 visual reference.
- `theming`: the base palette takes the v0 values; a brushed page background per theme; the hero glow requirement covers the hero card's orb and highlight; theme-specific images follow the active theme.

## Impact

- **Code:** `app/globals.css`, `tsconfig.json`, `eslint.config.mjs`, `messages/{es,en}.json`, every file in `components/{atoms,molecules,organisms,templates}/`. `app/layout.tsx` and `app/demo/page.tsx` stay as they are unless the layout needs the body class. No change to `lib/`, the data contract, the actions or the database.
- **Assets:** `public/mango-logo.svg` (present) and `public/mango-logo-dark.svg` (to be added by the user before the header task).
- **Dependencies:** none added. `tw-animate-css` and `shadcn/tailwind.css` from the reference are not needed.
- **Prerequisite:** the modified requirements live in the unarchived `land-finance-dashboard` change, and `openspec/specs/` is still empty. Archive `land-finance-dashboard` (and `translate-code-to-english`) before archiving this change, so `openspec/specs/dashboard-ui` and `openspec/specs/theming` exist for these deltas to apply to.
- **Docs:** several decisions contradict ARCHITECTURE.md §9 (category colour on the border, pie legend, brand-tinted avatar, dashed add row, pill month bar, bars before pie). ARCHITECTURE.md is not edited in this change; design.md lists the contradictions.
