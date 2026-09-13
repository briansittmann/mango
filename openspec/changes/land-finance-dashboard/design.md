## Context

See proposal.md → *Why*. Current state of the repo:

- `components/finance-dashboard.tsx`: one client component with mock data, an inline hex palette and a `t` object from `@/lib/translations`, which does not exist.
- `components/ui/button.tsx` (from v0) imports `@base-ui/react`, `class-variance-authority` and `@/lib/utils`, none of which exist. Because Next type-checks every `*.tsx`, **`next build` fails today** even though nothing imports these files.
- `app/globals.css` is the create-next-app default (only `--background` and `--foreground`). `app/layout.tsx` hardcodes `lang="en"`. `app/page.tsx` is the create-next-app page.
- Data layer: `lib/datos/*` (Spanish identifiers) uses only `supabaseAdmin()`. There is no web auth and no RLS session client.
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
- Editable demo (§12 "editar montos… en estado de React"). The contract's `acciones` leaves room for it.

## Decisions

### D1 — Component split under `components/dashboard/`

| File | Renders | Reused for |
|---|---|---|
| `dashboard.tsx` | Composition + UI state (D6); the only `'use client'` entry | `/demo` now, `/` later |
| `month-selector.tsx` | Cycle title, chevrons, "en curso" | — |
| `free-margin-card.tsx` | Hero number | — |
| `summary-card.tsx` | Collapsible small card + panel slot | Income, expenses, savings |
| `summary-row.tsx` | Dot? · name · detail · amount | Every summary panel row |
| `category-card.tsx` | Dot, name, total/"X de Y", chevron, progress, rows, add row | **Fijos group and every category** |
| `budget-progress.tsx` | Bar + weekly/remaining text | Inside `category-card` |
| `expense-row.tsx` | Name, short date, amount | Inside `category-card` |
| `add-row.tsx` | `+` action row | Add expense / income / movement |
| `account-avatar.tsx` | 36px photo or initial | Top bar and menu header |
| `account-menu.tsx` | Bottom sheet; theme + language controls | — |
| `category-pie-chart.tsx`, `monthly-bars-chart.tsx` | Charts (D11) | — |
| `demo-notice.tsx` | "Datos de ejemplo" banner | `/demo` only |

*Alternative rejected:* one file per §9 section with inline sub-parts. It keeps the duplication that caused #18 and #19 and doesn't give a single category card.

### D2 — Data contract in `lib/datos/dashboard.ts` (types only)

Spanish identifiers, to match `lib/datos/*`, the schema and the ARCHITECTURE vocabulary. The future Supabase loader then maps columns almost 1:1.

```ts
type ColorCategoria = 'naranja_calido' | 'verde_profundo' | 'azul_apagado' | 'gris_calido'
  | 'violeta_metalico' | 'gris_oscuro' | 'blanco' | 'granate'        // = check in 0004

type DatosDashboard = {
  usuario: { nombre: string; telefono: string; fotoUrl: string | null; moneda: string; timezone: string }
  ciclo: { inicio: string; fin: string; mes: string /* 'YYYY-MM', month the cycle ends in (§6) */; enCurso: boolean }
  margenLibre: number
  ingresos: { total: number; fuentes: { id: string; nombre: string; estimado: number; real: number }[] }
  ahorro: { ciclo: number; acumulado: number; movimientos: { id: string; nombre: string; fecha: string; monto: number }[] }
  gastos: { total: number; grupos: GrupoGasto[] }        // grupos[0] is the fijos group
  historial: { mes: string; total: number }[]            // oldest → current
}
type GrupoGasto = {
  id: string; tipo: 'fijos' | 'categoria'; nombre: string | null /* null for fijos → translated label */
  color: ColorCategoria; total: number
  presupuesto: EstadoPresupuesto | null
  gastos: { id: string; nombre: string; monto: number; fecha: string }[]
}
type Acciones = Partial<{ cicloAnterior(): void; cicloSiguiente(): void; anadirGasto(grupoId: string): void;
  anadirIngreso(): void; anadirMovimientoAhorro(): void; cerrarSesion(): void; cambiarIdioma(l: 'es' | 'en'): Promise<void> }>
```

- `enCurso` is supplied, not computed from `Date.now()` in a component. That avoids server/client clock mismatches and keeps the demo deterministic.
- The fijos group gets `gris_oscuro` (§9: muted greys for fixed expenses). The data producer does the grouping, not the component.

*Alternative rejected:* English identifiers matching the v0 component. That would put a translation layer between the loader and the schema for no gain.

### D3 — Budget maths as a pure function: `lib/datos/presupuesto.ts`

`estadoPresupuesto({ monto, gastado, diaActual, diasCiclo })` returns `{ monto, gastado, consumo, nivel: 'ok' | 'alerta' | 'excedido', restante, diasRestantes, disponibleSemanal: number | null }`.

- `diasRestantes = diasCiclo − diaActual + 1` (today counts, since money can still be spent today).
- `restante = max(0, monto − gastado)`. `disponibleSemanal = floor(restante ÷ diasRestantes × 7)` when `diasRestantes ≥ 7`, otherwise `null` and the UI shows `restante` for the remaining days.
- Rounding down is deliberate (§9 *Ingresos esperados*: prefer understating money available).
- Pace (*ritmo*) is **not** computed: the component never showed it, and the day-4 rule belongs to whoever adds it.
- Callers are data producers (the demo builder now; the Supabase loader and the bot later). Components only read the result, which follows §9: calculated once, presented two ways.

### D4 — Lint rules, `eslint.config.mjs` scoped to `components/**`

- `@typescript-eslint/no-restricted-imports` with patterns `@supabase/*`, `@/lib/supabase/*`, `@/lib/datos/*` and `allowTypeImports: true`. Components may `import type` the contract but can't call anything that queries.
- `react/jsx-no-literals` with `{ noStrings: true, ignoreProps: true, allowedStrings: ['·', '+', '/'] }` on `components/dashboard/**`, which catches literal JSX text. Attribute strings (`aria-label="…"`) aren't covered by this rule, so a grep in the verification tasks catches those.

*Alternative rejected:* code-review convention only. §12 calls this boundary the part that matters, and it's cheap to make mechanical.

### D5 — Missing handler → disabled control

Each control reads its handler from `acciones`. If the handler is `undefined`, the control renders `disabled` (visibly dimmed). `/demo` supplies only `cambiarIdioma`.

### D6 — UI state lives in `dashboard.tsx`

- `abiertos: Set<string>` (open cards). "Colapsar todo" clears it. Everything starts collapsed (§9).
- `resumenAbierto: 'ingresos' | 'gastos' | 'ahorro' | null`.
- `menuCuentaAbierto: boolean`, plus a ref for "Ver todos los gastos" → `scrollIntoView({ behavior: 'smooth' })`.
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

§ = ARCHITECTURE §9. * = provisional, tuned in task 2.3 against the contrast targets in `specs/theming`.

| Token | Light | Dark |
|---|---|---|
| background | `#FAFBFA` § | `#0D100D` § |
| card | `#FFFFFF` § | `#171A17` § |
| border / input | `#E6E9E6` § | `#262A26` § |
| foreground | `#0D100D`* | `#F2F5F2` § |
| muted-foreground | `#5F665F`* | `#8A918A` § |
| muted / secondary | `#F0F2F0`* | `#1E221E`* |
| brand (fills, ring, primary) | `#C3E86B` § | `#C3E86B` § |
| brand-ink (lime as text) | `#4D6A0F`* | `#C3E86B` § |
| primary-foreground | `#0D100D`* | `#0D100D`* |
| warning | `#F0B429` § | `#F0B429` § |
| destructive | `#E5484D` § | `#E5484D` § |
| cat-naranja_calido | `#D4661A`* | `#E87924`* |
| cat-verde_profundo | `#2F7A4B`* | `#3E8E5A`* |
| cat-azul_apagado | `#3F7AB8`* | `#4C8DCE`* |
| cat-gris_calido | `#8A877E`* | `#9C9A92`* |
| cat-violeta_metalico | `#8446D6`* | `#9B5DE5`* |
| cat-gris_oscuro | `#3A403B`* | `#59605A`* |
| cat-blanco | `#C9CEC9`* + slice separator | `#F2F5F2`* |
| cat-granate | `#8C2335`* | `#9E2B3E`* |

Dark category values reuse the v0 hues where one maps to a stored name. Hex values appear **only** in `app/globals.css`.

### D9 — Localization: next-intl without i18n routing

- `i18n/request.ts` reads cookie `locale`, accepts only `es|en` (default `es`) and loads `messages/<locale>.json`. It sets a global `timeZone: 'UTC'` fallback; every date call passes `usuario.timezone` explicitly. `next.config.ts` is wrapped with `createNextIntlPlugin()`.
- `app/layout.tsx`: `<html lang={await getLocale()}>` + `<NextIntlClientProvider>`.
- Switching: a server action `cambiarIdioma(locale)` in `app/acciones/idioma.ts` validates the value, sets the cookie (`path=/`, 1 year, `SameSite=Lax`), and the client calls `router.refresh()`. Pages pass it through `acciones` (D2/D5), following next-intl's no-routing example.
- Messages are namespaced (`dashboard`, `resumen`, `categoria`, `menuCuenta`, `graficos`, `demo`). Composed sentences use ICU: `"{gastado} de {presupuesto}"`, `"Te quedan {monto} por semana"`, `"Te quedan {monto} para {dias, plural, one {el último día} other {los últimos # días}}"`.
- Type safety: `global.d.ts` augments next-intl `AppConfig.Messages` with `typeof es`, so a wrong key fails `tsc`. `messages/paridad.ts` asserts `const a: typeof es = en; const b: typeof en = es`, so a missing key in either file fails `tsc`.
- Money: one options object in `i18n/formatos.ts`, `{ style: 'currency', trailingZeroDisplay: 'stripIfInteger', useGrouping: 'always' }`, plus `currency: usuario.moneda`. `useGrouping: 'always'` is needed because CLDR `es` drops the separator on 4-digit amounts. Checked on Node 23: `2.400 €`, `62,40 €`, `820 €`, `€2,400`. Chart labels use `notation: 'compact'` (`1,8 mil` / `1.8K`).
- Reading the cookie in the root layout makes every route dynamic (guide: *Storing the theme in a cookie*). That's acceptable at this traffic level, and `/` is unaffected in practice.

*Alternatives rejected:* `app/[locale]/…` routing (changes the `/demo` URL, rejected by the user); client-only locale state (flashes Spanish before English, and breaks `<html lang>` and SSR formatting).

### D10 — Demo data: `lib/demo/datos-demo.ts`

- `datosDemo(locale)` builds a `DatosDashboard` from **fictional** rows. It must **not** reuse `0012_seed_brian.sql`, which contains the owner's real finances (psychologist, loan), and `/demo` is public and linked from a CV.
- Fixed reference date inside a 30-day cycle, past day 4, deterministic across reloads. At least one budgeted category is in *alerta* so all three bar colours can be checked (plus one crafted to be *excedido*).
- Totals, `gastos.total`, budget states (via D3) and `margenLibre` are **derived from the rows**, never typed in. `margenLibre` uses the §9 *Cabecera* formula until the open question is settled.
- Names come from a `{ es, en }` map in the same file. Only the demo does this; real user data is never translated.

### D11 — Charts with Recharts (client)

- Pie: `PieChart` > `Pie` (inner radius for the centre total) > one `Cell` per non-empty group with `fill` set to `var(--cat-…)`, `stroke` set to `var(--card)` at 2px as the separator, and no `Legend`.
- Bars: `BarChart` from `historial`. The current cycle uses `var(--brand)` + the glow token, the rest use `var(--muted)`. X labels are the short month name of `mes` in the active locale, and values use compact notation.
- Install `react-is@19` to satisfy Recharts' peer dependency.

### D12 — Make the existing `components/ui/button.tsx` compile

Install `@base-ui/react`, `class-variance-authority`, `clsx`, `tailwind-merge` and add `lib/utils.ts` (`cn`). No shadcn CLI, because it would overwrite `globals.css`. The dashboard does not have to use `Button` in this change.

## Risks / Trade-offs

- [`light-dark()` needs Safari ≥ 17.5 / Chrome ≥ 123 / Firefox ≥ 120 (baseline 2024)] → Accepted for three known users and recruiters on current browsers. There is no fallback, because custom properties can't cascade-fallback.
- [SVG `fill="var(--…)"` as a presentation attribute doesn't resolve in some browser] → Pass colours via `style={{ fill }}` on `Cell`/`Bar` instead; it's a one-line change per chart.
- [Provisional light palette looks wrong or fails contrast] → Task 2.3 checks each token pair and screenshots both themes before any component work depends on the look.
- [`react/jsx-no-literals` flags harmless glyphs] → `allowedStrings` list; icons instead of text glyphs where possible.
- [Dynamic rendering from the locale cookie adds server work on every request] → Negligible at this scale. If it matters later, move the locale read into a client-side script like the theme.
- [Removing `finance-dashboard.tsx` loses the v0 reference] → It remains in git history once this change is committed. The file is untracked now, so commit it first (task 1.1).

## Migration Plan

Additive: new route `/demo`, new files, `/` untouched, no database migration. Rollback = revert the change's commits.

## Open Questions

- **Free-margin formula.** Decide between §9's two formulas (and what "baja con cada carga" should mean) before the Supabase loader change. The UI only displays `margenLibre`, so this change doesn't depend on the answer.
- **Savings goal.** §9 wants "progreso hacia la meta" but the schema has no goal field. Deferred with the savings panel as-is.
- **Logo asset.** `/mango-logo.svg` is missing. The top bar keeps the slot; drop in the SVG (transparent background, no structural white, §9) when it exists, and render the app name alone until then.
