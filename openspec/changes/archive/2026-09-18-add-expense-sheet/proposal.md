## Why

The dashboard shows expenses but cannot change them. Today a wrong amount, a duplicate, or an expense the bot missed can only be fixed through WhatsApp, which reaches only the last transaction (ARCHITECTURE.md §4). On `/demo`, "Añadir gasto" shows "not available", so a visitor never sees the loop the demo exists for (§12): log an expense and watch the free margin move.

§12 also requires the data layer to be swappable from the first component. Building the editing UI now against an injected contract means the real route only has to supply a Supabase implementation later.

## What Changes

- **One entry sheet for creating and editing expenses.** It is a floating glass panel with the same layout in both modes. The fields come from a field configuration; for expenses they are amount, description and date.
  - **Create:** opened from "Añadir gasto" at the bottom of an open category card. The category is fixed by that card, the amount is empty and the date defaults to today.
  - **Edit:** opened by tapping an expense row, with its fields preloaded. Adds a Delete action at the bottom, after a divider.
  - The amount field is focused with the decimal keypad as soon as the sheet opens.
  - Loading and error states: saving and deleting show progress. On failure the sheet stays open with an error message and the typed values intact.
- **Fixed-expenses card.** Its rows are ordinary transactions (`es_fijo = true`):
  - Tapping a row edits this cycle's charge only (amount, description, date), and the sheet header says so.
  - Swiping a row soft-deletes this cycle's charge, and the definition stays active.
  - The `gastos_fijos` definition is never read or written from this card.
  - The card has no add row.
- **Swipe to delete** on every expense row:
  - A red panel with a trash icon covers about a quarter of the row width.
  - The row slides over it as a solid surface with a shadow.
  - A long swipe deletes without tapping the button.
- **One delete operation.** Swipe, long swipe and the sheet's Delete all soft-delete the expense (`borrado_en`), never `DELETE`. Each one shows an undo toast instead of a confirmation. Soft-deleted expenses count nowhere: no list, total, budget, chart or free margin.
- **Amounts look editable at rest.** Amounts in expanded cards get a subtle rounded surface instead of plain text.
- **Injected expense operations: create, update, soft delete, restore.** Components call only this interface. `/demo` supplies an in-memory implementation now; the real route will supply a Supabase one with the same signatures.
- **`/demo` supports full expense editing.** Create, edit, delete and undo change React state only. Card totals, budget bars, the expenses total, both charts and the free margin recompute. Reload resets the data, and there are no Supabase requests and no login. "Añadir ingreso" and "Añadir movimiento de ahorro" keep their "not available" message.
- **BREAKING (internal contract).** `DashboardActions.addExpense(groupId)` is replaced by the injected expense operations, and `DashboardData.cycle` gains `today`. Only the template and the demo wrapper consume them.
- **Tokens and docs:**
  - a destructive fill token pair with readable contrast for the swipe panel
  - `DESIGN.md`'s bottom-sheet entry updated to the floating panel (it still describes flat bottom edges)
  - new swipe-action and undo-toast entries in `DESIGN.md`

**Out of scope:**
- Reorder mode (separate proposal).
- **The fixed-expense form**, and with it:
  - the nombre, monto, día del mes and categoría fields
  - writes to `gastos_fijos`
  - deactivating vs deleting a definition
  - `activo` vs a `borrado_en` column on `gastos_fijos`

  This is a dependency on the §7 fixed-expenses screen proposal. The sheet's field configuration is designed so that form is a second configuration, not a second sheet.
- The Supabase implementation of the operations and the `borrado_en IS NULL` filters in real queries. They ship with the real dashboard route (roadmap steps 2–3).
- Changing an expense's category, the income and savings add flows, and a desktop-specific presentation.

## Capabilities

### New Capabilities
- `expense-editing`: the entry sheet (modes, field configuration, fields, saving and error states), its entry points, swipe to delete, soft delete with undo, and the injected expense operations.

### Modified Capabilities
- `dashboard-ui`:
  - *Expense card states*: rows open the sheet and can be swiped, amounts look editable, and only category cards end with an add row.
  - *Add action rows*: the expense add row appears on category cards only.
  - *Controls without a handler are disabled*: now covers editing and deleting expenses.
  - *Public demo route*: expense editing works in memory; the income and savings add rows keep their message.
- `design-system`:
  - *Translucent materials*: the entry sheet and its scrim join the allowlist.
  - *Motion respects user preference*: now covers the entry sheet, row swipes and the undo toast.

> `openspec/specs/` is still empty because no change has been archived. `dashboard-ui` and `design-system` are defined by `land-finance-dashboard`, `restyle-dashboard-to-v0`, `refine-mobile-ui-apple-hig` and `unify-add-action-rows`. Archive this change after those four.

## Impact

- **Data contract:** `lib/data/dashboard.ts` (`DashboardActions`, `cycle.today`) and new types in `lib/data/expenses.ts`.
- **Components:**
  - a new entry-sheet organism
  - new swipe, field-row and undo-toast molecules
  - `components/molecules/expense-row.tsx`, `components/organisms/category-card.tsx` and `components/templates/dashboard-template.tsx`
- **Demo:** `lib/demo/demo-data.ts` (`today`), a new `lib/demo/demo-expenses.ts`, and `app/demo/demo-dashboard.tsx`.
- **CSS, messages and docs:** `app/globals.css`, `messages/es.json`, `messages/en.json` and `DESIGN.md`.
- **Dependencies:** none new. Drawer and Toast come from `@base-ui/react` 1.8.0, which is already installed.
- **Database:** no migration. `transacciones.borrado_en` already exists (`0008_transacciones.sql`).
- **Documentation drift:** the sheet supersedes ARCHITECTURE.md §9 *Edición en el lugar* and *Menú de fila individual*. See design.md → Open Questions.
