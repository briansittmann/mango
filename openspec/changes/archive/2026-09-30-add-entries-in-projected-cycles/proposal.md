## Why

A projected cycle today is read-only (`cycle-projection` → *What a projected cycle shows and allows*): it lists the recurring charges and the inherited budgets, and nothing else. The user often already knows about a future cycle more than its recurring charges — a trip, an extra income, a planned deposit — and has nowhere to put it, so the projected free margin is optimistic exactly when it matters. Letting the user enter expenses, income and savings in the six projected cycles makes the future margin reflect what they already know, with the same sheets they use in the cycle in progress.

## What Changes

- A projected cycle accepts creating, editing and soft-deleting (with undo) expenses and income entries, and adding savings movements, through the existing `entry-sheet`, swipe-to-delete and savings sheet. The date defaults to the cycle's first day and stays inside the cycle's range. The recurrence switch is not offered from a projected cycle.
- `resumenMensual` (projection branch) reads the real rows dated inside the projected cycle and merges them with the charges of `proyectarCiclo`: a real row linked to a definition for that cycle replaces its projected charge; projected charges stay read-only and are never written. Nothing writes budgets or moves `ciclo_generado_hasta`.
- The free margin of a projected cycle applies the same envelope rule (`getFreeMargin`) to manual rows plus projected charges. A budgeted card in a projection keeps its empty bar until the category holds a real row; from then on it shows spent-of-budget like the cycle in progress, with the projected charges included. The savings target acts as an envelope: the projected cycle's savings are the larger of the target and its real movements.
- The cron (`generar_ciclo`, 0021) is verified, not changed: `on conflict (movimiento_recurrente_id, ciclo_mes) do nothing` already keeps a definition that has a row in the cycle from being inserted twice, and manual rows have no definition so the cron never touches them.
- `/demo` keeps manual entries per projected cycle in memory and merges them the same way (`projectDemoCycle`), so the sample cycle never shows a row entered in a projection and vice versa.
- Tests: a Playwright spec on `/demo` (add, edit, delete with undo in a projected cycle; margin, card and bar updated; the sample untouched) and a unit test for the merge of real rows with projected charges.

Out of scope: reordering categories or creating a category from a projected cycle, editing definitions from there (already possible), editing or deleting a savings movement (not possible in any cycle yet), planning a new recurrence from a projected cycle, and the bot.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

The deltas below are written over the versions in the open change `add-cycle-projection-and-recurring-cron`, whose specs for `cycle-projection`, `dashboard-data` and `dashboard-ui` have not been synced to `openspec/specs/` yet.

- `cycle-projection`: a projected cycle merges its real rows with the projection; it allows entries (add rows, editable rows, no recurrence switch); the bar shows spending once a category holds a real row; the savings target is an envelope; the demo keeps manual entries per projected cycle.
- `dashboard-data`: a projected cycle is supplied with its own rows merged into the projection; the create/update/delete operations accept a date in a projected cycle and write nothing else (no `ciclo_mes`, no budget, no marker).
- `dashboard-ui`: budget progress in a projected cycle depends on whether the category holds a real row.
- `expense-editing`: the create-mode date defaults to the first day of a projected cycle; no recurrence switch in a projection; scenarios for add, edit and delete-with-undo in a projected cycle.
- `income-editing`: same date default and recurrence rule; scenario for an income entry in a projected cycle.
- `savings-editing`: the sheet opens in a projected cycle with its first day; a movement in a projection moves the cycle's savings and the free margin under the envelope rule.

## Impact

- `lib/data/projection.ts`: a pure merge function (real rows + projected charges), with a unit test in `lib/data/projection.test.mjs`.
- `lib/data/supabase/dashboard.ts`: the projection branch queries the projected range and merges; budget status and savings follow the new rules. No migration: manual rows are ordinary confirmed `transacciones` without `ciclo_mes`.
- `lib/demo/demo-expenses.ts` (and the demo income/savings edit types): manual entries bucketed by the cycle their date falls in; `projectDemoCycle` merges them.
- `components/templates/dashboard-template.tsx`, `category-card.tsx`, `budget-progress.tsx`, `entry-sheet.tsx`: the `projected` gating narrows to what stays read-only (projected charges, category creation, reorder, chart, accumulated savings, recurrence switch).
- Specs listed above; `tests/projected-entries.spec.js`; `CLAUDE.md` status and `ARCHITECTURE.md` §9.
- No change to `app/dashboard/actions.ts`, the Supabase mutation adapters, the cron route or the database functions.
