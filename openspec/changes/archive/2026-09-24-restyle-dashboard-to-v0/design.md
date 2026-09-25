## Context

See proposal.md → *Why*. Current state:

- **Reference files** in `referencia/` (read-only):
  - `components-referencia/finance-dashboard-referencia.tsx`: the v0 dashboard, the source of every class below.
  - `components-referencia/ui-referencia/button-referencia.tsx`: identical to `components/ui/button.tsx`.
  - `globals-referencia.css`: v0 tokens and global classes.
  - `components-referencia.json`: shadcn config (`base-nova`, `neutral`, lucide).
  - `referencia-postcss.config.mjs`: identical to `postcss.config.mjs`.
  - Because `tsconfig.json` includes `**/*.tsx`, `npx tsc --noEmit` currently fails with 3 errors in the reference dashboard.
- **`globals-referencia.css`:**
  - Uses a `.dark` class, with light values on `:root`.
  - Has **two** `.dark` blocks. The second one (shadcn's `oklch` neutral defaults) overrides `background`, `card`, `border`, `muted` and others in dark.
  - Maps `--color-muted` to `--muted-tone`, so v0's `text-muted` is `#8A918A` in both themes.
  - Declares no font. The reference includes no `layout.tsx`.
- **Current `app/globals.css`** (land-finance-dashboard D7/D8):
  - Tokens are defined once with `light-dark()`, and `data-theme` switches `color-scheme`.
  - Shadcn token names plus `brand`, `brand-ink`, `warning`, `hero-glow` and `--cat-*`.
  - `body { font-family: Arial }` overrides the Geist variable that `app/layout.tsx` loads.
- **Tailwind v4:** the `dark:` variant defaults to `prefers-color-scheme`, so it ignores an explicit `data-theme`. Only `components/ui/button.tsx` and the create-next-app `app/page.tsx` use `dark:`.
- **Components** (`components/{atoms,molecules,organisms,templates}`): generic classes (`rounded-xl`, `p-3`, `text-sm`, `text-4xl` hero). A sticky header holds the centred month selector and a 36px avatar. Summary panels render inside the one-third-width card. Budget progress shows only when the card is open.
- **Guards still apply** (land-finance-dashboard D4, task 6.1):
  - no hex/rgba/hsl or `white`/`black` utilities in components
  - no literal JSX text
  - no `aria-label="…"` literals
  - no `'use client'` below the template
  - downward-only imports
- **Logos:** `public/mango-logo.svg` is transparent, with an orange body (`#F28424`) and a dark green outline and leaf (`#083C2A`, about 1.5:1 on `#0D100D`). The user will supply `public/mango-logo-dark.svg` for dark theme.
- **Specs:** `openspec/specs/` is empty. The requirements this change modifies are still in the unarchived `land-finance-dashboard` change.

### Where v0 conflicts with the current specs or ARCHITECTURE.md §9

| # | Item | v0 | Spec / §9 | Decision |
|---|---|---|---|---|
| 1 | Budget bar on a collapsed card | Visible | Spec *Expense card states*: collapsed = dot, name, total, chevron | v0 (user). Spec modified |
| 2 | Expanded card border | Category colour | Spec + §9: colour only on dot and slice | v0 (user). Spec modified |
| 3 | Pie legend | Legend beside the donut (first 5 only) | Spec + §9: no legend | Legend with **every** slice, in card order (user). Spec modified |
| 4 | Avatar | 40px, lime border, tint and text, hardcoded `MG` | Spec + §9: 36px, no brand colour | v0 look (user), with the initial still taken from data. Spec modified |
| 5 | Account menu | Glass sheet; text 8–11px; rows 32–40px; e-mail, plan badge, currency and reminders rows | Spec: ≥ 48px rows, ≥ 12px text, no e-mail/plan | Glass look; keep the minimums; no e-mail, plan, currency or reminders rows (no backend). Spec modified |
| 6 | Add row | Dashed rounded box | §9: light `+` row (dashed belongs to "Añadir categoría") | v0 (user) |
| 7 | Month selector | Pill bar | §9: "un título con flechas, no una barra" | v0 (user). Spec wording still holds |
| 8 | Chart order | Bars, then pie | §9: pie first | v0 |
| 9 | Top bar | Logo + name, not sticky | §9: sticky glass bar (already a non-goal) | v0 |
| 10 | Lime text in light | `text-lime` = `#C3E86B` on white, ≈ 1.5:1 | Theming: ≥ 4.5:1 | `brand-ink` (`#4D6A0F`) in light, lime in dark |
| 11 | Muted text in light | `#8A918A`, ≈ 3.3:1 on white | Theming: ≥ 4.5:1 | Keep `#5F665F` in light |
| 12 | Second `.dark` block | Neutral `oklch` overrides the palette | §9 palette, theming spec | Ignored; the first `.dark` block is authoritative |

## Goals / Non-Goals

**Goals:**
- `/demo` in dark theme matches the reference class for class, within the token mapping in D3.
- The light theme uses the reference's light values wherever they pass the contrast requirement.
- The guards and architecture from land-finance-dashboard keep passing unchanged.

**Non-Goals:**
- Anything the reference shows that has no data or backend: currency and reminders menu rows, e-mail, plan badge, the savings goal.
- The reference's inline mock data and its broken `parseInt` sort.
- Sticky/glass top bar on scroll, desktop two-column layout, background motion (still §9 later work).
- Renaming the existing Spanish message keys, and editing ARCHITECTURE.md.
- Creating the dark logo. Adding `tw-animate-css`, `shadcn/tailwind.css` or unused shadcn tokens (`sidebar-*`, `chart-*`, `popover`, `accent`).

## Decisions

### D1 — `referencia/` stays in place, excluded from tooling

Add `"referencia"` to `tsconfig.json` `exclude` and `"referencia/**"` to `globalIgnores` in `eslint.config.mjs`. Nothing imports from it. The implementer reads it; the build never sees it.

*Alternative rejected:* renaming the files to `.txt`. That changes files the user placed there and loses editor syntax highlighting while comparing.

### D2 — Keep the `light-dark()` token system; port values, not structure

The reference's `:root` values become the light side of `light-dark()`, and its **first** `.dark` block becomes the dark side. The second `.dark` block is dropped (conflict #12). The `.dark` class, `@custom-variant dark (&:is(.dark *))` and the duplicated blocks are not ported. D7 of land-finance-dashboard already rejected that shape: two blocks to keep in sync, and automatic needs JS.

Token values after the port (only changed or new tokens; others stay as in land-finance-dashboard D8):

| Token | Light | Dark | Source |
|---|---|---|---|
| foreground | `#171A17` | `#F2F5F2` | ref `--text` (light was `#0D100D`) |
| muted / secondary | `#F1F4F1` | `#202520` | ref first blocks |
| shell-streak | `rgba(20,24,21,.035)` | `rgba(255,255,255,.012)` | ref |
| shell-stop-1…5 | `#F5F6F4` `#ECEFEC` `#E4E8E4` `#EEF0ED` `#E1E5E1` | `#131715` `#0D100E` `#090B0A` `#0E120F` `#080A09` | ref |
| hero-start / hero-end | `#FFFFFF` / `#F7FAF7` | `#1B211C` / `#121712` | ref |
| hero-border | `rgba(139,173,65,.45)` | `rgba(195,232,107,.22)` | ref |
| hero-shadow | `rgba(28,40,25,.08)` | `rgba(0,0,0,.3)` | ref |
| hero-highlight / hero-orb | `transparent` | `rgba(195,232,107,.16)` | ref |
| hero-glow-near / hero-glow-far | `transparent` | `rgba(195,232,107,.36)` / `.14` | ref `--hero-text-shadow` colours |
| hero-glow (existing) | `transparent` | lime 30 % | ref bar `shadow-[…rgba(195,232,107,.3)]` |
| scrim | `#0D100D` at 25 % | `#000` at 35 % | ref `bg-black/35` |
| glass | `#FFFFFF` at 80 % | `#111511` at 85 % | ref `bg-[#111511]/85` |
| radius | `0.625rem` | — | ref, with the `sm…4xl` scale in `@theme inline` |

Literal colours stay confined to `app/globals.css`. `scrim` and `glass` get `@theme inline` entries (`--color-scrim`, `--color-glass`) so components can use `bg-scrim` and `bg-glass`.

### D3 — v0 utility → token mapping

| v0 class | Use instead | Why |
|---|---|---|
| `text-text` | `text-foreground` | Same token |
| `bg-surface`, `bg-surface/90` | `bg-card`, `bg-card/90` | Same values |
| `text-muted` | `text-muted-foreground` | Dark identical; light keeps contrast (#11) |
| `text-lime` | `text-brand-ink` | Dark identical; light readable (#10) |
| `bg-lime`, `bg-lime/10`, `border-lime/40`… | `bg-brand`, `bg-brand/10`, `border-brand/40`… | Same colour |
| `bg-amber`, `bg-red`, `text-red` | `bg-warning`, `bg-destructive`, `text-destructive` | Same colour |
| `border-white/N`, `bg-white/N`, `hover:bg-white/[0.04]` | `border-foreground/N`, `bg-foreground/N`, `hover:bg-foreground/[0.04]` | `foreground` is near-white in dark, so dark is identical, and it becomes a dark alpha in light, which is the per-theme equivalent |
| `bg-black/35` | `bg-scrim` | Scrim stays dark in both themes |
| `bg-[#111511]/85` | `bg-glass` | Token |
| `bg-[#20251F]` (bars) | `var(--muted)` | Ref dark muted `#202520` |
| `shadow-[0_0_18px_rgba(195,232,107,0.3)]` | `drop-shadow` with `var(--hero-glow)` | Token; transparent in light |

Opacity modifiers on tokens (`bg-brand/15`, `bg-foreground/40`) already work in this repo.

### D4 — Effects that aren't colours are built from colour tokens

`light-dark()` only accepts colours. Shadows, gradients and text-shadows are therefore written once in `app/globals.css`, from colour tokens that are `transparent` in light wherever the reference had `none` or `transparent`:

- `body`:
  - `background-color: var(--shell-stop-3)`
  - streaks: `repeating-linear-gradient(108deg, …)`
  - gradient: `linear-gradient(135deg, stop-1 … stop-5)`
  - `background-attachment: fixed`
- `.hero-card`:
  - `border-color: var(--hero-border)`
  - background: gradient from `--hero-start` to `--hero-end`
  - `box-shadow: 0 12px 30px var(--hero-shadow), inset 0 1px 0 var(--hero-highlight)`
  - `::after` orb in `var(--hero-orb)`, blurred
- `.hero-value`: `text-shadow: 0 0 18px var(--hero-glow-near), 0 0 36px var(--hero-glow-far)`

These three stay global classes, as in the reference: a pseudo-element orb can't be expressed as a utility. `.app-shell` (`background: transparent`) is not ported. The base layer is ported too: `* { border-color: var(--border); outline-color: ring at 50 % }`.

### D5 — A theme-aware `dark:` variant for the logo swap

```css
@custom-variant dark {
  &:where([data-theme="dark"], [data-theme="dark"] *) { @slot; }
  @media (prefers-color-scheme: dark) {
    &:where(:root:not([data-theme="light"]), :root:not([data-theme="light"]) *) { @slot; }
  }
}
```

- The header renders both images: `mango-logo.svg` with `dark:hidden`, and `mango-logo-dark.svg` with `hidden dark:block`.
- Pure CSS, so it's right from first paint (the head script already sets `data-theme`) and follows the OS live in automatic mode.
- Colours still come only from tokens. The variant exists for display toggles.
- Side effect: `button.tsx`'s existing `dark:` classes now follow the toggle instead of only the OS. That is the correct behaviour.

*Alternatives rejected:* `<picture>` with `prefers-color-scheme` ignores an explicit light or dark choice. Reading the theme in JS flashes the wrong logo and needs client state in the header.

### D6 — Font: Geist Sans

The reference declares no font, and v0 Next projects load Geist through `layout.tsx`, which this repo already does (`--font-geist-sans` → `--font-sans`). Tailwind's preflight applies `--font-sans` to `html`. Removing the `body { font-family: Arial }` rule is enough. *Assumption:* v0 rendered with Geist. The screenshot check in the tasks confirms the body's computed font.

### D7 — Component mapping (reference function → current file)

All classes come from the reference file, translated through D3.

| Reference | Current file | Classes / structure to apply |
|---|---|---|
| `<main className="app-shell…"><div className="mx-auto … max-w-[480px] px-5 pb-12 pt-7 sm:px-6">` | `templates/dashboard-template.tsx` | Same column. Header not sticky. Spacing between sections: `mt-8` month row, `mt-7` hero, `mt-5` summary, `mt-10` breakdown heading, `mt-4` cards, `mt-8` charts (`gap-5`, **bars then pie**). `{notice}` stays above the column. |
| `<header>` logo + name + avatar button | template | Logos `size-9` (D5), name `text-[22px] font-bold tracking-tight`. Avatar button wraps `Avatar`. |
| Breakdown heading + "Colapsar todo" | template | `h2 text-sm font-semibold tracking-[0.14em] uppercase text-muted-foreground`. Plain `<button>` with `ChevronUp size-4 text-brand-ink` + `text-sm font-medium text-muted-foreground`. Drop the `Button` import. |
| Month pill | `molecules/month-selector.tsx` | Row `flex items-center justify-between gap-4`. Pill `h-12 rounded-full border border-border bg-card px-2`. Chevron buttons `grid size-9 place-items-center rounded-full text-muted-foreground hover:text-foreground`, icons `size-6`. Title `min-w-[158px] text-center text-[18px] font-bold capitalize`. Status outside the pill: `text-[16px] font-semibold tracking-[0.04em] text-muted-foreground`. |
| Hero `section.hero-card` | `organisms/free-margin-card.tsx` | `hero-card rounded-[26px] border p-6`. Label `text-sm font-semibold tracking-[0.14em] uppercase text-muted-foreground`. Badge `rounded-full border border-brand/30 bg-brand/10 px-3 py-1 text-sm font-semibold text-brand-ink`. Number `hero-value mt-5 text-[64px] font-bold leading-none tracking-[-0.06em] text-brand-ink`, currency part `text-[42px]` (D9). Divider `mt-6 h-px bg-border`. Income line `mt-4 text-sm text-muted-foreground` with a `size-1.5 rounded-full bg-brand` dot. New prop `income`. |
| `SummaryCard` | `organisms/summary-card.tsx` | Wrapper `contents`. Card `order-1 rounded-[22px] border bg-card`, `border-brand/60` when open, `border-border hover:border-brand/35` when closed. Button `min-h-[104px] w-full flex-col p-3 text-left`. Label `text-xs font-semibold tracking-[0.12em] uppercase text-muted-foreground` + chevron `size-4`. Value `mt-4 text-[24px] font-bold tabular-nums`, `text-brand-ink` when `accent`. Panel `order-2 col-span-3 rounded-[22px] border border-foreground/10 bg-brand/[0.06] p-3 hover:border-brand/30`. New props `accent?` and `header?: ReactNode`. |
| Income header, savings header | template (panel `header`) | Income: `border-b border-border py-4`, brand dot `size-3`, title `text-[18px] font-bold uppercase`, total `text-[20px] font-bold tabular-nums text-brand-ink`. Savings: two columns, labels `text-sm font-semibold text-muted-foreground`, cycle `text-[24px] font-bold text-brand-ink`, accumulated `text-[24px] font-bold`. |
| `SummaryRow` | `molecules/summary-row.tsx` | Row `flex min-h-12 w-full items-center gap-4 rounded-lg hover:bg-foreground/[0.04]`. Dot `size-3`. Name `text-[16px] text-foreground`. Detail `mt-0.5 text-xs text-muted-foreground`. Amount `min-w-[78px] text-right text-[15px] font-semibold tabular-nums`: `text-brand-ink` when positive tone, `text-destructive` when negative. New prop `tone?: 'positive' \| 'negative'`; the savings panel passes it by sign. |
| "Ver todos los gastos" | template | `flex min-h-12 w-full items-center justify-center gap-2 text-[15px] font-medium text-muted-foreground` + `ChevronDown size-4`. |
| `AddAction` | `molecules/add-row.tsx` | `mt-3 flex min-h-12 w-full items-center justify-center gap-2 rounded-[18px] border border-dashed border-foreground/15 text-[15px] font-medium text-muted-foreground hover:border-brand/35 hover:text-brand-ink`, `Plus size-5`. Keeps `disabled:opacity-50`. |
| `CategoryCard` | `organisms/category-card.tsx` | `overflow-hidden rounded-[24px] border bg-card/90`. Closed: `border-border hover:border-foreground/25`. Open: `style={{ borderColor: var(--cat-…) }}`. Header button `min-h-[72px] px-5 gap-3`. Dot `size-3`. Name `text-[18px] font-semibold`. Amount `font-semibold tabular-nums`, budget as rich text (D10). **Budget block outside the open branch:** `px-5 pb-3`. Open body `px-5 pb-4`, rows `divide-y divide-border/70`. |
| progress in `CategoryCard` | `atoms/progress-bar.tsx`, `molecules/budget-progress.tsx` | Track `h-1.5 rounded-full bg-foreground/10`. Text `mt-2 text-sm text-muted-foreground`. |
| expense row | `molecules/expense-row.tsx` | `flex min-h-12 items-center gap-4 rounded-lg py-2 hover:bg-foreground/[0.04]`. Name `truncate text-[16px]`. Date `mt-0.5 text-sm text-muted-foreground`. Amount chip `min-w-[76px] rounded-lg bg-foreground/[0.035] px-3 py-2 text-right text-[16px] font-semibold tabular-nums`. |
| chevrons | `atoms/expand-chevron.tsx` | `size-5` by default (`className` override `size-4` in summary cards). Open `text-brand-ink`, closed `text-muted-foreground`. Rotation kept. |
| avatar | `atoms/avatar.tsx` | `size` prop `'md'` (40px, header) \| `'sm'` (32px, sheet). `grid place-items-center rounded-full border border-brand/40 bg-brand/10 text-xs font-semibold text-brand-ink`. Photo keeps the same border. |
| `AccountMenu` | `organisms/account-menu.tsx`, `molecules/menu-row.tsx` | D8 |
| `SpendingChart` | `organisms/monthly-bars-chart.tsx` | D11 |
| donut + legend | `organisms/category-pie-chart.tsx` | D11 |

### D8 — Account menu as a floating glass sheet

- **Overlay:** `fixed inset-0 z-40 bg-scrim backdrop-blur-[3px]`, a button with the translated close label.
- **Sheet:** `fixed inset-x-3 bottom-3 z-50 mx-auto max-h-[80vh] max-w-[420px] rounded-[18px] border border-foreground/15 border-t-foreground/30 bg-glass p-3 shadow-2xl backdrop-blur-2xl`.
- **Handle:** `mx-auto mb-3 h-1 w-9 rounded-full bg-foreground/35 md:hidden`.
- **Account block:** `border-b border-foreground/10 pb-3`, `Avatar size="sm"`, name `text-xs font-semibold`, phone `text-xs text-muted-foreground`.
- **Rows:** `min-h-12`, icon `size-4 text-brand-ink`, label `text-xs`. Segmented theme and language controls keep their behaviour, with text `text-xs` and the selected state `bg-brand/15 text-brand-ink`.
- **Log out:** `flex min-h-12 w-full items-center justify-center gap-2 border-t border-foreground/10 text-xs font-semibold text-destructive`.
- **Changes against v0:**
  - Text is raised to 12px and rows to 48px (spec).
  - The `X` button is removed, matching v0; the overlay button still closes the sheet.

### D9 — Hero currency at a smaller size, locale-safe

`atoms/money.tsx` gets an optional `currencyClassName`. When it's set, the atom:
1. Reads `useLocale()`.
2. Formats with `Intl.NumberFormat(locale, { ...currencyFormatOptions, currency }).formatToParts(amount)`.
3. Wraps each `currency` part in a span with that class.
4. Drops the literal space next to it; spacing comes from `ml-2` or `mr-2` depending on the side.

The result is "540 €" in Spanish and "€540" in English, with a smaller €. Without the prop, the atom renders as today.

*Alternative rejected:* a literal `€` span. It breaks other currencies and English order, and trips `jsx-no-literals`.

### D10 — "310 € de 400 €" with a muted second half

The message value changes from `"{gastado} de {presupuesto}"` to `"{gastado} <muted>de {presupuesto}</muted>"` (and the English equivalent). The card uses `t.rich(…, { muted: (chunks) => <span className="font-normal text-muted-foreground">{chunks}</span> })`. The key and its type are unchanged, so parity still holds.

### D11 — Charts reproduce the reference layout in Recharts

**Bars:**
- Card `rounded-[24px] border border-border bg-card p-5`.
- Title row: `graficos.lastMonths` (`font-semibold`) and `graficos.monthlySpend` (`text-xs font-semibold tracking-[0.08em] uppercase text-muted-foreground`).
- Plot inside `mt-5 h-40 rounded-[20px] bg-background/80 px-4 pb-3 pt-5`.
- No `YAxis`. A `LabelList` above each bar shows the compact figure (`text-xs`); the current cycle's label is `font-semibold` in brand ink.
- X labels are short months at 14px, the current one semibold in brand ink.
- `maxBarSize={32}`, `radius={[8, 8, 0, 0]}`.
- Current bar fill `var(--brand)` with `style={{ filter: 'drop-shadow(0 0 9px var(--hero-glow))' }}`; the others `var(--muted)`.

**Pie:**
- Card `rounded-[24px] border border-border bg-card p-5`, with a title row showing `graficos.distribution` and the total in bold.
- Body `mt-5 flex items-center gap-5`.
- Donut `size-28` with `innerRadius="71%"` (80px hole), centre label "Total" `text-[10px] text-muted-foreground` and the amount `text-sm font-bold`.
- Separator stroke `var(--card)` 2px, kept for §9.
- Legend `flex flex-1 flex-col gap-2 text-sm`: one row per non-empty group in card order, with `CategoryDot size-2.5`, name `truncate text-muted-foreground` and `Money font-bold`.

### D12 — New message keys, in English

The user asked for English identifiers. New keys are English camelCase inside the existing namespaces. The existing Spanish keys are not renamed: translate-code-to-english deliberately left `messages/*.json` untouched, so renaming them belongs in its own change. The reference's translation file never existed, so the wording below is ours. Labels that v0 shows in capitals get the `uppercase` class; the messages stay in sentence case.

| Key | es | en |
|---|---|---|
| `dashboard.appName` | Mango | Mango |
| `dashboard.available` | disponible | available |
| `dashboard.freeMarginIncome` | De {income} de ingresos | Out of {income} income |
| `dashboard.expenseBreakdown` | Desglose de gastos | Expense breakdown |
| `resumen.incomeSources` | Fuentes de ingreso | Income sources |
| `resumen.cycleSavings` | Ahorro del ciclo | Cycle savings |
| `graficos.lastMonths` | Últimos meses | Last months |
| `graficos.monthlySpend` | Gasto mensual | Monthly spend |
| `graficos.distribution` | Distribución | Distribution |

### D13 — Logo as `<img>`

Plain `<img>` with `alt=""` and `aria-hidden`, plus the same `eslint-disable-next-line @next/next/no-img-element` used in `atoms/avatar.tsx`. The files are static SVGs with nothing to optimise, and the reference used `<img>` too. The template owns the header, so the images live there.

## Risks / Trade-offs

- **`display: contents` on the summary-card wrapper can drop the semantics of a sectioning element** → Use a plain `div` as the wrapper. The button inside keeps its role and state.
- **`backdrop-filter` unsupported or slow** → `glass` is 80–85 % opaque, so the sheet stays legible without blur.
- **The `drop-shadow` filter on a Recharts `Cell` doesn't render in some browser** → The glow is decorative. Verify in Chromium and accept its absence elsewhere.
- **`bg-card/90` over the brushed background lowers text contrast** → The contrast task composites 90 % card over the lightest and darkest shell stops.
- **Deltas target requirements that aren't in `openspec/specs/` yet** → Archive `land-finance-dashboard` before archiving this change (final task).
- **The dark logo file isn't there when the header task starts** → The task stops and asks the user. It doesn't ship a broken image or edit the SVG.
- **Fidelity judged only by eye drifts** → The spec pins computed values, and the tasks check them in the browser.
- **The custom `dark` variant changes `button.tsx` styling under an explicit theme** → Intended. Only `button.tsx` and the unused `app/page.tsx` use `dark:`.

## Migration Plan

Visual-only change to existing files, plus one new asset supplied by the user. No data or route changes. Rollback = revert the change's commits.

## Open Questions

- **ARCHITECTURE.md §9** still describes the choices this change reverses (conflicts #1–#9). Updating the document can happen after implementation without affecting the specs or tasks.
