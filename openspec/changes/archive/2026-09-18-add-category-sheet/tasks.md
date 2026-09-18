## 1. Baseline

- [x] 1.1 Record the "before" state with a scratchpad Playwright script on `/demo` at 390 × 844, both themes, Spanish: the card list collapsed, the "comida" card open, and the fixed-expenses card open. Verify:
  - six PNGs exist in the scratchpad
  - the free margin reads **974 €** and the expenses total **1.700 €**
  - the six category cards read: comida 310/400, ocio 130/150, transporte 130/100, salud 40/120, hogar 95/200, compras 95/180
  - these numbers are written into this task line as the baseline every later task compares against

  **Baseline:** free margin **974 €**, expenses total **1.700 €**, ingresos 2.820 €, ahorro 146 €. Gastos fijos 900 €. Category cards: comida 310/400, ocio 130/150, transporte 130/100, salud 40/120, hogar 95/200, compras 95/180. Verified identical in light and dark themes. Six PNGs captured in the scratchpad (`baseline-shots/01-collapsed-{light,dark}.png`, `02-comida-open-{light,dark}.png`, `03-fixed-open-{light,dark}.png`).

## 2. Contract

- [x] 2.1 Create `lib/data/categories.ts` with `CategoryDraft`, `CategoryMutations` and `DUPLICATE_CATEGORY_NAME` (D1). Doc comments carry the semantics: each operation resolves once durable and rejects with nothing changed; `budget: null` removes the budget; `update` never touches expenses or another category; `delete` moves every expense in every cycle to `reassignTo` and takes the budget row with it; `reassignTo` is `null` only for a category with no expenses.

  Verify: `npx tsc --noEmit` passes, and `grep -nE "export (async )?(function|const)" lib/data/categories.ts` returns only the `DUPLICATE_CATEGORY_NAME` line.
- [x] 2.2 Add `categories?: CategoryMutations` to `DashboardActions` in `lib/data/dashboard.ts`. Verify: `npx tsc --noEmit` passes and `/demo` renders unchanged (nothing consumes it yet).

## 3. Shared sheet shell

> This group ends with the entry sheet behaving exactly as it does today. Do not start group 7 until 3.3 passes.

- [x] 3.1 Extract `components/organisms/sheet-shell.tsx` per D3: `Drawer.Root` → `Portal keepMounted` → `VirtualKeyboardProvider` → `Backdrop` → `Viewport` → `Popup`, the `bg-handle` drag handle, and the three-column header with slots for the leading action, title, caption and trailing action. It owns the dirty-state guard and the busy lock; it owns no fields. Verify: `npx tsc --noEmit` passes.
- [x] 3.2 Extract `components/molecules/amount-field.tsx` from `entry-sheet.tsx:206-240` — the `Intl.NumberFormat.formatToParts` currency symbol and side, `inputMode="decimal"`, the in-place invalid message, and a prop that makes the value optional (D3). Verify: `npx tsc --noEmit` passes.
- [x] 3.3 Move `EntrySheet` onto the shell and the amount field, changing no props and no behaviour. **Regression gate** — re-run the `expense-editing` scenarios on `/demo` and verify each still holds:
  - floating geometry at 390 × 844: panel 12–16px from left, right and bottom; four non-zero corner radii; handle centred
  - header order: "Cancelar" leading, "Guardar" trailing, "Eliminar gasto" last under a divider
  - create from "comida" opens titled "Nuevo gasto" with the amount focused and the date 10 September 2026
  - a pending save shows progress, exposes the form as busy, and Escape/scrim leave the sheet open
  - closing with Escape returns focus to the row that opened it
  - with reduced motion emulated, the sheet is at its resting position in the first frame
  - adding 20 € "Panadería" to "comida" still gives 330 € of 400 €, expenses 1.720 € and free margin 954 €

## 4. Demo data

- [x] 4.1 Create `lib/demo/demo-categories.ts` with `DemoCategoryEdits` and `createDemoCategoryMutations`, appending to the log only and never mutating base data (D7). `update` rejects with `DUPLICATE_CATEGORY_NAME` when the trimmed name exact-matches another group's current name. Verify: `npx tsc --noEmit` passes.
- [x] 4.2 Extend `deriveDemoData` to `(base, expenseEdits, categoryEdits)` running the five steps of D7 in order: expense edits → category updates → category deletions → per-group total and `getBudgetStatus` → expenses total, history and free margin.

  Verify with a scratchpad `npx tsx` script from the repo root, asserting exactly:
  - no edits: `freeMargin` 974, `expenses.total` 1700
  - budget 400 → 600 on comida: comida `budget.amount` 600, `spent` 310, `weeklyAllowance` 96, `level` `'ok'`; `freeMargin` still 974
  - budget 400 → 200 on comida: `level` `'exceeded'`, `spent − amount` 110; `freeMargin` still 974
  - budget → `null` on comida: `budget` is `null`, `total` 310; `freeMargin` still 974, `expenses.total` still 1700
  - back to 400: `weeklyAllowance` 30; `freeMargin` still 974
  - rename + recolour comida: `name` and `color` change, every figure unchanged
  - delete hogar onto compras: no `hogar` group, compras `total` 190 with `level` `'exceeded'`, `expenses.total` still 1700, `freeMargin` still 974
  - delete the `salud-0` expense then delete the empty salud category: `expenses.total` 1660, `freeMargin` 1014
  - add 20 € to transporte: `freeMargin` 954. Separately, clear transporte's budget and add the same 20 €: `freeMargin` 954 again
- [x] 4.3 Wire `createDemoCategoryMutations` and the category edit log into `app/demo/demo-dashboard.tsx`, passing `categories` through `DashboardActions`. Verify: `/demo` renders with the baseline figures of 1.1 and `npx tsc --noEmit` passes.

## 5. Messages

- [x] 5.1 Add the `hojaCategoria` namespace to `messages/es.json` and `messages/en.json` (D8): sheet title and caption, "Cancelar"/"Guardar", the name, colour and budget labels, the duplicate-name and invalid-budget messages, the save and delete error messages, the delete row and its confirmation copy (naming the category and its expense count this cycle), the receiving-category label, and the **eight colour names**. Include the parameterised options-control label (`"Opciones de {categoria}"` / `"{categoria} options"`).

  Verify: both files parse with `node -e 'JSON.parse(require("fs").readFileSync(process.argv[1]))'`, `npx tsc --noEmit` passes (`messages/parity.ts` enforces matching keys), and `grep -rn "Opciones\|Presupuesto" components/` finds no literal string.

## 6. Card header

- [x] 6.1 Split the `category-card.tsx` header per D2: the disclosure becomes an absolutely positioned button across the header carrying `aria-expanded`, `aria-controls` and `aria-labelledby={nameId amountId}` with `--press-scale: 1`; dot, name, amount and chevron render above it; the card wrapper keeps the open-card border colour. Add a comment naming the constraint (no nested interactives, §9's required order).

  Verify on `/demo`: the header exposes one control, expanding and collapsing still works, the accessible name reads "Comida 310 de 400", pressing the header tints it, the focus ring traces the header, and a long category name still truncates with an ellipsis.
- [x] 6.2 Add the options control between the amount and the chevron on `kind: 'category'` cards only: `MoreHorizontal` at 20px in `muted-foreground`, inside a 44 × 44 `pressable` hit area, above the disclosure in stacking order, labelled from `hojaCategoria`. Disabled when no `categories` handler is supplied.

  Verify on `/demo`: six controls and none on the fixed-expenses card; accessible names are "Opciones de Comida" … all distinct; a press at its centre does not change `aria-expanded`; Tab reaches it from the disclosure; mounted without `categories` it is disabled and the disclosure still works.

## 7. Category sheet

- [x] 7.1 Create `components/organisms/category-sheet.tsx` on the shell (D3): header of "Cancelar" / title naming the category + colour-dot caption / "Guardar" pill, then the name field, the colour picker slot, the budget field, a divider and the "Eliminar categoría" row in `destructive-ink`. Name focused on open; Save disabled while the name is empty or the budget invalid; `budget: null` when the field is empty.

  Verify at 390 × 844: order and geometry match the entry sheet, every field row and the delete row are ≥ 48px, every control ≥ 44 × 44px, no text below 12px, and the title includes the category name in both languages.
- [x] 7.2 Add the colour picker per D6: a `role="radiogroup"` of eight `role="radio"` buttons, each a 44px target holding a 28px `--cat-*` token with a hairline ring; the selected one gets the 2px active ring plus a corner check badge filled with the sheet background and the check in `foreground`. Accessible names are the colour names, never hex. Amber, red and lime absent.

  Verify in both themes: exposed as a radio group of eight with the current colour checked; `blanco` and `gris_oscuro` stay visibly separated from the glass; the check badge is legible on all eight; no accessible name contains `#`.
- [x] 7.3 Add the delete confirmation as a `step` within the same popup (D5): it names the category and its expense count this cycle, offers the receiving-category picker only when the category has expenses, preselects a category named `Otros` when one exists and otherwise preselects nothing with the destructive action disabled, keeps Cancel as the safe default returning to the form with edits intact, and never renders the destructive action as the header's primary pill.

  Verify on `/demo`: exactly one dialog is present throughout; deleting "hogar" onto "compras" gives compras 190 € of 180 € with "10 € por encima del presupuesto", expenses 1.700 € and free margin 974 €; typing a name then cancelling the confirmation returns to the form with the name intact; with no `Otros` the destructive action starts disabled; an emptied "salud" confirms with no picker.
- [x] 7.4 Mount and orchestrate the sheet in `dashboard-template.tsx`: open state and target category, `onSave` calling `categories.update`, the `DUPLICATE_CATEGORY_NAME` rejection rendering next to the name field while every other rejection renders the alert at the top of the form, `onDelete` calling `categories.delete`, and focus returning to the options control that opened it.

  Verify on `/demo`: renaming "ocio" to "Comida" keeps the sheet open with "Comida" still typed and an in-place message, and "Ocio" unchanged; a failed save keeps every typed value and re-enables "Guardar"; Escape returns focus to the opener.
- [x] 7.5 Add the desktop presentation per D4: above `sm`, the popup anchors to the opener through measured `--anchor-top` / `--anchor-right`, and `swipeDirection` is dropped. Verify at 1280 × 800 that the sheet appears anchored to the control that opened it, closes on Escape and outside press, and returns focus to the opener; and that at 390px it is still a bottom sheet.

## 8. Documentation

- [x] 8.1 Update `DESIGN.md` per D10: extend *Color Swatch Pickers* with the 44px hit area, the hairline ring and the corner check badge (with the reason it is not drawn on the token), and add a *Header Options Control* entry under Components. Verify: `git diff DESIGN.md` touches only those two places.
- [x] 8.2 Align `ARCHITECTURE.md` per D11 — lines 509, 728, 815, 852 and the 860-866 example — to `ingresos − ahorro − gastos`, and annotate the §9 long-press and §9 menu passages with the deviations recorded in design.md → Context.

  Verify: `grep -n "ingresos − fijos − presupuestos\|presupuestos_restantes" ARCHITECTURE.md` returns nothing, and the file no longer describes any budget as reducing the free margin.

## 9. Verification

- [x] 9.1 Screenshot pass on `/demo` at 390px, light and dark: the card header with its options control, the sheet open, the colour picker, and the delete confirmation with the reassignment picker. Verify: eight PNGs, no clipped or overlapping content in either theme.
- [x] 9.2 Keyboard-only pass: reach a card's options control, open the sheet, move through the name, all eight swatches and the budget, save, and confirm focus returns to the control that opened it. Verify: every step reachable with Tab/Shift-Tab and Enter/Space, focus never leaves the sheet while it is open, and no control is skipped.
- [x] 9.3 Reduced-motion pass: with reduced motion emulated, the sheet is at its resting position in the first frame after opening, selecting a colour and entering the delete confirmation change state immediately, and no animation on the page has an infinite iteration count. Without it, the panel's vertical position changes over successive frames and swipe-down dismisses.
- [x] 9.4 Budget lifecycle on `/demo`: set, raise, lower and clear "comida"'s budget in turn. Verify the progress bar appears, updates and disappears, the header switches between "310 € de 400 €" and a plain "310 €", and **the free margin reads 974 € after every one of those saves**.
- [x] 9.5 Over-budget cost: add 20 € to "transporte" (130 € of 100 €) and verify the free margin is 954 €; then, from a reload, clear "transporte"'s budget, add the same 20 €, and verify the free margin is 954 € again. Verify both runs land on the same number.
- [x] 9.6 Baseline hold: compare `/demo` against the screenshots and figures recorded in 1.1. Verify the free margin is **974 €** and the expenses total **1.700 €** before any category change, and that `git diff` touches neither `deriveDemoData`'s free-margin line nor `free-margin-card.tsx`.
- [x] 9.7 Layout stress at 390px: the longest Spanish and English labels, a category named "Comida fuera de casa y bebidas para compartir", and text at 200%. Verify no clipping and no horizontal scroll in either theme.
- [x] 9.8 Virtual keyboard at 390 × 667: focus the budget field with the keyboard shown and verify the field stays fully visible above it.
- [x] 9.9 Translucency allowlist: with the category sheet open, verify the only elements with a computed `backdrop-filter` other than `none` are the pinned bar, the month picker, the account sheet, the entry sheet, the category sheet and their scrims — and that no card or chart behind it blurs. Check the sheet's title, labels, values, colour names, "Cancelar" and "Eliminar categoría" each reach 4.5:1 in both themes.
- [x] 9.10 `npm run lint` and `npx tsc --noEmit` both pass, and `npx playwright test` reports no new failures.
