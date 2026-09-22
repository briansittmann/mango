## 1. Contract and demo implementation

- [x] 1.1 Add `SavingsMovementKind`, `SavingsMovementDraft` and `SavingsMutations` to `lib/data/savings.ts` (D1), with a doc comment matching `ExpenseMutations`' (resolves once durable, rejects with nothing changed, positive amount, sign from the type); replace `addSavingsMovement(): void` with `savings: SavingsMutations` in `DashboardActions` — verify `npx tsc --noEmit` reports only the expected call sites (template, demo page)
- [x] 1.2 Create `lib/demo/demo-savings.ts` with `DemoSavingsEdits`, `noDemoSavingsEdits` and `createDemoSavingsMutations(setEdits)` following `demo-income.ts` — verify it type-checks
- [x] 1.3 Extend `deriveDemoData` with a savings step (D2): signed movements from the edits, stable date sort, `cycle`, `accumulated`, the current month's history point, and `freeMargin = incomeTotal − total − cycle`; pass `noDemoSavingsEdits` in `buildDemoData` — verify `/demo` still loads with 146 € / 2.646 € / 974 € (existing `savings-progress.spec.js` and demo specs pass)

## 2. Entry sheet

- [x] 2.1 Add the `choice` field kind to `EntrySheet` (D4), rendered as the existing pill `radiogroup`, with its value in `fieldState` and passed through `buildValues`; options carry resolved labels — verify `tsc` and that the expense and income sheets render unchanged (`income-create.spec.js`, `recurring-create.spec.js` pass)
- [x] 2.2 Make text descriptors without `optional: true` required (D4): invalid when trimmed empty, disables the primary action, marked on blur and on submit attempt with `invalidMessage` — verify expense/income specs still pass (their descriptions are optional)
- [x] 2.3 Add `savingsEntry` (choice `kind` · `amount` · required `name` · `date`) and the `{ kind: 'savings' }` context/header — verify `tsc`

## 3. Dashboard wiring

- [x] 3.1 In `dashboard-template.tsx` add the `savings` sheet target, `openSavingsCreateSheet`, the `handleSaveEntry` branch calling `actions.savings.addSavingsMovement` and announcing `movimientoAhorroAnadido`, initial values `{ kind: 'deposit', date: data.cycle.today }`, no `onDelete`/`onSaveRecurrence` for it; wire the add row to `actions.savings ? openSavingsCreateSheet : undefined` (D5) — verify the sheet opens on `/demo`
- [x] 3.2 Switch the accumulated block from `Money` to `AnimatedAmount` (D6) — verify the figure still reads 2.646 € on load
- [x] 3.3 In `app/demo/demo-dashboard.tsx` hold `DemoSavingsEdits` state, pass it to `deriveDemoData`, supply `savings: createDemoSavingsMutations(...)`, and remove `showUnavailable`, the timeout ref and `DemoToast`; delete `components/molecules/demo-toast.tsx` (D7) — verify `grep -rn DemoToast app components` returns nothing

## 4. Strings

- [x] 4.1 Add `hojaGasto.nuevoMovimientoAhorro`, `tipo`, `nombre`, `nombreObligatorio`, `movimientoAhorroAnadido` to `messages/es.json` and `en.json`; change Spanish `resumen.deposito` to "Depósito"; remove `demo.accionNoDisponible` from both (D8) — verify `tsc` (the `HojaGastoKey` type is derived from `es.json`) and the sheet in English shows "Deposit / Withdrawal"

## 5. Tests and verification

- [x] 5.1 Create `tests/savings-create.spec.js` at 390px on `/demo`: a deposit of 50 takes savings 146 → 196, accumulated 2.646 → 2.696 and free margin 974 → 924; a withdrawal of 30 lists "−30 €" with U+2212 and gives 116 / 2.616 / 1.004; Enter with an empty amount keeps the sheet open, adds nothing and marks the amount field (`aria-invalid`); reloading after a deposit shows 146 / 2.646 / 974 — verify `npx playwright test tests/savings-create.spec.js` passes
- [x] 5.2 Run `npx tsc --noEmit`, `npm run lint` and the full `npm test`; all green
- [x] 5.3 Update `CLAUDE.md` *Deuda técnica*: the "UI de ahorro" entry now covers only edit/delete (`add-savings-sheet`) and the missing Supabase `SavingsMutations` — verify the entry no longer says the add row shows the demo message
