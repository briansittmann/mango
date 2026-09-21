## Why

The dashboard can only tell the truth about half of a cycle. Expenses can be added, edited and deleted; income cannot — `addIncome` is wired to the demo's "not available" message and the income panel renders two fixed sample sources with an estimated amount that no table feeds. The free margin is *income − expenses − savings*, so until income is editable the headline number of the whole product is a constant nobody can correct.

The pieces to fix it already exist: one entry sheet driven by a field configuration, a swipe-to-delete row with undo, an add-action row, and a recurrence toggle that writes a definition. This change gives income the same treatment expenses got, by reusing those pieces rather than building an income screen.

## What Changes

**Income becomes a list of entries, not a list of estimated sources.** **BREAKING** (data contract, not a shipped product): `DashboardData.income.sources` — `{ id, name, estimated, actual }` — is replaced by `income.entries`, dated rows shaped like `Expense`. The muted "estimado" reference disappears from the panel; the `ingresos_esperados` "floor of the month" idea (ARCHITECTURE.md §8) stays unbuilt and unread, to be revisited on its own if it is ever wanted. The demo's income total stays 2 820 €, so the free margin stays 974 €.

- **Add, edit, delete.** The income panel lists each entry with the row pattern the category cards use: the amount on an editable-looking surface, the row opening the entry sheet in edit mode, a leftward swipe revealing delete, deletion soft and undoable from a toast, and an "Añadir ingreso" row last (*Add action rows*).
- **One sheet, a second configuration.** `EntrySheet` is opened with an income configuration instead of the expense one: same amount, description and date fields, same recurrence toggle, different title, submit, delete and announcement strings, and no category in the header caption — income entries have no category. No new sheet component.
- **Recurring income.** The existing toggle creates a definition for income the same way it does for an expense: day of the month, and either "sin final" or a number of repetitions.
- **A salary is not a charge.** "Próximos cobros" keeps listing expense charges only. An income recurrence never appears there, and never reaches the committed-this-cycle total.
- **Mutation contracts.** `lib/data/income.ts` adds `IncomeMutations` (create, update, soft delete, restore) alongside `ExpenseMutations`; `RecurringMutations.create` and `RecurringDefinition` learn a movement type and a nullable category. `lib/demo/demo-income.ts` implements them in memory. No component reads data on its own.
- **Schema.** Migration `0015` (not `0014` — taken by `0014_categorias_colores_extra.sql`) renames `gastos_fijos` to `movimientos_recurrentes`, adds `tipo` (`gasto` | `ingreso` | `ahorro`, default `gasto`), makes `categoria_id` nullable with a check that requires it when `tipo = 'gasto'`, keeps `repeticiones_totales` / `repeticiones_insertadas`, and moves the RLS policy to the renamed table. `transacciones.categoria_id` becomes nullable under the same check.
- **Strings.** New keys in `messages/es.json` and `messages/en.json`; no literal text in components.
- **Tests.** Playwright specs on `/demo`: add an income entry, edit one, delete one and undo, and add a recurring income entry without it appearing in "Próximos cobros".

**Not in this change:** the cron that inserts recurring movements; the Supabase-backed data layer; savings entry UI (`tipo` already admits `ahorro`, the panel comes later); an entry point for editing or stopping an income recurrence definition once created — the definition sheet opens from "Próximos cobros", which income never reaches, so an income recurrence is corrected by deleting the entry and adding it again.

## Capabilities

### New Capabilities
- `income-editing`: adding, correcting and removing income entries from the income panel — the injected operations, the entry sheet's income configuration, fields and validation, saving and errors, swipe to delete, delete with undo, and how income changes move the income total and the free margin.

### Modified Capabilities
- `dashboard-ui`: the income panel lists dated entries instead of sources with an estimated reference; the income column's rows and add row become real data actions (the "not available in the demo" message survives only for savings); "Controls without a handler are disabled" gains the income-operations case; the demo sample gains income entries, one of them recurring.
- `upcoming-charges`: the card states explicitly that only expense charges are listed — an income recurrence is never a charge and never counts in the committed total.

## Impact

- **Schema:** `supabase/migrations/0015_movimientos_recurrentes.sql`; `gastos_fijos` → `movimientos_recurrentes` with `tipo` and a nullable `categoria_id`; `transacciones.categoria_id` nullable and `transacciones.gasto_fijo_id` renamed to `movimiento_recurrente_id` (no TypeScript reads either column today, so the rename costs one migration and avoids a permanently misnamed link).
- **Contracts:** `lib/data/dashboard.ts` (`DashboardData.income`, `DashboardActions`), new `lib/data/income.ts`, `lib/data/recurring.ts`.
- **Demo:** new `lib/demo/demo-income.ts`; `lib/demo/demo-data.ts` and `lib/demo/demo-expenses.ts` (income entries resolved and totalled, free margin recomputed); `app/demo/demo-dashboard.tsx`.
- **UI:** `components/templates/dashboard-template.tsx` (income panel, sheet targets), `components/organisms/entry-sheet.tsx` (income configuration, category-less caption); reused unchanged: `expense-row`, `swipe-to-delete`, `undo-toast`, `add-row`.
- **i18n:** `messages/es.json`, `messages/en.json`.
- **Tests:** new specs under `tests/`; existing `recurring-*.spec.js` and `example.spec.js` keep their current figures, since the demo's income total does not move.
