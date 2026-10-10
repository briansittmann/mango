## Why

The "Gasto por día" calendar tells how much went out each day but not on what: the tooltip carries the total and the row count, and finding the rows means opening category cards one by one. Brian wants to tap a day and read it.

## What Changes

- **A day opens its detail.** Tapping, clicking or pressing Enter on a calendar cell up to today opens a sheet (a right side panel at `lg`, like every sheet) with that day's spent rows grouped by category, each category with its subtotal, and the day's total. The rows are the ones the cell counts (paid, no pending fixed charges, no projected charges), so the total always matches the cell. Future cells have no action.
- **Moving between days.** The top of the sheet has a day selector laid out like the compact month selector of the floating bar: previous and next arrows around the day's name. The arrows stop at the cycle's first day and at today (the cycle's last day for a past cycle).
- **A calendar to jump.** Tapping the day's name unfolds, in place under the selector, a grid of the cycle's days on the same heat ramp; choosing a day shows it and folds the grid.
- **Rows edit.** Tapping a row closes the detail and opens the expense sheet for that row.
- On touch, a tap on a cell opens the detail instead of toggling the tooltip; hover and focus keep the tooltip.

## Capabilities

### Modified Capabilities

- `spend-insights`: *Spend calendar widget* — cells up to today open the day detail; new requirement *Day detail*.

## Impact

- `lib/data/weekly-spend.ts` (`dayExpenses`, pure, with tests), `components/organisms/spend-calendar.tsx` (`onSelectDay`), new `components/molecules/day-selector.tsx` and `components/organisms/day-sheet.tsx`, `components/templates/dashboard-template.tsx` (state and mount), `messages/*.json` (`graficos`), `tests/spend-calendar.spec.js`.
- No data access, no migration: the detail reads the rows the dashboard already holds, so it only reaches the displayed cycle.
