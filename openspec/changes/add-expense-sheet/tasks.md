## 1. Baseline and keypad spike

- [x] 1.1 Capture "before" screenshots with a scratchpad Playwright script on `/demo` at 390 × 844, in both themes, in Spanish: the "comida" card open, and the fixed-expenses card open. Verify:
  - four PNGs exist in the scratchpad
  - `grep -rn "addExpense" app components lib` lists only `lib/data/dashboard.ts`, `components/templates/dashboard-template.tsx` and `app/demo/demo-dashboard.tsx`
- [x] 1.2 Keypad spike (D5):
  1. Read *Virtual keyboard aware* and the `Root`, `Portal` and `Popup` API tables in `node_modules/@base-ui/react/docs/react/components/drawer.md`.
  2. Create a throwaway `app/spike-entry-sheet/page.tsx`: a `Drawer` (`Portal keepMounted`, `VirtualKeyboardProvider`) holding one `inputMode="decimal"` input, opened by a button whose click handler opens the drawer through `flushSync` and then focuses the input.
  3. Tap the button in Playwright WebKit with the `iPhone 15` device.

  Verify:
  - `document.activeElement` is the input right after the tap. If it isn't, implement the D5 focus-proxy variant and re-run until it is.
  - If an iPhone can reach the dev server over the LAN, the decimal keypad appears on the first tap. Otherwise note "device check pending" for 8.13.
  - The chosen approach (direct focus or proxy) is written into this task line.
  - The spike route is deleted: `git status` shows no `app/spike-entry-sheet`.

  **Result:** direct focus. `flushSync(() => setOpen(true))` followed by `inputRef.current?.focus({ preventScroll: true })` in the tap handler leaves `document.activeElement` as the amount input immediately after the tap in WebKit `iPhone 15` emulation — no focus-proxy needed. No physical iPhone was available on this LAN to confirm the software keypad itself; that check is pending for task 8.13.

## 2. Contract

- [x] 2.1 Create `lib/data/expenses.ts` with `LocalDate`, `ExpenseDraft` and `ExpenseMutations`. Doc comments carry the D1 semantics:
  - operations resolve once the change is durable, and reject with nothing changed
  - `update` writes only amount, description and date
  - soft delete and restore only set or clear `borrado_en`

  Verify: `npx tsc --noEmit` passes, and `grep -nE "export (async )?(function|const)" lib/data/expenses.ts` returns nothing.
- [x] 2.2 In `lib/data/dashboard.ts`:
  - export `Expense`
  - add `cycle.today: LocalDate`
  - document `ExpenseGroup.id` as the category id for `kind: 'category'`
  - add `expenses: ExpenseMutations` to `DashboardActions`, keeping `addExpense` until 6.4

  In `buildDemoData`, set `cycle.today` to `'2026-09-10'`. Verify: `npx tsc --noEmit` passes.

## 3. Demo operations

- [x] 3.1 Create `lib/demo/demo-expenses.ts` per D9, containing:
  - `DemoExpenseEdits` and `noDemoEdits`
  - the pure `deriveDemoData`: rows, group totals, budgets through `getBudgetStatus` with the day taken from `cycle.today`, expenses total, the current history entry, and the free margin
  - `createDemoExpenseMutations` with counter-based ids

  Verify with a scratchpad `npx tsx` script run from the repo root, applying the returned operations through a fake `setEdits`:
  - with no edits: `freeMargin` is 974 and `expenses.total` is 1700
  - after `softDelete('comida-2')`: the "comida" total is 247.6 and `freeMargin` is 1036.4. After `restore('comida-2')` they are back to 310 and 974.
  - after `create('comida', { amount: 20, description: 'Panadería', date: '2026-09-10' })`: "comida" is 330 with budget level `warning`, the last history total is 1720, and `freeMargin` is 954
  - after `update('ocio-1', { amount: 125, description: 'Conciertos', date: '2026-09-08' })`: "ocio" is 170 with level `exceeded`
- [x] 3.2 Make `buildDemoData` build the sample rows and return `deriveDemoData(sample, noDemoEdits)`, so a single derivation serves the first render and every edit (D9). Verify:
  - `npx tsc --noEmit` passes
  - `/demo` in Spanish still shows "974 €" as the free margin, and "310 €" of "400 €" on the collapsed "comida" card

## 4. Tokens and messages

- [x] 4.1 Add `--destructive-ink`, `--destructive-fill` and `--destructive-fill-foreground` to `:root` in `app/globals.css`, and map them in `@theme inline` (D11). Edit only those lines. Verify: `npm run lint` passes, and on `/demo` in both themes `getComputedStyle(document.documentElement)` resolves all three to non-empty values.
- [x] 4.2 Add the `hojaGasto` namespace from D10 to `messages/es.json` and `messages/en.json`. Verify:
  - both files parse with `node -e 'JSON.parse(require("fs").readFileSync(process.argv[1]))'`
  - `npx tsc --noEmit` passes (`messages/parity.ts` enforces matching keys)

## 5. Molecules

- [x] 5.1 Rework `components/molecules/expense-row.tsx` per D7:
  - a `button` with block `span`s when `onActivate` is given, a `div` otherwise
  - the `bg-muted rounded-lg` amount only when the row is interactive
  - `pressable` and the existing hover tint

  Verify: `npm run lint` passes, and `/demo` still renders plain amounts (no handler is wired yet).
- [x] 5.2 Create `components/molecules/field-row.tsx` per D4:
  - the label on the leading side and a control slot on the trailing side
  - `min-h-row`, with a taller variant for the amount
  - an inset hairline

  Verify: `npm run lint` passes, and the land-finance-dashboard colour guard grep returns nothing for the file.
- [x] 5.3 Create `components/molecules/swipe-to-delete.tsx` per D6:
  - 10px intent lock and pointer capture
  - 50 % panel and 60 % long-swipe thresholds
  - click suppression after a drag
  - closing on outside press and on scroll
  - slide-out, then `Collapsible` collapse, then `await onDelete()`, with a reset on rejection
  - an `inert`, `aria-hidden` panel while closed
  - the reduced-motion path and the `starting:` expand-in

  Verify: `npm run lint` passes, and `grep -n "'use client'" components/molecules/swipe-to-delete.tsx` returns nothing.
- [x] 5.4 Read *Undo action*, *Global manager* and the `ToastObject` type in `node_modules/@base-ui/react/docs/react/components/toast.md`. Then create `components/molecules/undo-toast.tsx` per D8: viewport position, the inverted opaque capsule, the action's styling, and motion with its reduced-motion fallback. Verify: `npm run lint` passes, and the colour and `aria-label` guard greps return nothing for the file.

## 6. Sheet, card, template and demo wiring

- [ ] 6.1 Create `components/organisms/entry-sheet.tsx` per D2–D5, covering:
  - `FieldDescriptor`, `EntryConfig` and `expenseEntry`
  - the `Drawer` shell and material, and the header
  - the amount, text and date controls, with parsing and prefill
  - field and form errors, and the D4 state table
  - dismissal rules through the `onOpenChange` reasons, and `finalFocus`
  - the focus approach chosen in 1.2

  Verify: `npm run lint` and `npx tsc --noEmit` pass, and the guard greps return nothing for the file.
- [ ] 6.2 Update `components/organisms/category-card.tsx` per D7:
  - `onEditExpense` and `onDeleteExpense`
  - the name fallback
  - `SwipeToDelete` only when a delete handler is given
  - `AddRow` only for `kind === 'category'`

  Verify: `npm run lint` passes, and on `/demo` the fixed-expenses card no longer renders an add row.
- [ ] 6.3 Update `components/templates/dashboard-template.tsx` per D8. Edit only the parts involved:
  - sheet state and the open handler
  - one `EntrySheet` with `expenseEntry`, plus its date defaults and limits
  - the save, delete and undo handlers on `actions.expenses`
  - the toast manager, `Toast.Provider` and `UndoToast`
  - the `sr-only` status node

  The template stops reading `actions.addExpense`. Verify: `npx tsc --noEmit` and `npm run lint` pass.
- [ ] 6.4 Update `app/demo/demo-dashboard.tsx` per D9:
  - `edits` state and `deriveDemoData`
  - `createDemoExpenseMutations` passed as `expenses`
  - income and savings still on `showUnavailable`

  Then remove `addExpense` from `DashboardActions`. Verify:
  - `npx tsc --noEmit` passes, and `grep -rn "addExpense" app components lib` returns nothing
  - `/demo` returns 200, and adding 20 € "Panadería" to "comida" makes the free margin read "954 €"

## 7. Docs

- [ ] 7.1 Update `DESIGN.md` per D12: the sheets bullet in *Shapes*, *Bottom Sheets & Modals*, *Materials*, and new *Swipe Actions* and *Undo Toast* entries. Verify: `git diff DESIGN.md` changes only those sections.

## 8. Verification

Use scratchpad Playwright scripts against `/demo` on the dev server (:3000), at 390 × 844, in Spanish and in both themes unless stated. Touch drags run in a Chromium `hasTouch` + `isMobile` context through CDP `Input.dispatchTouchEvent`.

- [ ] 8.1 **Sheet content and layout** (*Create from a category card*, *Edit preloads the expense*, *Same layout in both modes*, *Amount focused on open*, *Floating geometry*, *Header and delete order*, *Row and target sizes*, *Full-opacity content*). Verify: every THEN clause of those scenarios holds.
- [ ] 8.2 **Fields** (*Comma decimals in Spanish*, *Invalid amounts*, *Empty description*, *Date limited to the cycle*). Verify:
  - every THEN clause holds
  - the native date input has `min="2026-09-01"` and `max="2026-09-30"`
  - in a desktop context, clicking the date calls `showPicker`
- [ ] 8.3 **Figures** (*Deleted expense leaves every figure*, *Restore brings the expense back*, *Create updates the free margin*, *Edit pushes a category over budget*, *Fixed charge edits this month only*, *Added expense moves every figure*, *Sample totals are consistent*). Read the card headers, the expenses column and panel, the bar chart's `sr-only` list, the pie centre and legend, and the free margin. Verify: every THEN clause holds.
- [ ] 8.4 **Harness for injected operations** (*Same operations on another data source*, *Fixed charge update carries only the charge*, *Pending save*, *Failed save*, *Failed delete*, *Dashboard without expense operations*).
  1. Create a temporary `app/verify-expense-ops/` route. Its client wrapper mounts `DashboardTemplate` with `buildDemoData('es')` and an operations object chosen by query parameter:
     - `record`: logs each call, then delegates to the demo operations
     - `slow`: adds a 1 s delay
     - `fail`: rejects
     - `none`: supplies no operations
  2. Run the scenarios.
  3. Delete the route.

  Verify:
  - every THEN clause holds
  - `git diff --stat components` was empty while the harness ran
  - `git status` shows no `app/verify-expense-ops`
- [ ] 8.5 **Dismissal and focus** (*Unsaved values survive a stray tap*, *Focus returns*, *Keyboard opens edit mode*). Verify: every THEN clause holds, and swiping the panel down closes an unchanged sheet but leaves a changed one open.
- [ ] 8.6 **Swipe** (*Short swipe opens*, *Release before the threshold closes*, *Long swipe deletes directly*, *Vertical scrolling is unaffected*, *One open row*, *Tapping an open row closes it*). Verify: every THEN clause holds.
- [ ] 8.7 **Undo toast** (*Undo after a long swipe*, *Delete from the sheet*, *Toast timing*, *Only the latest deletion is undoable*). Advance time with `page.clock`. Verify:
  - every THEN clause holds
  - the toast sits in a polite live region
  - "Deshacer" is reachable by pressing F6, then Tab
- [ ] 8.8 **Demo route** (*Add action in the demo*, *Repeated add actions*, *Editing stays in the browser*, *Edits survive a language switch*, *Reload discards edits*). Record requests with `page.on('request')`. Verify: every THEN clause holds.
- [ ] 8.9 **Cards and add rows** (*Editable-looking amounts and light add row*, *Rows are buttons*, *Fixed card has no add row*, *No add row on the fixed card*). Also re-run unify-add-action-rows' *Same geometry in every place*. Verify: every THEN clause holds.
- [ ] 8.10 **Materials and contrast** (*Only navigation and controls blur*, *Content is opaque*, *Legible entry sheet*). Compute WCAG ratios from rendered colours, compositing the glass tint over the brightest and the darkest content behind it, for:
  - the sheet's text
  - `--destructive-ink` on the sheet
  - the swipe panel's label and icon on `--destructive-fill`
  - the toast's text and action on the capsule

  Verify: text reaches ≥ 4.5:1 and icons ≥ 3:1 in light and dark. If a pair fails, adjust that D11 token and re-run.
- [ ] 8.11 **Motion** (*Reduced motion*, *Reduced motion while editing*, *No endless animation*, *Animated disclosure*, *Animated sheet and swipe*). Sample transforms on successive `requestAnimationFrame` ticks. Verify: every THEN clause holds.
- [ ] 8.12 **Visual review.** Capture "after" screenshots matching 1.1, plus:
  - the create and edit sheets in both themes
  - the fixed-charge caption
  - a row swiped open, and a long swipe past 60 %
  - the undo toast
  - the harness failure alert

  Read them. Verify:
  - both themes look coherent, and the sheet, swipe and toast motion is clearly visible
  - no bordered, rounded surface sits inside another (*Mobile visual hierarchy*)
  - every visible button is at least 44 × 44px (*Touch targets*)
- [ ] 8.13 **Device check.** On an iPhone reaching the dev server over the LAN, tap "Añadir gasto" in "comida", then tap an expense row. Verify:
  - the decimal keypad appears without a second tap
  - the header stays visible above the keyboard
  - swiping rows does not fight vertical scrolling

  If no device is available, leave this task unchecked and report it.
- [ ] 8.14 **Regressions.** Run `npm run lint`, `npx tsc --noEmit`, `npm run build`, the land-finance-dashboard 6.1 guard greps, and `grep -rn "DELETE" app components lib`. Verify:
  - lint, type-check and build pass
  - the only guard hit is the pre-existing `'use client'` in `components/molecules/demo-notice.tsx`
  - the `DELETE` grep returns nothing
- [ ] 8.15 **OpenSpec.** Run `openspec validate add-expense-sheet --strict`. Verify: it reports the change as valid. The INFO notes about archiving `dashboard-ui` and `design-system` are expected until the four earlier changes are archived.
