## Why

Real users are tripping on savings (Brian, 2026-10-14). A savings movement can only be swiped away: tapping it in the savings panel or in "Movimientos" does nothing, while expenses and income open their sheet. And a first-time user who wants to bring in what they already have saved has no honest way to do it: a deposit is subtracted from this month's free margin, so loading 5.000 € saved over years leaves the month in the red, and the workaround (an income plus a deposit) inflates the income.

## What Changes

- **Edit a savings movement**: tapping a movement in the savings panel or in the "Movimientos" card opens the savings sheet in edit mode ("Editar movimiento", "Guardar"), with type, name, amount and date filled in and a delete action ("Eliminar movimiento") that leaves the same undo toast as the swipe. The savings operations gain an **update**.
- **"Ya lo tenía ahorrado"**: a switch in the savings sheet, shown only for a deposit, in create and edit mode, with the line "Suma a tu acumulado sin restar de tu margen libre". A deposit marked this way counts in the accumulated balance from its date on, but not in the month's savings total, the free margin or the projection's savings floor. Its rows say so ("Ya ahorrado") in the savings panel and in "Movimientos".
- **Database**: one additive column, `transacciones.ahorro_previo boolean not null default false`, with a check that only a positive savings row can carry it (migration `0033`). Every existing row and every bot load stays a regular movement.
- The bot does not learn the mark: what it loads by chat is always a regular movement.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `savings-editing`: the operations gain *update*; the sheet gains edit mode and the "Ya lo tenía ahorrado" switch; a new requirement defines what an already-saved deposit counts in; the delete requirement drops "no way to edit a movement" and adds the sheet's delete.
- `dashboard-data`: *Summary figures include savings* (the savings total leaves already-saved deposits out, the accumulated balance keeps them) and *Every dashboard operation persists* (updating a savings movement writes its signed amount, name, date and mark).
- `transaction-list`: *Row actions* (a savings row opens the savings sheet) and *Movement rows* (an already-saved deposit names it on its muted line). This delta is written over `add-transaction-list`'s new spec, so this change archives after that one.

## Impact

- `supabase/migrations/0033_ahorro_previo.sql` (additive, applied to the real database before the deploy, with Brian's confirmation).
- `lib/data/savings.ts` (`SavingsMovementDraft.alreadySaved`, `SavingsMutations.update`), `lib/data/dashboard.ts` (`savings.movements[].alreadySaved`), `lib/data/supabase/savings.ts`, `lib/data/supabase/dashboard.ts` (`resumenMensual`: savings total, projection floor and accumulated balance), `lib/demo/demo-savings.ts`, `lib/demo/demo-expenses.ts`, `app/dashboard/actions.ts` (server action for the update).
- `components/organisms/entry-sheet.tsx` (a switch field shown under a condition; savings edit mode), `components/molecules/savings-movement-row.tsx` (activatable), `components/molecules/movement-row.tsx` and `components/organisms/movements-card.tsx` (savings rows open the sheet), `components/templates/dashboard-template.tsx` (savings edit target, save and delete), `lib/csv.ts` (the mark in the status column).
- `messages/es.json`, `messages/en.json`.
- Tests: `tests/savings-edit.spec.js` (new), `tests/movements.spec.js` ("a savings row opens nothing" becomes "opens the savings sheet"), unit tests for the savings figures.
- No change to the bot, the cron or the projection of recurring charges.
