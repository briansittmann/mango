## Why

Recurring things in Mango (fixed expenses, fixed income, categories with budgets) change over time, and today each surface decides the scope on its own: a charge row changes only this month, "Próximos cobros" changes every month, a projected charge cannot be touched at all, income definitions cannot be edited, and deleting a category rewrites its whole history. Brian needs one rule he can predict: every change to something that repeats asks whether it applies to **this month only** or **from this month on**, and never reaches back. Savings movements also cannot be deleted, and an expense cannot be moved to another category, which is what blocks cleaning up a category before deleting it.

## What Changes

- **One scope question for everything that repeats.** Editing or deleting a row that comes from a recurring definition (expense or income), in the cycle in progress or in a projection, asks "Solo este mes" / "Desde este mes en adelante", the same pair the category sheet already asks for a projected budget. Nothing ever changes an earlier cycle.
- **Projected charges become editable.** A projected recurring charge or income entry opens the entry sheet and can be swiped. "Solo este mes" holds that cycle's slot with a real row (or a deleted one), "Desde este mes en adelante" changes the definition from that cycle on.
- **Recurring income is editable** through the income panel with the same question. This closes the gap left by `add-income-management` ("Definiciones recurrentes de ingreso sin edición").
- **Swipe stays "this month only".** A swipe on a recurring row deletes only that cycle's slot, with undo. The sheet's delete asks the question.
- **Savings movements can be deleted**: swipe and the savings sheet's delete action, soft delete with undo, like income.
- **Moving an expense between categories.** In edit mode, the entry sheet's header category becomes a control that opens a category picker. On a recurring charge, the scope question decides whether the definition moves too.
- **Categories live from their first cycle.** A category created in a cycle, projection included, exists from that cycle on, with its budget from that cycle on. "Añadir categoría" is offered in projections.
- **Deleting a category asks "Desde este mes en adelante" / "Todos los meses".** From this month on archives it: earlier cycles keep it with their expenses, and this cycle's and later expenses and its fixed charges go to the receiving category. All months is today's delete. **BREAKING** for the `CategoryMutations.delete` contract.
- **Plan counts are recounted, not incremented.** The cron sets a plan's count from the rows it holds, so slots written ahead of time are counted once.

Out of scope: widgets missing from projected cycles (to be discussed separately), the bug where switching language shows every figure as 0 until reload, and editing a savings movement.

## Capabilities

### New Capabilities
<!-- none -->

### Modified Capabilities
- `recurring-expenses`: *Where you touch decides what you change* becomes the scope question; adds per-cycle operations on a definition's slot (edit, delete, restore, only/onward).
- `expense-editing`: update may change the category; entry points for recurring and projected charges ask the scope; the edit-mode header category picker.
- `income-editing`: a recurring income entry asks the scope instead of editing this month only; its definition becomes editable.
- `savings-editing`: soft delete and restore of a movement, with swipe, undo and the sheet's delete action.
- `category-editing`: delete takes a scope ("from this month on" archives, "all months" deletes); a category's lifetime (first and last cycle).
- `category-creation`: create takes the displayed cycle; the category and its budget start there.
- `cycle-projection`: projected charges are editable and swipeable; a deleted linked row holds its slot; the add-category tile is offered; categories outside their lifetime are hidden.
- `recurring-charge-generation`: a plan's count is recounted from its rows after each generated cycle.

`cycle-projection`, `recurring-charge-generation` and the category-editing and projection deltas this change builds on belong to the open changes `add-cycle-projection-and-recurring-cron` and `add-entries-in-projected-cycles`. This change is written over them and SHALL be archived after both.

## Impact

- **Database**: new migration `0024`: `categorias.desde_ciclo` and `hasta_ciclo`; the category name unique only among live categories; `crear_categoria` and `eliminar_categoria` with cycle and scope; new `security invoker` functions to edit, delete and restore a definition's slot in a cycle, only or onward; `generar_ciclo` recounts plans.
- **Contracts** (`lib/data/`): `ExpenseDraft` gains `categoryId` on update; `RecurringMutations` gains `editInCycle`, `deleteInCycle` and `restoreInCycle`; `SavingsMutations` gains `softDelete` and `restore`; `CategoryMutations.create` takes the cycle and `delete` takes a scope.
- **Implementations**: `lib/demo/*` and `lib/data/supabase/*`, plus the server actions in `app/dashboard/actions.ts`; `lib/data/projection.ts` (`mezclarProyeccion` receives deleted slots) and `lib/data/supabase/dashboard.ts` (`resumenMensual` filters categories by lifetime).
- **UI**: `entry-sheet` (scope question, header category picker), `category-sheet` (delete scope, create in a projection), `dashboard-template.tsx` (projected rows editable, savings swipe, add-category tile in projections); a shared scope-choice control extracted from the category sheet.
- **Bot**: category matching by name looks only at categories alive in the cycle in progress.
- **i18n**: new strings in `messages/es.json` and `messages/en.json`.
