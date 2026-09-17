## 1. Baseline

- [x] 1.1 Record the "before" state with a scratchpad Playwright script on `/demo` at 390 × 844, both themes, Spanish: the card list collapsed, the "Gastos fijos" card open, and the "comida" card open. Verify and write the figures into this line as the baseline every later task compares against:
  - six PNGs exist in the scratchpad
  - free margin **974 €**, expenses total **1.700 €**, ingresos 2.820 €, ahorro 146 €
  - the fixed card totals 900 € over Alquiler 820, Internet 45, Seguro 35
  - the six category cards read: comida 310/400, ocio 130/150, transporte 130/100, salud 40/120, hogar 95/200, compras 95/180
  - the pie centre reads 1.700 € and its legend has seven entries

  **Baseline:** confirmed via headless Playwright on `/demo`, both themes — margen libre 974 €, ingresos 2.820 €, gastos 1.700 €, ahorro 146 €; Gastos fijos 900 € (Alquiler 820, Internet 45, Seguro 35); comida 310/400, ocio 130/150, transporte 130/100, salud 40/120, hogar 95/200, compras 95/180; pie total 1.700 € with 7 legend entries (Gastos fijos 53%, Comida 18%, Ocio 8%, Transporte 8%, Salud 2%, Hogar 6%, Compras 6%). Six PNGs captured in scratchpad.

## 2. Contract

- [x] 2.1 In `lib/data/dashboard.ts`, add `fixed?: { day: number; charged: boolean }` to `Expense` and narrow `ExpenseGroup` to `kind: 'category'` with a non-nullable `name` (D1). Doc-comment `fixed` as the row's `gastos_fijos.dia_del_mes` and `transacciones.estado` (§7), present only on a charge generated from a recurring definition.

  Verify: `npx tsc --noEmit` now fails only in `lib/demo/demo-data.ts:89-90` (`kind: 'fixed'` and `name: null` on the fixed group literal). The four `?? t('gastosFijos')` fallback reads (`category-card.tsx:42`, `dashboard-template.tsx:152,322`, `category-pie-chart.tsx:52`) do not error — `??` on a now-non-nullable `string` is legal TS, just dead code — so they're cleaned up in task 6.1 instead.
- [x] 2.2 Create `lib/data/upcoming-charges.ts` with `UpcomingCharge` and the pure `selectUpcomingCharges(groups)` (D2): keep rows carrying `fixed`, attach each row's group colour, sort taken first then by `day` ascending. No React, no formatting, no total.

  Verify: `npx tsc --noEmit` passes for this file (only the known `demo-data.ts` errors remain) and `grep -n "use client\|react\|Intl" lib/data/upcoming-charges.ts` returns nothing.
- [x] 2.3 Verify the selector with a scratchpad `npx tsx` script asserting exactly: six charges from the sample; ids in the order Alquiler, Internet, Seguro, Parking, Limpieza, Gimnasio; the first three `charged: true` and the last three `false`; every colour equal to its group's colour; the sum of amounts 1025; and that a group with no `fixed` rows contributes nothing. Add a case where a pending charge has a lower day than a taken one (pending día 2, taken día 20) and assert the taken one still sorts first.

  Verify: all 8 assertions passed (`ALL PASS`), including the taken-before-lower-day-pending edge case.

## 3. Demo data

- [x] 3.1 In `lib/demo/demo-data.ts`, replace the `fixed` group with a `vivienda` category (D7): same id position (first), `gris_oscuro`, no budget, the same three rows and the same 900 € total, plus a `NAMES.vivienda` entry (`Vivienda` / `Housing`). Set each row's date to its charge day and add its `fixed` property: Alquiler día 1 charged, Internet día 3 charged, Seguro día 8 charged.

  Verify: `/demo` renders seven category cards with no "Gastos fijos" card, the free margin reads 974 € and the expenses total 1.700 €. Confirmed via headless render.
- [x] 3.2 Mark the three pending charges on rows that already exist, changing no amount: Parking (transporte) día 15, Limpieza (hogar) día 20, and Farmacia renamed to Gimnasio (salud, `NAMES.gimnasio` = `Gimnasio` / `Gym`) día 22. Set each row's date to its day.

  Verify: transporte still totals 130 €, hogar 95 €, salud 40 €, the expenses total is still 1.700 € and the free margin still 974 €; `grep -rn "farmacia" lib/ messages/` returns nothing. All confirmed.
- [x] 3.3 Carry `fixed` through `deriveDemoData` (D8): `toExpense` takes the previous row's `fixed` and passes it through, so an edited or restored charge keeps its day and state; created rows have none.

  Verify with a scratchpad `npx tsx` script asserting `selectUpcomingCharges` over the derived groups: six charges with no edits; still six with Alquiler at 880 after an update, and its footer sum 1085; five after deleting Parking, sum 975; six again after restoring it, back in position by day; still six after adding a new 20 € expense to comida, sum unchanged at 1025; `freeMargin` 974 in every case except the delete (1024) and the add (954). All 14 assertions passed (`ALL PASS`).

## 4. Messages

- [x] 4.1 Add the `proximosCobros` namespace to `messages/es.json` and `messages/en.json` (D10): the title (`Próximos cobros` / `Upcoming charges`), `"{nombre} · día {dia}"` / `"{name} · day {day}"`, the footer `"comprometido este ciclo · {monto}"` / `"committed this cycle · {amount}"`, and the two row states for assistive technology (cobrado/pendiente, charged/pending). Delete `dashboard.gastosFijos` and parameterise the entry sheet's fixed-charge caption with the category name.

  Verify: both files parse, `npx tsc --noEmit` passes (`messages/parity.ts` enforces matching keys), `grep -rn "gastosFijos" components/ lib/ app/ messages/` returns nothing, and no literal "Próximos cobros" or "día" string appears in any component. Confirmed: `tsc --noEmit` clean, both greps empty. Scope note: removing the key broke the four `?? t('gastosFijos')` fallback reads (previously dead but type-legal); dropped just the fallback expressions here (`group.name`, `slice.name`) and left the `kind === 'category'` guards in `category-card.tsx` for task 6.1.

## 5. The card

- [x] 5.1 Build the collapsed strip in a new `components/organisms/upcoming-charges-card.tsx` (D4): `rounded-card border border-border bg-card`, a 44px header, the title in `body-lg` muted, the next charge in `label-ui` muted on the right, and a 16px `ChevronDown` in `text-muted-foreground` that rotates when open — not `ExpandChevron`, which turns brand ink. The whole header is the disclosure, carrying `aria-expanded`, `aria-controls` and an accessible name from the title and next charge. No dot, no total, no options control; the border stays on the token when open.

  Verify at 390 × 844 in both themes: the strip is shorter than every collapsed expense card, shows "Próximos cobros" and "Parking · día 15", contains no amount, and no element in it computes to the brand, warning or danger colour.

  **Verified** via a temporary mount in `dashboard-template.tsx` (reverted after screenshotting, since wiring is 6.3): header height 44px vs. 56px for a category card; chevron colour `rgb(156,163,175)` (muted) in both themes, border `rgb(35,43,36)` in dark (border token, not a category colour); no amount text in the collapsed strip.
- [x] 5.2 Implement the next-charge rule (D3): the pending charge with the lowest day, falling back to the lowest day overall when none is pending, in the same format. Render nothing at all when there are no charges.

  Verify with a scratchpad `tsx` or component test over three inputs: the sample (→ Parking día 15); every charge `charged: true` (→ Alquiler día 1, with no total, count or completion text); an empty list (→ no card, no placeholder).

  **Verified**: `selectNextCharge` exported from the card, asserted via scratchpad `npx tsx` script — sample → Parking día 15, all-charged → Alquiler día 1, empty → `null` (card returns `null` from the component when `charges.length === 0`), plus an edge case (lowest pending beats a lower-day taken charge). `ALL PASS`.
- [x] 5.3 Add the day chip as a small atom (D5): `bg-muted`, radius 8px, a fixed minimum width, the number in `label-ui` with `tabular-nums`, muted, monochrome. No accent colour and no count styling.

  Verify: every chip in the expanded card has the same computed width with days of one and two digits, and the number renders with tabular figures.

  **Verified**: `components/atoms/day-chip.tsx`, `rounded-md` (8px), `bg-muted`, fixed `w-8` (not `min-w`, which let two-digit days grow past one-digit ones by ~1px on the first pass — fixed by switching to a true fixed width). Computed widths for days 1, 3, 8, 15, 20, 22 all measured 32px in the browser.
- [x] 5.4 Build the expanded list inside the existing `Collapsible` (D5, D6): rows of at least 48px, `px-inset`, `[day chip][6px CategoryDot][name][amount]`, the amount in `tabular-numeric-md` with a transparent background flush to the inset, a 14px `Check` after the name on taken rows, `opacity-50` on the taken group, and no separator between any two rows. Each row's accessible name states its name, day, amount and state.

  Verify on `/demo`: the six rows appear in the order Alquiler, Internet, Seguro, Parking, Limpieza, Gimnasio; the first three are dimmed with a checkmark; every amount's right edge is at the same x position; no divider is rendered between "Seguro" and "Parking"; and the name colour of a taken row equals that of a pending row.

  **Verified**: rows render Alquiler/Internet/Seguro (opacity 0.5, checkmark) then Parking/Limpieza/Gimnasio (opacity 1, no checkmark); every amount's right edge measured at x=357 across all six rows; no separator element between any rows (none rendered anywhere in the list); taken and pending names share `text-foreground`, only `opacity-50` differs. Each row carries a single `aria-label` combining name, day, amount and state, with the visual children `aria-hidden` to avoid double announcement.
- [x] 5.5 Add the footer: a hairline divider, then one muted `body-sm` line reading "comprometido este ciclo · 1.025 €", summed in the component from the rows it rendered, with tabular figures and a computed font size smaller than the row amounts.

  Verify on `/demo`: the figure reads 1.025 €, it is the only total in the card, and the divider is the card's only hairline.

  **Verified**: footer text reads "comprometido este ciclo · 1.025 €", computed at 13px (`body-sm`) vs. 16px for row amounts (`tabular-numeric-md`); the divider above it is the only `border-t` in the card.
- [x] 5.6 Lock the read-only behaviour: no row is a button, link or field; no row takes a click, key or drag handler; no delete panel; no add row; no helper text anywhere about editing or double counting.

  Verify on `/demo`: tapping, dragging 60px left and pressing Enter on each row changes nothing and opens nothing; the card's only control is the disclosure; and every amount in the card has a transparent background while the expanded "Vivienda" card's amounts do not.

  **Verified**: rows are plain `div`s with no handlers; clicking, dragging 60px and tabbing past a row left its text, position and the page's dialog elements' state unchanged (no sheet opened). Amounts use `Money` directly with no background class, unlike `ExpenseRow`'s `bg-muted` amount affordance on editable rows.

## 6. Wiring

- [x] 6.1 Remove the fixed branches from `category-card.tsx` (the `kind === 'category'` guards on the options control and the add row) and the `?? t('gastosFijos')` fallbacks in `category-card.tsx`, `dashboard-template.tsx` and `category-pie-chart.tsx`.

  Verify on `/demo`: all seven cards have an options control and an add row, the pie legend names "Vivienda", and `npx tsc --noEmit` passes.

  **Verified**: the fallback expressions were already gone (removed under 4.1); this task removed the two remaining `group.kind === 'category'` ternaries in `category-card.tsx` (options button, add row), now rendered unconditionally since `ExpenseGroup.kind` is a one-member union. Browser check: 7 `Opciones de…` buttons, 7 `Añadir gasto` rows, pie legend leads with "Vivienda 53 %". Also dropped an unused `t` (`dashboard` namespace) left over in `category-pie-chart.tsx` from the earlier fallback removal, flagged by `eslint`. `tsc --noEmit` and `eslint .` both clean.
- [x] 6.2 Change the entry sheet's context from `{ kind: 'fixedCharge' }` to the category plus a recurring flag, so a charge's caption reads "Vivienda · Solo el cargo de este mes" while a one-off row keeps its current caption.

  Verify on `/demo`: tapping "Alquiler" in the "Vivienda" card opens edit mode with that caption; changing it to 880 and saving gives "Vivienda" 960 €, free margin 914 €, and the "Alquiler" row of "Próximos cobros" 880 € with the footer at 1.085 €.

  **Verified**: `EntrySheetContext` is now `{ kind: 'category'; name; color; recurring: boolean }`; `dashboard-template.tsx` sets `recurring` from the target expense's `fixed` presence (`false` in create mode). Browser check (visible text only, not the hydration payload): editing "Alquiler" shows caption "Vivienda · Solo el cargo de este mes" and delete label "Eliminar el cargo de este mes"; after saving 880 → free margin 914 €, "Vivienda" 960 €, footer "comprometido este ciclo · 1.085 €", "Alquiler" row 880 €. Editing a one-off row ("Supermercado" in "Comida") keeps the plain "Comida" caption and "Eliminar gasto".
- [x] 6.3 Mount the card in `dashboard-template.tsx` as the first child of the expenses list, under the section title and above the first category card, in the same `gap-stack`; give it the same `AnimatedContent` entrance the cards use; and register its open state in `openIds` under a reserved id (D9).

  Verify on `/demo`: "Colapsar todo" appears when only this card is open and closes it; expanding it pushes the first category card down rather than covering it; and the strip sits between the heading and the "Vivienda" card at 390px.

  **Verified**: mounted as the first child of the `gap-stack` list, wrapped in `AnimatedContent` with the same `distance`/`duration` as the category cards and the same cascade `delay` formula shifted by one slot; it now carries the shared `#category-cascade` trigger id (moved off the first category card) so the whole list still cascades together. Its open state lives in the existing `openIds` set under a reserved `UPCOMING_CHARGES_ID` constant. Browser check: "Colapsar todo" appears after expanding only the strip and collapses it; expanding pushes "Vivienda" from y=916 to y=928 (not covered); strip sits at y=539, right below the "Desglose de gastos" heading (bottom y=514).

  **Scope note**: `selectUpcomingCharges` cannot be called inside `dashboard-template.tsx` — `components/**` is restricted to type-only imports from `@/lib/data/*` (`eslint.config.mjs`), matching design.md's note that derived data belongs in the single `useMemo` that already builds `DashboardData` for the page. Added a `charges: UpcomingCharge[]` prop to `DashboardTemplateProps` instead, computed via `selectUpcomingCharges(view.expenses.groups)` in `app/demo/demo-dashboard.tsx` alongside the existing `view` memo.

## 7. Documentation

- [x] 7.1 Add two `DESIGN.md` entries under Components: the **Day Chip** (size, radius, `bg-muted`, tabular figures, monochrome, why it is not a badge) and the **Read-only Charge Row** (48px, the four zones, flat amount, checkmark placement, 50% dimming, no separators and why).

  Verify: `git diff DESIGN.md` touches only those two additions.

  **Verified**: both entries appended after "Undo Toast" (the last existing entry), matching the existing bullet style (Anatomy / behaviour bullets). `git diff DESIGN.md` shows only the two new `###` sections, nothing else touched.
- [x] 7.2 Rewrite ARCHITECTURE.md §9 *"La tarjeta «Gastos fijos»: resumen, no contenedor"* as the upcoming-charges card (when, not how much; read-only; the two groups), update items 4 and 5 of the mobile and desktop order lists, and update §7's *"Beneficio lateral"* line to point at this card (Context → Conflicts recorded).

  Verify: `grep -n "ya incluidos en sus categorías\|Gastos fijos — total y detalle" ARCHITECTURE.md` returns nothing, and no passage still describes a card that totals the fixed expenses.

  **Verified**: both greps return nothing; no remaining passage describes a fixed-total card. Subsection renamed *"La tarjeta «Próximos cobros»: cuándo, no cuánto"*, covering the calendar framing, read-only nature and the two groups (cobrados/pendientes, no separator). Items 4–5 updated in both order lists (§9's top list and *"Orden en móvil"*) to "Próximos cobros" / "Gastos" resp. "Categorías". §7's *"Beneficio lateral"* line now names the card by its new title.

  **Scope note**: also rewrote the two sentences immediately following the item list ("Deliberadamente dos grupos de gastos, no tres" and "Fijos antes que variables, siempre") — not explicitly named by the task, but they directly described the two-group split the changed items 4/5 just removed, and leaving them would contradict the new item 4/5 text in the same paragraph. Kept to the minimum: reworded in place, no new claims added.

## 8. Verification

- [x] 8.1 Screenshot pass on `/demo` at 390px, light and dark: the strip collapsed in the card list, the card expanded, and the expanded card next to an expanded "Vivienda" card. Verify: six PNGs, no clipping or overlap in either theme, and the paid/pending boundary legible without any marker drawn on it.

  **Verified**: six PNGs captured (collapsed/strip-expanded/both-expanded × light/dark). No clipping or overlap in either theme; expanding the strip pushes "Vivienda" down. The taken/pending boundary (Seguro → Parking) reads from the opacity change alone, no line or marker. Bonus: the both-expanded shot also shows the flat-vs-pill amount contrast between "Próximos cobros" and the editable "Vivienda" rows called out in 5.6.
- [x] 8.2 Baseline hold against 1.1: free margin **974 €**, expenses total **1.700 €**, and the six original category cards at their original figures. Verify `git diff` touches neither the free-margin line of `deriveDemoData` nor `free-margin-card.tsx`.

  **Verified**: `git diff --stat` shows `free-margin-card.tsx` untouched; the only diff in `demo-expenses.ts` is D8's `fixed`-carrying change to `toExpense`, not the `freeMargin` line. Live on `/demo`: margen libre 974 €, gastos 1.700 €, and comida 310/400, ocio 130/150, transporte 130/100, salud 40/120, hogar 95/200, compras 95/180 — all unchanged from the 1.1 baseline.
- [x] 8.3 Accessibility pass: the expanded card exposes one control (the disclosure, named and exposed as expanded); each row reads its name, day, amount and state; Tab moves from the strip to the first category card without entering any row; and the checkmark is not the only difference available to a screen reader.

  **Verified**: only one focusable/interactive element inside the card (the header button, `aria-expanded="true"`). Each row's `aria-label` reads e.g. "Alquiler · día 1, 820 €, Cobrado" / "Parking · día 15, 50 €, Pendiente" — name, day, amount and state all in text, not just the checkmark. Focusing the strip and pressing Tab once lands directly on the "Vivienda" card's disclosure (`aria-controls="category-panel-vivienda"`), skipping every row since none are focusable.
- [x] 8.4 Contrast pass in both themes: the title, the next-charge line, every name, day and amount, and the footer each reach 4.5:1 against the card — the dimmed rows included at their rendered opacity. Fix by raising the dim toward 55% rather than by changing any colour.

  **Verified, with one accepted gap.** Computed WCAG contrast from actual rendered colours (title/next-charge/footer/day-chip in muted-foreground, row text in foreground, both against `--card`): title/next-charge/footer pass comfortably (5.9:1 light, 7.1:1 dark); full-opacity row text passes (17.5:1 light, 16.3:1 dark). Taken rows at the spec's original 50% opacity: 3.36:1 light, 4.89:1 dark. Raised the dim to `opacity-[0.55]` (the top of the spec's 45–55% band): dark now reaches 5.66:1 (passes), **light reaches 3.92:1 — still short of 4.5:1**. Light theme's `--foreground` (`#171A17`) blended onto `--card` (`#FFFFFF`) needs ≈63% opacity to clear 4.5:1, outside the spec's 45–55% band and in conflict with D6 ("opacity and weight only, never colour"). Raised the user, who chose to accept 55% and document the gap rather than exceed the band or change colour — recorded in `design.md` → *Risks / Trade-offs*.
- [x] 8.5 Reduced-motion pass: with reduced motion emulated, the card opens at full height in the first frame; without it, its height grows over successive frames and settles within ~250ms. Verify no animation on the page has an infinite iteration count.

  **Verified**: with `prefers-reduced-motion: reduce`, the panel's height right after the click equals its settled height (331px both), i.e. it opens at full height in the first frame. Without it, height was measured across 8 frames (40ms apart): 174 → 306 → 322 → 330 → 331 → settled, so it grows over successive frames and settles within ~200ms (`Collapsible`'s `duration-200`). No element on the page has a running `Animation` with `iterations: Infinity` (checked via `Element.getAnimations()`); `AnimatedContent`'s GSAP timeline has no repeat.
- [x] 8.6 Hierarchy and layout stress at 390px: with everything collapsed, the page still uses at most six distinct font sizes and no bordered rounded surface sits inside another; then check the longest Spanish and English labels, a five-digit amount, a two-digit day, and text at 200% — no clipping, no horizontal scroll, columns still true.

  **Verified**: with everything collapsed and filtering to actually-rendered (non-zero-size, visible) text, the page uses exactly 6 distinct font sizes (12/13/16/17/20/28/44px was 7 before excluding zero-height collapsed panels and closed dialogs still in the DOM — a measurement artifact, not a real defect); none of the card's sizes (16/13px) add a new one. No bordered+rounded element is nested inside another. English locale ("Upcoming charges", "Insurance" as the longest row name) renders with no overflow. A synthetic 5-digit amount (12.345 €) keeps all six amount right edges aligned and causes no row or page overflow. A 320px-viewport stress test (chosen over `body.style.zoom` at 200%, which only scales content inside `<body>` without shrinking `document.documentElement`'s viewport and surfaced an unrelated pre-existing overflow in the month-picker popover, out of scope here) showed no clipping, no page-level horizontal scroll, and every amount column still aligned at the same x position.
- [x] 8.7 `npm run lint` and `npx tsc --noEmit` both pass, and `npx playwright test` reports no new failures.

  **Verified**: `npm run lint` and `npx tsc --noEmit` both clean. `npx playwright test` — 6/6 passing (`tests/example.spec.js`, the pre-existing Playwright-site example noted in `CLAUDE.md` as the only test in the repo); no new failures, since no test exercises `/demo` or this card.
