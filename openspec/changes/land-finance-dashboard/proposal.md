## Why

`components/finance-dashboard.tsx` came out of v0 as a single 98-line file with its mock data inline, colours as literal hex, and Spanish text and user data mixed into a translation object that doesn't exist in this repo. It doesn't compile here. As written it can't feed the `/demo` route (ARCHITECTURE.md §12), can't render the light theme (§9), and can't switch language (§2). If it gets wired to Supabase in this shape, every card has to be untangled by hand later, which is exactly the work §12 says to avoid by deciding the data boundary up front.

## What Changes

- Split the dashboard into the units §9 describes (month selector, free-margin hero, the three expandable summary cards, category card, account avatar, account menu, pie and month-over-month charts), organised by atomic design level: atoms, molecules, organisms and one dashboard template under `components/`, with the `app/` routes as the page level, so other screens can reuse the lower levels. A single category card component renders the "Gastos fijos" group and every spending category.
- Define a typed dashboard data contract (numbers and ISO dates, never formatted strings). Every component receives its data and action handlers through props, and none of them imports a data-access module. Lint rules enforce this, and also that components only import from lower levels.
- Group expenses as one "Gastos fijos" card (all `es_fijo` transactions) followed by one card per category with only its variable transactions, so each expense appears exactly once. The v0 "Variable" pseudo-category goes away.
- Move budget consumption and weekly-remaining maths out of pre-written sentences and into a pure function in the shared data layer (§9 *Seguimiento contra presupuesto*).
- Add a public `/demo` route that renders the dashboard from an in-memory, fictional, internally consistent sample cycle, with a permanent "sample data" notice (§12).
- Replace the create-next-app `globals.css` with Mango's theme tokens for light and dark, including per-theme values for the eight stored category colour names. Components carry no literal colours. Add a working light / dark / automatic toggle in the account menu with no flash on load.
- Move all UI strings into `messages/es.json` and `messages/en.json`. The language is chosen from the account menu, kept in a cookie, and URLs stay the same. Money and dates are formatted per locale, currency and timezone.
- Replace the hand-rolled conic-gradient and div charts with the charting library chosen in §2.
- Fix the component's contradictions with ARCHITECTURE.md (listed in design.md → *Context*) as part of the split.
- Delete `components/finance-dashboard.tsx` once the split components replace it.

## Capabilities

### New Capabilities
- `dashboard-ui`: monthly dashboard composition, the reusable category card, summary cards, account menu, charts, data supplied only through props, and the public `/demo` route.
- `theming`: colour tokens for light and dark, per-theme resolution of category colour names, and the persisted light/dark/automatic toggle.
- `localization`: UI strings from translation files in Spanish and English, runtime language switching, and locale-aware money and date formatting.

### Modified Capabilities
_None — `openspec/specs/` is empty._

## Impact

- **Code:** new `components/{atoms,molecules,organisms,templates}/*`, `lib/datos/dashboard.ts` (contract), `lib/datos/presupuesto.ts` (pure budget maths), `lib/demo/datos-demo.ts`, `app/demo/page.tsx`, `i18n/request.ts`, `messages/{es,en}.json`, `lib/utils.ts`. Modified: `app/layout.tsx`, `app/globals.css`, `next.config.ts`, `eslint.config.mjs`, `package.json`. Removed: `components/finance-dashboard.tsx`.
- **Dependencies:** `next-intl`, `lucide-react`, `recharts` (+ `react-is`), plus the packages `components/ui/button.tsx` already imports (`@base-ui/react`, `class-variance-authority`, `clsx`, `tailwind-merge`). Without them `next build` fails today.
- **Routing:** reading the locale cookie in the root layout makes routes render dynamically. `/` (still the create-next-app page) is untouched.
- **Out of scope:** the real Supabase loader for `/`, which needs web auth and an RLS session client that don't exist yet. Also out: writing `usuarios.idioma`, and the §9 interactions the component doesn't have (inline edit, swipe delete, reorder, sticky glass bar, desktop two-column layout). See design.md → *Non-Goals*.
- **Roadmap:** English moves from phase 3 (§13) into this change, at the user's request.
