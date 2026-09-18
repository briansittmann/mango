## Context

See proposal.md → *Why*. Current state of the repo:

- `components/finance-dashboard.tsx`: one client component with mock data, an inline hex palette and a `t` object from `@/lib/translations`, which does not exist.
- `components/ui/button.tsx` (from v0) imports `@base-ui/react`, `class-variance-authority` and `@/lib/utils`, none of which exist. Because Next type-checks every `*.tsx`, **`next build` fails today** even though nothing imports these files.
- `app/globals.css` is the create-next-app default (only `--background` and `--foreground`). `app/layout.tsx` hardcodes `lang="en"`. `app/page.tsx` is the create-next-app page.
- Data layer: `lib/data/*` (Spanish identifiers) uses only `supabaseAdmin()`. There is no web auth and no RLS session client.
- Schema facts used here: `categorias.color` is limited to 8 names (migration 0004), `usuarios.idioma` is `es|en`, `usuarios.dia_inicio_ciclo` runs 1–28, `transacciones.es_fijo`, `rango_ciclo_usuario()`.
- Next 16.3 (`AGENTS.md`: read the bundled docs). Relevant guides: `02-guides/internationalization.md` and `02-guides/preventing-flash-before-hydration.md`.
- `package.json` has no test runner. Verification relies on `tsc`, `eslint`, `next build`, grep guards and in-browser checks.

### Where the component contradicts ARCHITECTURE.md

| # | In the component | ARCHITECTURE.md says | Resolution in this change |
|---|---|---|---|
| 1 | Imports `@/lib/translations` (missing) and `lucide-react` (not installed); `<img src="/mango-logo.svg">` (not in `public/`) | §2 stack | Install deps; messages via next-intl; logo: see Open Questions |
| 2 | Uses `bg-surface`, `text-muted`, `text-lime`, `bg-amber`, `bg-red`, `app-shell`, `hero-card`, `hero-value`, none defined in CSS | §9 *Paleta confirmada*, *Tema claro y oscuro* | Token system (D7) |
| 3 | All figures inline: `categories`, 540, 2.400 €, 1.833 €, 280 €, 4.850 €, bar heights, pie angles | §12: components receive data, never own it | Data contract + props (D2) |
| 4 | Data inside the translation object: `t.incomeSources`, `t.savingsMovements`, `t.account.name/email`, `t.dates.sep3`, `t.month`, `t.months` | §2: translation files hold UI text; §12: data is injected | Split: UI text → messages, data → contract |
| 5 | Amounts are pre-formatted strings with a literal `€`; sorted with `parseInt('1.833 €')`, which returns `1`, so any total ≥ 1 000 sorts last | §4/§8 `moneda_default` editable; §2 multi-language | Numbers in the contract; format at render (D9) |
| 6 | Budget text is a Spanish sentence in the data (`'Te quedan 20 por semana'`) | §9 *Seguimiento*: computed once in the shared data layer; §2 | Pure function (D3) + ICU message |
| 7 | Literal Spanish in JSX: `de` in the budget header, `aria-label="Cerrar menú"`, `"Menú de cuenta"`, `"Abrir menú de cuenta"`; avatar text `MG` | §2 | Messages + lint guard (D4) |
| 8 | "Fixed" and "Variable" treated as categories; `Ocio` is a row inside "Variable" | §8: fijo is the `es_fijo` flag, not a category; §9 *Alcance*: `ocio` is a budgeted category | Fijos group + real categories (D2) |
| 9 | Category names from translation keys (`t.categories.food`) | §8: `categorias.nombre` is user data | Names come from data; only the fijos label is translated |
| 10 | Palette names `slate/amber/orange/purple/blue/stone` + hex map; `food` is **amber**; orange goes to "Variable" | §9: amber/red reserved for budget state; orange → comida; stored names are `naranja_calido…granate` | 8 stored names → per-theme tokens (D8) |
| 11 | Expanded card border painted with the category colour | §9: colour only on the dot and the pie slice | Border uses a token |
| 12 | Pie: legend rendered, only `slice(0, 5)` shown, hardcoded angles, no slice separator; charts hand-rolled | §9: legend unnecessary, thin separator; §2: Recharts | D11 |
| 13 | `#111511`, `#20251F`, `rgba(195,232,107,.3)` glow, `white/…` and `black/…` alphas | §9: glow drops in light theme; "white" must resolve per theme | Tokens only; lint/grep guard |
| 14 | Month selector is a bordered pill bar | §9: "un título con flechas, no una barra" | Title + chevrons |
| 15 | Avatar: 40px, lime border/fill/text, hardcoded `MG` | §9: 36px, photo or name initial, no lime/green | Fixed |
| 16 | Account menu shows e-mail and a "plan" badge; theme/language rows inert; text 8–11px; rows 32–40px | §9: name + phone; no plans exist (coste cero); 48px touch rows | Fixed; theme + language work |
| 17 | "Añadir gasto" is a dashed grey box | §9: light `+` row in muted lime (the dashed style belongs to "Añadir categoría") | Restyled as a row |
| 18 | "Colapsar todo" button, but state allows only one open card, so the button does nothing | §9: cards open independently | `Set` of open ids (D6) |
| 19 | Rows keyed by `item.name`, so duplicates collide (two "Lidl" rows) | — (bug) | Key by id |
| 20 | Income card shows no estimate reference | §9 *Ingresos esperados*: real + muted "X de Y estimados" | Added to income panel rows |
| 21 | Single 480px column at every width; header not sticky; month not in top bar | §9 desktop two columns; sticky glass bar | **Not fixed** → Non-Goals |

### Inconsistencies inside ARCHITECTURE.md found while planning

- **Fijos as category:** §8 vs §9 *Tarjeta por categoría*. The user chose fijos group + real categories.
- **Free-margin formula:** §9 top and *Presupuestado vs real* say `ingresos − fijos − presupuestos`. §9 *Cabecera* says `ingresos − ahorro − fijos − presupuestos_restantes` and adds "baja con cada carga", but neither formula drops when a variable expense is logged. → Open Questions.
- **§9 worked example:** "37 por semana para los 17 días restantes". On day 10 of 30, 20–21 days remain, not 17 (17 counts from the day the budget runs out). The spec counts today: (400 − 310) ÷ 21 × 7 → **30**.
- **English timing:** §2/§13 put English in phase 3. This change brings it forward.
- **Savings goal:** §9 *Tarjetas de resumen* shows "progreso hacia la meta", but no table stores a goal.

## Goals / Non-Goals

**Goals:**
- Presentational components with no data access, enforced by lint rather than by convention.
- `/demo` as the first consumer of the contract, so the real loader later only has to produce the same object.
- One token system that `components/ui/*` (shadcn names) and the dashboard share.
- `next build`, `eslint` and `tsc` pass on a clean checkout.

**Non-Goals:**
- Real data for `/`: Supabase read functions, web auth (magic link, §4), the RLS session client. That is a separate change, which then mounts `<Dashboard>` on `/` and seeds the locale cookie from `usuarios.idioma`.
- Writing the language choice back to `usuarios.idioma`.
- §9 interactions the component doesn't have: inline amount edit, swipe delete + undo, reorder mode, category/row long-press menus, "Añadir categoría" card, sticky glass top bar, brushed-metal background and its motion, desktop two-column layout, desktop-anchored menus.
- Account-menu rows that need backend work: gastos fijos, modo de confirmación, invitar, photo upload.
- Editable demo (§12 "editar montos… en estado de React"). The contract's `actions` leaves room for it.

## Decisions

### D1 — Components split by atomic design level

Components live in top-level folders per atomic design level, so later screens (login, settings) can reuse the lower levels. `components/ui/` stays as the shadcn primitive layer (D12) that atoms may wrap, and the `app/` routes are the page level.

| Level | File (`components/<level>/`) | Renders | Reused for |
|---|---|---|---|
| atom | `category-dot.tsx` | `var(--cat-<color>)` dot, `aria-hidden` | Category card header, summary rows |
| atom | `money.tsx` | Amount with the D9 money options, tabular figures | Every amount |
| atom | `short-date.tsx` | Short date in the supplied timezone | Expense rows, savings movements |
| atom | `progress-bar.tsx` | Bar filled to `usage`, colour from `level` | Inside `budget-progress` |
| atom | `expand-chevron.tsx` | Up/down chevron, brand ink when open | Category card, summary card |
| atom | `avatar.tsx` | 36px photo or initial | Top bar and menu header |
| molecule | `expense-row.tsx` | Name, short date, amount | Inside `category-card` |
| molecule | `summary-row.tsx` | Dot? · name · detail · amount | Every summary panel row |
| molecule | `add-row.tsx` | `+` action row | Add expense / income / movement |
| molecule | `budget-progress.tsx` | Progress bar + weekly/remaining text | Inside `category-card` |
| molecule | `month-selector.tsx` | Cycle title, chevrons, "en curso" | — |
| molecule | `menu-row.tsx` | 48px icon · label · value row | Account menu rows |
| molecule | `demo-notice.tsx` | "Datos de ejemplo" banner | `/demo` only, through the template's `notice` slot |
| organism | `category-card.tsx` | Dot, name, total/"X de Y", chevron, progress, rows, add row | **Fijos group and every category** |
| organism | `summary-card.tsx` | Collapsible small card + panel slot | Income, expenses, savings |
| organism | `free-margin-card.tsx` | Hero number | — |
| organism | `account-menu.tsx` | Bottom sheet; theme + language controls | — |
| organism | `category-pie-chart.tsx`, `monthly-bars-chart.tsx` | Charts (D11) | — |
| template | `dashboard-template.tsx` | Top bar, layout, composition + UI state (D6); the only `'use client'` entry | `/demo` now, `/` later |
| page | `app/demo/page.tsx` | Supplies `data`, `actions` and `notice` to the template | — |

Rules per level:
- Imports only point down: `ui` < atoms < molecules < organisms < templates. An upward import fails lint (D4).
- Atoms receive all text and accessible names as props and never call `useTranslations`. `money` and `short-date` may call `useFormatter` with `i18n/formats.ts`, so formatting stays in one place. Molecules and above read their own messages.
- The D6 UI state lives only in the template. Lower levels receive open/closed flags and handlers as props.
- One stateful template instead of a stateless template plus a container: there is a single consumer, so the split would only add prop threading.

*Alternatives rejected:* a flat `components/dashboard/` folder, or the atomic levels nested under it. Neither lets another screen reuse the atoms. One file per §9 section with inline sub-parts was also rejected: it keeps the duplication that caused #18 and #19 and doesn't give a single category card.

### D2 — Data contract in `lib/data/dashboard.ts` (types only)

English identifiers, like the rest of the code. `lib/data/*` converts Spanish columns to English fields here, in one place. `CategoryColor` members stay the database check strings because they are stored data.

```ts
type CategoryColor = 'naranja_calido' | 'verde_profundo' | 'azul_apagado' | 'gris_calido'
  | 'violeta_metalico' | 'gris_oscuro' | 'blanco' | 'granate'        // = check in 0004

type DashboardData = {
  user: { name: string; phone: string; photoUrl: string | null; currency: string; timezone: string }
  cycle: { start: string; end: string; month: string /* 'YYYY-MM', month the cycle ends in (§6) */; inProgress: boolean }
  freeMargin: number
  income: { total: number; sources: { id: string; name: string; estimated: number; actual: number }[] }
  savings: { cycle: number; accumulated: number; movements: { id: string; name: string; date: string; amount: number }[] }
  expenses: { total: number; groups: ExpenseGroup[] }        // groups[0] is the fixed group
  history: { month: string; total: number }[]            // oldest → current
}
type ExpenseGroup = {
  id: string; kind: 'fixed' | 'category'; name: string | null /* null for fixed → translated label */
  color: CategoryColor; total: number
  budget: BudgetStatus | null
  expenses: { id: string; name: string; amount: number; date: string }[]
}
type DashboardActions = Partial<{ previousCycle(): void; nextCycle(): void; addExpense(groupId: string): void;
  addIncome(): void; addSavingsMovement(): void; signOut(): void; changeLanguage(l: 'es' | 'en'): Promise<void> }>
```

- `inProgress` is supplied, not computed from `Date.now()` in a component. That avoids server/client clock mismatches and keeps the demo deterministic.
- The fixed group gets `gris_oscuro` (§9: muted greys for fixed expenses). The data producer does the grouping, not the component.

*Alternative rejected:* Spanish identifiers that match the schema read 1:1 against the columns, but they make the data contract hard to read for reviewers who don't know Spanish. The code already switches language at the query strings anyway.

### D3 — Budget maths as a pure function: `lib/data/budget.ts`

`getBudgetStatus({ amount, spent, currentDay, cycleDays })` returns `{ amount, spent, usage, level: 'ok' | 'warning' | 'exceeded', remaining, daysLeft, weeklyAllowance: number | null }`.

- `daysLeft = cycleDays − currentDay + 1` (today counts, since money can still be spent today).
- `remaining = max(0, amount − spent)`. `weeklyAllowance = floor(remaining ÷ daysLeft × 7)` when `daysLeft ≥ 7`, otherwise `null` and the UI shows `remaining` for the remaining days.
- Rounding down is deliberate (§9 *Ingresos esperados*: prefer understating money available).
- Pace (*ritmo*) is **not** computed: the component never showed it, and the day-4 rule belongs to whoever adds it.
- Callers are data producers (the demo builder now; the Supabase loader and the bot later). Components only read the result, which follows §9: calculated once, presented two ways.

### D4 — Lint rules, `eslint.config.mjs` scoped to `components/**`

- `@typescript-eslint/no-restricted-imports` with patterns `@supabase/*`, `@/lib/supabase/*`, `@/lib/data/*` and `allowTypeImports: true`. Components may `import type` the contract but can't call anything that queries.
- Downward-only imports (D1) through the same rule per level: `components/atoms/**` bans `**/molecules/*`, `**/organisms/*` and `**/templates/*`; `components/molecules/**` bans `**/organisms/*` and `**/templates/*`; `components/organisms/**` bans `**/templates/*`. Flat config replaces a rule's options for matching files instead of merging them, so each level block repeats the data-access patterns above.
- `react/jsx-no-literals` with `{ noStrings: true, ignoreProps: true, allowedStrings: ['·', '+', '/'] }` on `components/{atoms,molecules,organisms,templates}/**`, which catches literal JSX text. Task 1.3 first scoped it to `components/dashboard/**`, and task 1.4 moves it. Attribute strings (`aria-label="…"`) aren't covered by this rule, so a grep in the verification tasks catches those.

*Alternative rejected:* code-review convention only. §12 calls this boundary the part that matters, and it's cheap to make mechanical.

### D5 — Missing handler → disabled control

Each control reads its handler from `actions`. If the handler is `undefined`, the control renders `disabled` (visibly dimmed). `/demo` supplies only `changeLanguage`.

### D6 — UI state lives in `dashboard-template.tsx`

- `openIds: Set<string>` (open cards). "Colapsar todo" clears it. Everything starts collapsed (§9).
- `openSummary: 'income' | 'expenses' | 'savings' | null`.
- `accountMenuOpen: boolean`, plus a ref for "Ver todos los gastos" → `scrollIntoView({ behavior: 'smooth' })`.
- Rendering order and filtering (expenses panel sorted by `total` desc; pie skips `total === 0`) are derived with `useMemo` from props, never stored.

### D7 — Theme: tokens defined once with `light-dark()`, `color-scheme` switches

```css
:root { color-scheme: light dark; }            /* automatic = follow OS, live */
:root[data-theme="light"] { color-scheme: light; }
:root[data-theme="dark"]  { color-scheme: dark; }
:root { --background: light-dark(#FAFBFA, #0D100D); /* …every token once… */ }
@theme inline { --color-background: var(--background); /* …maps to Tailwind utilities… */ }
```

- **Automatic** = no `data-theme` attribute. The OS preference applies with zero JS and updates live.
- An inline `<script>` in `app/layout.tsx` `<head>` reads `localStorage.theme` and sets `data-theme` before first paint, following the Next 16 guide *Themes*. `<html suppressHydrationWarning>`.
- A small client component mounted in the layout re-applies the attribute in `useLayoutEffect` after the dev StrictMode remount (guide: *Re-applying attributes in development*). The account-menu control writes `localStorage` and the attribute, or removes both for automatic.
- The glow is a token (`--hero-glow: light-dark(transparent, color-mix(in oklab, #C3E86B 30%, transparent))`), so no `dark:` variant is needed.
- Token names follow shadcn (`background`, `foreground`, `card`, `muted`, `muted-foreground`, `border`, `input`, `ring`, `primary`, `primary-foreground`, `secondary`, `secondary-foreground`, `destructive`) so `components/ui/button.tsx` works. Mango extras: `brand`, `brand-ink`, `warning`, `hero-glow`, and `--cat-<nombre>` (plain vars, used via `style` / SVG `fill`).

*Alternatives rejected:* `next-themes` (a dependency for what the bundled guide does in ~20 lines); a `.dark` class with duplicated light/dark blocks (two places to keep in sync, and automatic needs a JS `matchMedia` listener); storing the theme in a cookie (unnecessary, see guide).

### D8 — Palette values

§ = ARCHITECTURE §9. Values below are confirmed by the task 2.3 contrast pass (WCAG 2.1 formula) against the targets in `specs/theming`: `foreground`, `muted-foreground` and `brand-ink` reach ≥ 4.5:1 on both `card` and `background` in each theme; every `cat-*` reaches ≥ 3:1 on `card`, with one documented exception below.

| Token | Light | Dark |
|---|---|---|
| background | `#FAFBFA` § | `#0D100D` § |
| card | `#FFFFFF` § | `#171A17` § |
| border / input | `#E6E9E6` § | `#262A26` § |
| foreground | `#0D100D` | `#F2F5F2` § |
| muted-foreground | `#5F665F` | `#8A918A` § |
| muted / secondary | `#F0F2F0` | `#1E221E` |
| brand (fills, ring, primary) | `#C3E86B` § | `#C3E86B` § |
| brand-ink (lime as text) | `#4D6A0F` | `#C3E86B` § |
| primary-foreground | `#0D100D` | `#0D100D` |
| warning | `#F0B429` § | `#F0B429` § |
| destructive | `#E5484D` § | `#E5484D` § |
| cat-naranja_calido | `#D4661A` | `#E87924` |
| cat-verde_profundo | `#2F7A4B` | `#3E8E5A` |
| cat-azul_apagado | `#3F7AB8` | `#4C8DCE` |
| cat-gris_calido | `#8A877E` | `#9C9A92` |
| cat-violeta_metalico | `#8446D6` | `#9B5DE5` |
| cat-gris_oscuro | `#3A403B` | `#606861` (raised from `#59605A`, was 2.71:1) |
| cat-blanco | `#C9CEC9` — 1.60:1 on `card`, accepted exception, stays visible via the pie slice separator | `#F2F5F2` |
| cat-granate | `#8C2335` | `#BA3349` (raised from `#9E2B3E`, was 2.40:1) |

Dark category values reuse the v0 hues where one maps to a stored name. Hex values appear **only** in `app/globals.css`.

### D9 — Localization: next-intl without i18n routing

- `i18n/request.ts` reads cookie `locale`, accepts only `es|en` (default `es`) and loads `messages/<locale>.json`. It sets a global `timeZone: 'UTC'` fallback; every date call passes `usuario.timezone` explicitly. `next.config.ts` is wrapped with `createNextIntlPlugin()`.
- `app/layout.tsx`: `<html lang={await getLocale()}>` + `<NextIntlClientProvider>`.
- Switching: a server action `changeLanguage(locale)` in `app/actions/language.ts` validates the value, sets the cookie (`path=/`, 1 year, `SameSite=Lax`), and the client calls `router.refresh()`. Pages pass it through `actions` (D2/D5), following next-intl's no-routing example.
- Messages are namespaced (`dashboard`, `resumen`, `categoria`, `menuCuenta`, `graficos`, `demo`). Composed sentences use ICU: `"{gastado} de {presupuesto}"`, `"Te quedan {monto} por semana"`, `"Te quedan {monto} para {dias, plural, one {el último día} other {los últimos # días}}"`.
- Type safety: `global.d.ts` augments next-intl `AppConfig.Messages` with `typeof es`, so a wrong key fails `tsc`. `messages/parity.ts` asserts `const a: typeof es = en; const b: typeof en = es`, so a missing key in either file fails `tsc`.
- Money: one options object in `i18n/formats.ts`, `{ style: 'currency', trailingZeroDisplay: 'stripIfInteger', useGrouping: 'always' }`, plus `currency: user.currency`. `useGrouping: 'always'` is needed because CLDR `es` drops the separator on 4-digit amounts. Checked on Node 23: `2.400 €`, `62,40 €`, `820 €`, `€2,400`. Chart labels use `notation: 'compact'` (`1,8 mil` / `1.8K`).
- Reading the cookie in the root layout makes every route dynamic (guide: *Storing the theme in a cookie*). That's acceptable at this traffic level, and `/` is unaffected in practice.

*Alternatives rejected:* `app/[locale]/…` routing (changes the `/demo` URL, rejected by the user); client-only locale state (flashes Spanish before English, and breaks `<html lang>` and SSR formatting).

### D10 — Demo data: `lib/demo/demo-data.ts`

- `buildDemoData(locale)` builds a `DashboardData` from **fictional** rows. It must **not** reuse `0012_seed_brian.sql`, which contains the owner's real finances (psychologist, loan), and `/demo` is public and linked from a CV.
- Fixed reference date inside a 30-day cycle, past day 4, deterministic across reloads. At least one budgeted category is in *warning* so all three bar colours can be checked (plus one crafted to be *exceeded*).
- Totals, `expenses.total`, budget states (via D3) and `freeMargin` are **derived from the rows**, never typed in. `freeMargin` uses the §9 *Cabecera* formula until the open question is settled.
- Names come from a `{ es, en }` map in the same file. Only the demo does this; real user data is never translated.

### D11 — Charts with Recharts (client)

- Pie: `PieChart` > `Pie` (inner radius for the centre total) > one `Cell` per non-empty group with `fill` set to `var(--cat-…)`, `stroke` set to `var(--card)` at 2px as the separator, and no `Legend`.
- Bars: `BarChart` from `history`. The current cycle uses `var(--brand)` + the glow token, the rest use `var(--muted)`. X labels are the short month name of `month` in the active locale, and values use compact notation.
- Install `react-is@19` to satisfy Recharts' peer dependency.

### D12 — Make the existing `components/ui/button.tsx` compile

Install `@base-ui/react`, `class-variance-authority`, `clsx`, `tailwind-merge` and add `lib/utils.ts` (`cn`). No shadcn CLI, because it would overwrite `globals.css`. The dashboard does not have to use `Button` in this change.

## Risks / Trade-offs

- [`light-dark()` needs Safari ≥ 17.5 / Chrome ≥ 123 / Firefox ≥ 120 (baseline 2024)] → Accepted for three known users and recruiters on current browsers. There is no fallback, because custom properties can't cascade-fallback.
- [SVG `fill="var(--…)"` as a presentation attribute doesn't resolve in some browser] → Pass colours via `style={{ fill }}` on `Cell`/`Bar` instead; it's a one-line change per chart.
- [Provisional light palette looks wrong or fails contrast] → Task 2.3 checks each token pair and screenshots both themes before any component work depends on the look.
- [`react/jsx-no-literals` flags harmless glyphs] → `allowedStrings` list; icons instead of text glyphs where possible.
- [Dynamic rendering from the locale cookie adds server work on every request] → Negligible at this scale. If it matters later, move the locale read into a client-side script like the theme.
- [Atomic levels add files and prop threading for a single screen] → Accepted: login and settings will reuse the lower levels, and the D4 import bans keep dependencies pointing down.
- [Removing `finance-dashboard.tsx` loses the v0 reference] → It remains in git history once this change is committed. The file is untracked now, so commit it first (task 1.1).

## Migration Plan

Additive: new route `/demo`, new files, `/` untouched, no database migration. Rollback = revert the change's commits.

## Open Questions

- **Free-margin formula.** Decide between §9's two formulas (and what "baja con cada carga" should mean) before the Supabase loader change. The UI only displays `freeMargin`, so this change doesn't depend on the answer.
- **Savings goal.** §9 wants "progreso hacia la meta" but the schema has no goal field. Deferred with the savings panel as-is.
- **Logo asset.** `/mango-logo.svg` is missing. The top bar keeps the slot; drop in the SVG (transparent background, no structural white, §9) when it exists, and render the app name alone until then.
