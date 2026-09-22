## Why

"Añadir movimiento de ahorro" is the last add row on `/demo` that still answers with the "not available in the demo" message: expenses, income and categories already change the page in memory. Savings has no mutation contract at all (`CLAUDE.md` → *Deuda técnica*, "UI de ahorro"), so the real route has nothing to implement either.

## What Changes

- New `SavingsMutations` contract in `lib/data/`, shaped like `ExpenseMutations` (injected by the page, resolves once durable, rejects with nothing changed), with a single operation `addSavingsMovement` taking a deposit or a withdrawal with a positive amount, a name and a date. The real route stays unimplemented, like every other contract today.
- In-memory implementation in `lib/demo/`. After each add the demo recomputes from the resulting movements — never by adding to the displayed figures — the cycle's savings total, the accumulated balance, the last point of the savings history, the progress against the target, and the free margin.
- **BREAKING (internal)**: `DashboardActions.addSavingsMovement(): void` is replaced by `DashboardActions.savings: SavingsMutations`. Only `/demo` mounts the dashboard today.
- Activating the "add savings movement" row opens a bottom sheet built from the entry sheet: a Deposit / Withdrawal segmented selector (deposit by default), a required name, an amount with the numeric keyboard, and a date defaulting to the cycle's today. A withdrawal is stored as negative savings (ARCHITECTURE §7); the user always types a positive amount.
- The new movement is listed in the savings panel in date order; the savings total, the accumulated balance and the free margin animate to their new values.
- The "not available in the demo" message loses its last caller and is removed.
- New strings in `messages/es.json` and `en.json`; the selector reuses `resumen.deposito` and `resumen.retiro`, and the Spanish `resumen.deposito` changes from "Ingreso" to "Depósito".
- Out of scope: editing and deleting movements, editing the target, opening a savings sheet from the accumulated block — all in `add-savings-sheet`.

## Capabilities

### New Capabilities
- `savings-editing`: the savings mutation contract, the add-movement sheet, its fields and validation, and what a saved movement moves on the dashboard.

### Modified Capabilities
- `dashboard-ui`: *Public demo route* — the savings add control stops showing the "not available" message and adds movements in memory; *Savings target and history on the demo* — the savings figures and the history's last point are recomputed from the movements after each add.

## Impact

- `lib/data/savings.ts`, `lib/data/dashboard.ts` (`DashboardActions`), new `lib/demo/demo-savings.ts`, `lib/demo/demo-expenses.ts` (`deriveDemoData`).
- `components/organisms/entry-sheet.tsx` (a segmented field kind and required text fields), `components/templates/dashboard-template.tsx` (savings sheet target, accumulated block as `AnimatedAmount`), `app/demo/demo-dashboard.tsx`, `components/molecules/demo-toast.tsx` (removed).
- `messages/es.json`, `messages/en.json`.
- New Playwright spec `tests/savings-create.spec.js`.
- No database, network or dependency change.
