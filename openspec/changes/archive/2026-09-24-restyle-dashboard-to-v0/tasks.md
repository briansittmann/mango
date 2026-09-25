## 1. Groundwork

- [x] 1.1 Exclude the reference folder from tooling (design D1). Add `"referencia"` to `exclude` in `tsconfig.json` and `"referencia/**"` to `globalIgnores` in `eslint.config.mjs`. Verify: `npx tsc --noEmit` exits 0, `npm run lint` passes, and `git status --short referencia` prints nothing.
- [x] 1.2 Take "before" screenshots of `/demo` with the browser-automation skill, at a 390px viewport, in Spanish × light/dark, with every card collapsed and then with "comida" and the income panel open. Save them to the scratchpad. Verify: 4 PNG files exist and the console shows no errors.

## 2. Tokens and global CSS

- [x] 2.1 In `app/globals.css`, apply the D2 table. Update `foreground` and `muted`/`secondary`. Add `shell-streak`, `shell-stop-1…5`, the `hero-*` tokens, `hero-glow-near`/`hero-glow-far`, `scrim` and `glass`, all inside `light-dark()`. Add `--radius` with the `sm…4xl` scale plus `--color-scrim` and `--color-glass` to `@theme inline`. Port the base-layer border and outline rule (D4). Verify:
  - `npm run build` succeeds.
  - `grep -rnE "#[0-9A-Fa-f]{6}" app components lib` matches only `app/globals.css`.
  - In the browser with `data-theme="dark"`, `getComputedStyle(document.documentElement).getPropertyValue('--card')` resolves to `#171A17`, and with `data-theme="light"` `--foreground` resolves to `#171A17`.
- [x] 2.2 In `app/globals.css`, add the D4 `body` shell background, `.hero-card`, `.hero-card::after` and `.hero-value`, and the D5 `@custom-variant dark`. Remove the `font-family: Arial` rule. Verify on `/demo`:
  - `getComputedStyle(document.body).fontFamily` starts with `Geist`.
  - `backgroundImage` contains `linear-gradient` and `backgroundAttachment` is `fixed`.
  - Switching `data-theme` between `light` and `dark` in devtools changes the body background without a reload.
  - A devtools-injected `<span class="hidden dark:block">` is visible with `data-theme="dark"` on a light-emulated OS, hidden with `data-theme="light"` on a dark-emulated OS, and follows the emulated OS live with no attribute set. Remove the span afterwards.
- [x] 2.3 Contrast pass. Extend the land-finance-dashboard 2.3 scratchpad script to check `foreground`, `muted-foreground` and `brand-ink` in both themes (≥ 4.5:1) against:
  - `card`
  - `background`
  - `card` at 90 % composited over `shell-stop-1` and over `shell-stop-5`
  - `shell-stop-1…5` directly (section headings and "en curso" sit on the page)
  - `glass` composited over `background`

  If a value fails, adjust it in `app/globals.css` and update the D2 table in `design.md`. Verify: the script's output table shows every pair passing.

- [x] 2.4 Stitch tokens. `DESIGN.md` (Stitch) now overrides the v0 values from design D2/D4 and tasks 2.1–2.3 wherever they differ. In `app/globals.css`:
  - Dark side of `light-dark()`:
    - `background` `#0D110E`, `card` `#131814`, `muted`/`secondary` `#19201A`, `border`/`input` `#232B24`.
    - `foreground` `#F3F4F6`, `muted-foreground` `#9CA3AF`.
    - `brand`/`brand-ink`/`primary`/`ring` `#84CC16`, `destructive` `#EF4444`.
  - Light side:
    - `background` `#F4F7F4`, `card` `#FFFFFF`, `muted`/`secondary` `#E8EFE8`.
    - `brand`/`primary`/`ring` `#65A30D`, `destructive` `#B91C1C`.
    - Keep `foreground` `#171A17`, `muted-foreground` `#5F665F`, `border`/`input` `#E6E9E6` and `brand-ink` `#4D6A0F`. Stitch's light accents `#65A30D`, `#16A34A` and `#EF4444` measure 3.09, 3.30 and 3.76:1 on white, so they are used only as fills.
  - `primary-foreground` `#0D110E` in both themes.
  - New tokens (light / dark), with `--color-positive` and `--color-handle` added to `@theme inline`:
    - `positive` `#15803D` / `#4ADE80`
    - `handle` `#D1D5DB` / `#374151`
    - `sheet-shadow` `rgba(13,17,14,.12)` / `rgba(0,0,0,.4)`
    - `raised-highlight` `transparent` / `rgba(255,255,255,.05)`
  - `scrim` becomes `rgba(13,17,14,.4)` / `rgba(0,0,0,.65)`.
  - Remove `glass` and `--color-glass`.
  - Recolour `hero-glow`, `hero-border`, `hero-highlight`, `hero-orb` and `hero-glow-near`/`hero-glow-far` from `#C3E86B` (195, 232, 107) to `#84CC16` (132, 204, 22), keeping their alphas. The light `hero-border` becomes `#65A30D` at 45 %.
  - Keep the shell stops, the `body` brushed background, `.hero-card` and `.hero-value`.
  - Add `--radius-card: 1.25rem`, `--radius-inner: 1rem` and `--radius-sheet: 1.75rem` to `@theme inline`.

  Verify:
  - `npm run build` succeeds.
  - `grep -rnE "#[0-9A-Fa-f]{6}" app components lib` still matches only `app/globals.css`, and `grep -rn "glass" app components` prints nothing.
  - On `/demo`, `--card` resolves to `#131814` with `data-theme="dark"` and `--background` to `#F4F7F4` with `data-theme="light"`.
  - A devtools-injected `<div class="rounded-card">` computes `border-radius: 20px`.
- [x] 2.5 Fonts and type scale:
  - In `app/layout.tsx`, replace `Geist` with `Inter` (`--font-inter`) and add `Manrope` (`--font-manrope`) from `next/font/google`. Leave `Geist_Mono`.
  - In `@theme inline`, set `--font-sans: var(--font-inter)` and add `--font-display: var(--font-manrope)`.
  - Add the `DESIGN.md` type scale as `--text-<name>` with `--line-height`, `--letter-spacing` and `--font-weight` sub-values for `display`, `display-mobile`, `headline-lg`, `headline-md`, `headline-sm`, `body-lg`, `body-md`, `body-sm`, `tabular-numeric-lg`, `tabular-numeric-md`, `label-caps` and `label-ui`.
  - Add `font-variant-numeric: tabular-nums` to `body`.

  Verify on `/demo`:
  - `getComputedStyle(document.body).fontFamily` contains `Inter`, and `fontVariantNumeric` is `tabular-nums`.
  - A devtools-injected `<span class="font-display text-headline-sm">` computes a family containing `Manrope`, `18px`, weight `600` and line-height `24px`.
  - A `<span class="text-label-caps">` computes `11px`, weight `600` and letter-spacing `0.66px`. Remove both spans afterwards.
  - `npx tsc --noEmit`, `npm run lint` and `npm run build` pass.
- [x] 2.6 Contrast pass on the Stitch values. Re-run the 2.3 script in both themes (≥ 4.5:1) with these pairs:
  - `foreground`, `muted-foreground` and `brand-ink` against `card`, `muted`, `background` and `shell-stop-1…5`
  - `positive` and `destructive` against `card` and `background`
  - `primary-foreground` against `primary`

  Drop the `glass` pair and the `card` at 90 % pairs, since cards are now solid. If a value fails, adjust it in `app/globals.css` and report the replacement. Verify: the script's output table shows every pair passing.

## 3. Messages

- [x] 3.1 Add the D12 keys to `messages/es.json` and `messages/en.json`. Change `categoria.gastadoDePresupuesto` to the D10 rich-text value in both files. Verify: `npx tsc --noEmit` passes (`messages/parity.ts`), and `grep -c "appName\|available\|freeMarginIncome\|expenseBreakdown\|incomeSources\|cycleSavings\|lastMonths\|monthlySpend\|distribution" messages/es.json messages/en.json` prints `9` for each file.

## 4. Atoms and molecules

- [x] 4.1 Restyle the atoms per design D7: `avatar.tsx` (with the `size` prop), `category-dot.tsx`, `expand-chevron.tsx` and `progress-bar.tsx`. Add `currencyClassName` to `money.tsx` (D9). Verify:
  - `npx tsc --noEmit` and `npm run lint` pass.
  - On `/demo`, the header avatar's computed width is `40px` and it shows the user's initial.
  - An open chevron's computed colour equals `--brand-ink`.
- [x] 4.2 Restyle the molecules with the `DESIGN.md` values (they override D7 where they differ):
  - `add-row.tsx`: `mt-3 flex min-h-12 w-full items-center justify-center gap-2 rounded-inner border border-dashed border-foreground/15 text-label-ui text-muted-foreground hover:border-brand/35 hover:text-brand-ink`, `Plus size-5`. Keep `disabled:opacity-50`.
  - `expense-row.tsx`: list row `relative flex min-h-12 items-center gap-3 px-4 py-3 hover:bg-foreground/[0.04]`, with a 1px `--border` divider inset `16px` from the left and hidden on the first row. Name `truncate text-body-lg text-foreground`, date `text-body-sm text-muted-foreground`, amount pill `rounded-full bg-muted px-3 py-1 text-tabular-numeric-md`.
  - `summary-row.tsx`: same row and divider. Leading `grid size-8 place-items-center rounded-full bg-muted` holding the category dot. Name `text-body-lg`, detail `text-body-sm text-muted-foreground`. Amount `text-tabular-numeric-md`, `text-positive` for `tone="positive"` and `text-destructive` for `tone="negative"`.
  - `budget-progress.tsx`: text `mt-2 text-body-md text-muted-foreground`.
  - `month-selector.tsx`: pill `flex h-12 items-center rounded-full border border-border bg-card px-0.5`. Chevron buttons `grid size-11 place-items-center rounded-full text-muted-foreground hover:text-foreground`. Title `min-w-[158px] text-center font-display text-headline-sm capitalize`. "en curso" outside the pill as `rounded-full bg-brand/10 px-2.5 py-1 text-label-caps uppercase text-brand-ink`.
  - `menu-row.tsx`: `flex min-h-12 w-full items-center gap-3 px-4 py-3`, label `flex-1 text-left text-body-md text-foreground`, same inset divider.

  Verify on `/demo` (390px, dark):
  - An open card's add row has `border-style: dashed` and `border-radius: 16px`.
  - Expense rows are ≥ `48px` tall; amounts compute to `15px`, weight `500`, `tabular-nums`; the divider above the second row is inset `16px` from the row's left edge.
  - Summary-row circles are `32px` with `background-color` equal to `--muted`.
  - The month pill is `48px` tall and fully rounded, each chevron button is `44px` and still disabled, and "en curso" sits outside the pill.

## 5. Organisms and template

- [x] 5.1 Restyle `organisms/category-card.tsx` (D10 behaviour, `DESIGN.md` geometry):
  - Card `overflow-hidden rounded-card border bg-card` (solid, no `/90`). Closed `border-border hover:border-foreground/25`; open: category-colour border.
  - Header button `flex min-h-[72px] w-full items-center gap-3 px-4`: leading `grid size-8 place-items-center rounded-full bg-muted` with the dot, name `font-display text-headline-sm`, amount `text-tabular-numeric-md` with the D10 rich-text budget.
  - Budget block outside the open branch, `px-4 pb-3`. Open body: rows edge to edge (they carry their own padding), then the add row inside `px-4 pb-4`.

  Verify on `/demo`:
  - Collapsed "comida" shows "310 € de 400 €" with the second half muted, the bar, the weekly text, and no expense rows.
  - A category without a budget shows only the circle with its dot, name, total and chevron.
  - Expanded "comida" has a computed `border-color` equal to its dot's `background-color`; collapsed cards use `--border`.
  - Header height ≥ `72px`, radius `20px`, name `18px` in Manrope, and the card's `background-color` equals `--card` with no transparency.
  - Two cards open at once, and "Colapsar todo" closes both.
- [x] 5.2 Restyle `organisms/summary-card.tsx` with the `contents` / `order` / `col-span-3` layout and the `accent` and `header` props (D7), using `DESIGN.md` surfaces:
  - Card `order-1 rounded-card border bg-card`. Open (Level 2): `border-brand/60 bg-muted shadow-[inset_0_1px_0_0_var(--raised-highlight)]`. Closed: `border-border hover:border-brand/35`.
  - Button `min-h-[104px] w-full flex-col p-3 text-left`. Label `text-label-caps uppercase text-muted-foreground` + chevron `size-4`. Value `mt-4 text-tabular-numeric-lg`, `text-brand-ink` when `accent`.
  - Panel `order-2 col-span-3 rounded-card border border-border bg-card py-1`, with no lime tint.
  - Template panels:
    - Income: header `border-b border-border px-4 py-4` with a brand dot `size-3`, title `font-display text-headline-sm` and total `text-tabular-numeric-lg text-brand-ink`.
    - Expenses: rows plus "Ver todos los gastos" as `flex min-h-12 w-full items-center justify-center gap-2 text-label-ui text-muted-foreground` + `ChevronDown size-4`.
    - Savings: two-column header (labels `text-label-caps uppercase text-muted-foreground`, cycle `text-tabular-numeric-lg text-brand-ink`, accumulated `text-tabular-numeric-lg`) plus movements with `tone`.

  Verify:
  - The open panel's width equals the width of the three-card grid.
  - Opening savings closes income.
  - The expenses panel is sorted by total descending, and "Ver todos los gastos" scrolls to the cards.
  - Card radius `20px`, height ≥ `104px`, label `11px` uppercase, value `24px`.
  - The open card's `background-color` equals `--muted`, and the panel's equals `--card`.
  - The savings value uses `--brand-ink`; deposits use `--positive` and withdrawals `--destructive`.
- [x] 5.3 Restyle `organisms/free-margin-card.tsx` (D9 mechanism) with `hero-card rounded-card border p-6`:
  - Label `text-label-caps uppercase text-muted-foreground`.
  - Badge `rounded-full border border-brand/30 bg-brand/10 px-2.5 py-1 text-label-caps uppercase text-brand-ink`.
  - Number `hero-value mt-5 font-display text-display-mobile sm:text-display text-brand-ink`, with the currency part at `text-headline-md` through `currencyClassName`.
  - Divider `mt-5 h-px bg-border`.
  - Income line `mt-4 text-body-md text-muted-foreground` with a `size-1.5 rounded-full bg-brand` dot. New `income` prop, passed by the template.

  Verify:
  - The number computes to `32px` in Manrope at 390px and `40px` at 1024px, and is the largest text on the page at both widths.
  - The `€` part computes to `22px` in Spanish ("540 €") and English ("€540").
  - In light theme, `.hero-value` `text-shadow` has only transparent colours and the `::after` background is transparent. In dark, both resolve to `rgba(132, 204, 22, …)`.
  - The line shows "2.400 €" in Spanish, and the card radius is `20px`.
- [x] 5.4 Rebuild `organisms/account-menu.tsx` as the `DESIGN.md` bottom sheet (this replaces D8):
  - Overlay: `fixed inset-0 z-40 bg-scrim backdrop-blur-[12px]`, a button labelled `t('cerrarMenu')`.
  - Sheet: `fixed inset-x-0 bottom-0 z-50 mx-auto max-h-[85vh] max-w-[640px] overflow-y-auto rounded-t-sheet border border-b-0 border-border bg-card pb-[env(safe-area-inset-bottom)] shadow-[0_-12px_32px_var(--sheet-shadow)]`, with `role="dialog"` and `aria-modal`, labelled by the title.
  - Handle: `mx-auto mt-2.5 h-1 w-9 rounded-full bg-handle`, `aria-hidden`.
  - Sticky header `sticky top-0 flex items-center justify-between bg-card px-4 py-2`: title `t('menuDeCuenta')` in `font-display text-headline-sm`, and an `X` button `grid size-11 place-items-center rounded-full text-muted-foreground hover:bg-muted` labelled `t('cerrarMenu')`.
  - Account block `flex items-center gap-3 px-4 py-3`: `Avatar size="sm"`, name `text-body-md font-semibold`, phone `text-body-sm text-muted-foreground`.
  - Theme and language rows: `MenuRow` with `size-4 text-brand-ink` icons and a segmented control. Track `flex rounded-full bg-muted p-0.5`; options `grid min-h-11 min-w-11 place-items-center rounded-full px-3 text-label-ui`; selected `bg-primary text-primary-foreground`, others `text-muted-foreground`. Behaviour unchanged.
  - Log out: `flex min-h-12 w-full items-center justify-center gap-2 border-t border-border text-body-md font-semibold text-destructive hover:bg-destructive/[0.08]`.

  Verify at 390px:
  - The sheet's bounding box has `left` 0, `right` 390 and `bottom` equal to `window.innerHeight`. Its top corner radii are `28px`, its bottom radii `0px`, and its `background-color` equals `--card`.
  - The overlay's `backdrop-filter` is `blur(12px)` and its background equals `--scrim`.
  - The handle is `36px × 4px`, and its top edge is `10px` below the sheet's top edge.
  - The title reads "Menú de cuenta" at `18px` in Manrope. The `X` button is ≥ `44px` and closes the sheet; clicking the overlay also closes it.
  - No text computes below `12px`, every row is ≥ `48px`, and every button inside the sheet is ≥ `44px` tall.
  - The selected theme option's background equals `--primary`. The log-out text equals `--destructive` and has a full-width top border.
  - No e-mail or plan badge.
  - Choosing English still switches the language and keeps `/demo`; choosing light still survives a reload on a dark-emulated OS.
- [x] 5.5 Restyle `organisms/monthly-bars-chart.tsx` and `organisms/category-pie-chart.tsx` with the D11 structure and `DESIGN.md` geometry:
  - Both cards: `rounded-card border border-border bg-card p-5`, titles in `font-display text-headline-sm`.
  - Bars: `graficos.monthlySpend` as `text-label-caps uppercase text-muted-foreground`. Plot inside `mt-5 h-40 rounded-inner bg-background px-4 pb-3 pt-5`. Value labels `12px`, X labels `14px`, the current cycle's semibold in `--brand-ink`. Current bar `var(--brand)` with the `--hero-glow` drop-shadow; other bars `var(--muted-foreground)` at `fillOpacity={0.25}`. `maxBarSize={32}`, `radius={[8, 8, 0, 0]}`.
  - Pie: body `mt-5 flex items-center gap-5`, donut `size-28` with `innerRadius="71%"`. Centre "Total" in `text-body-sm text-muted-foreground` and the amount in `text-tabular-numeric-md font-semibold`. Separator stroke `var(--card)` 2px. Legend `flex flex-1 flex-col gap-2 text-body-md` with `CategoryDot size-2.5`, name `truncate text-muted-foreground` and `Money` in `text-tabular-numeric-md`.

  Verify:
  - The bars chart has no Y-axis ticks and shows one value label per history entry.
  - The current bar's fill resolves to `--brand`, with a visible glow in dark and none in light. The other bars are visibly distinct from the plot background in both themes (screenshot).
  - The pie legend has as many entries as slices, in card order, with dot colours matching the slices.
  - The slice separator is still visible.
  - Compact labels read `1,8 mil` in Spanish and `1.8K` in English.
  - Both chart cards have a `20px` radius, and no chart text computes below `12px`.
- [x] 5.6 Recompose `templates/dashboard-template.tsx` with the D7/D13 structure and the `DESIGN.md` layout. **First check that `public/mango-logo-dark.svg` exists; if it doesn't, stop and ask the user to add it.**
  - Column `mx-auto w-full max-w-[640px] px-4 pb-12 pt-6 sm:px-5`.
  - Logo top bar, not sticky: logos `size-9`, app name `font-display text-headline-md`, avatar button `grid size-11 place-items-center rounded-full`.
  - Section spacing: `mt-8` month row, `mt-6` hero, `mt-4` summary, `mt-10` breakdown heading, `mt-4` cards, `mt-8` charts (`gap-4`, bars before pie).
  - Breakdown heading `text-label-caps uppercase text-muted-foreground`. "Colapsar todo" as a ghost pill `inline-flex h-11 items-center gap-2 rounded-full border border-border bg-card px-4 text-label-ui text-foreground` with `ChevronUp size-4 text-brand-ink`.
  - Remove the `Button` import.

  Verify at 390px:
  - With `data-theme="dark"`, only the dark logo is displayed (`getComputedStyle(img).display`); with `light`, only the light one; in automatic, the logo follows the emulated OS live.
  - Both logos have `alt=""`.
  - The header scrolls away with the page.
  - The column's computed `max-width` is `640px`, and its `padding-left` is `16px` at 390px and `20px` at 1024px.
  - The avatar button and "Colapsar todo" are ≥ `44px` tall, and the app name is `22px` in Manrope.

## 6. Verification

> **Closed without 6.1–6.3 (2026-09-24).** Superseded by the changes archived after it: `refine-mobile-ui-apple-hig` and the `design-system` spec replaced the v0 look (Inter/Manrope instead of Geist Sans, a 640px column instead of 480px, a new hierarchy, type and material rules), so its final checks would test a design the product no longer has. Archived without syncing its deltas: "Dashboard follows the v0 visual reference" and the MODIFIED `dashboard-ui` / `theming` texts would overwrite the current specs with the old ones.

- [ ] 6.1 Walk through every behavioural scenario in this change's `specs/` on `/demo` in es/en × light/dark, and save "after" screenshots next to the 1.2 ones for the same states. For visual values, check the `DESIGN.md` values from tasks 2.4–5.6. Where they conflict with *Dashboard follows the v0 visual reference* or *Floating glass sheet* (Geist, 480px column, 22/24/26px radii, 64px hero, inset glass sheet), the tasks win. Verify: every check passes, no console errors or hydration warnings appear, and each state has a before/after pair.
- [ ] 6.2 Guards. Run the land-finance-dashboard 6.1 greps unchanged, plus:
  - `grep -rn "Arial" app`
  - `grep -rn "referencia" app components lib i18n messages`
  - `grep -rn "glass\|font-geist-sans" app components`
  - `grep -rnE "text-\[[0-9]+px\]" components` (sizes come from the `DESIGN.md` scale)

  Verify: all of them print nothing and `npm run lint` passes.
- [ ] 6.3 Final gate. Run `npx tsc --noEmit`, `npm run lint`, `npm run build` and `openspec validate restyle-dashboard-to-v0`. Then check that `openspec/specs/dashboard-ui/spec.md` and `openspec/specs/theming/spec.md` exist. Verify: all four commands pass. If the spec files are missing, tell the user to archive `land-finance-dashboard` before archiving this change.
