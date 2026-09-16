## Why

A category's name, colour and budget can only be changed in SQL. Budgets are what ARCHITECTURE.md calls "la funcionalidad central del dashboard": the *"310 de 400"* header, the progress bar and its colour, the weekly available figure and the bot's "¿cómo vengo?" answer all hang off one `presupuestos` row. The dashboard can display that row and nothing else — it cannot create, change or remove it. Renaming a category or fixing a colour clash has the same problem.

§12 requires the data layer to be swappable from the first component, so this builds the editing UI against an injected contract and leaves the Supabase implementation to the real route.

## What Changes

### A) An entry point on the category card

- A trailing **"more" control** in the card header, between the amount and the chevron: a 20px `MoreHorizontal` in `muted-foreground` inside a 44 × 44 hit area, `pressable`.
- Only on `kind: 'category'` cards. The fixed-expenses card stays read-only (§9 *"resumen, no contenedor"*).
- **BREAKING (internal contract).** The header is one `<button>` wrapping dot, name, amount and chevron (`category-card.tsx:46-67`). Interactive elements cannot nest, so it becomes two sibling controls: the disclosure (keeping `aria-expanded` / `aria-controls` and the open-card border colour) and the new control. Neither target drops below 44px and the name keeps its truncation.
- The accessible name **includes the category** — seven of these are on screen at once, so "Opciones de Comida", never "Opciones". Same rule for the sheet's title.
- **Deviation from ARCHITECTURE.md §9**, recorded in design.md: §9 opens the category menu with a long press and names a visible control as plan B, admitting the discoverability risk. This change promotes plan B to plan A. No gesture is implemented; a gesture is never the only route to a function.

### B) One form sheet, not a menu of actions

- A sibling **`CategorySheet`** sharing the entry sheet's shell rather than a second `EntryConfig`: `EntryConfig<V>` hardcodes the `hojaGasto` namespace and requires a valid amount whenever an amount field exists, so an *optional* budget costs more to absorb than to sit beside.
- Mobile: bottom sheet. Desktop: anchored to the control that opened it (§9; `account-menu.tsx` already does both).
- **Never a sheet on top of a sheet.** Name, colour, budget and the delete confirmation all resolve inside the one surface.
- Same anatomy as the entry sheet: Base UI `Drawer` with `swipeDirection="down"`, `VirtualKeyboardProvider`, a floating `liquid-glass` popup with `rounded-sheet`, a `bg-handle` drag handle, a header of `Cancel` / title + category caption / trailing primary pill, `initialFocus` / `finalFocus` returning focus to the opener, and the dirty-state guard that cancels outside-press and swipe dismissal.
- **Deviation from the §9 menu** (*Cambiar color · Renombrar · Reordenar · divisor · Eliminar*), recorded in design.md: three of those four entries are one field each, and a menu would need a second surface to edit any of them.

### C) What is in the sheet

- **Name** — a text field, unique per user (`unique (usuario_id, nombre)`). A collision reports in place, next to the field, and keeps what was typed.
- **Colour** — the eight swatches of `0004_categorias.sql` inline (lime, amber and red stay out per §9). `DESIGN.md` already gives 28px circular tokens with a 2px inner gap and a 2px active ring; this adds a 44px hit area per token, a hairline ring on every swatch so `blanco` and `gris_oscuro` stay visible against the sheet in both themes, a checkmark on the selected one, radio semantics, and an accessible name that is the colour's name rather than its hex.
- **Budget** — an optional amount field reusing the entry sheet's amount input (`inputMode="decimal"`, currency symbol placed by locale, validation in place that never clears what was typed). **Empty means no budget, and that is also how a budget is removed** — there is no separate "remove" action.
- **Delete category** — destructive, last, after a `border-border` divider, in `destructive-ink`, with confirmation.
- "Añadir gasto" does not move here. It stays the `+` row at the bottom of the open card (`unify-add-action-rows`).

### D) Budgets track; they do not reserve

- Setting a budget makes the progress bar appear on that card; clearing it leaves the plain total. `getBudgetStatus` is unchanged.
- **A budget reserves nothing and never enters the free margin.** Free margin keeps the formula the code already computes:

  ```
  freeMargin = income − savings − spent
  ```

  where `spent` is every non-deleted `gasto` in the cycle, fixed rows included, pending or confirmed.
- Stated as scenarios: setting, raising, lowering or clearing a budget does not move the free margin; spending inside a budget lowers it by exactly that amount, the same as spending in a category with no budget; exceeding a budget lowers it by exactly what was spent — no extra penalty, no double count.
- **No rollover.** Leftover budget is not carried, not swept into savings, not stored: there is no month close (§6). A finished cycle still reads *"310 de 400"*.
- **Documentation drift.** ARCHITECTURE.md describes free margin as `ingresos − fijos − presupuestos` in five places, which contradicts the code. This change aligns the prose to the code and changes no behaviour: §9 item 2 (line 509), the *Cabecera del mes* table row (line 728), *Alcance: qué se sigue y qué no* (line 815), *Presupuestado vs real* (line 852) and its worked example (lines 860-866).

### E) Data contract

- **`CategoryMutations`**, mirroring `ExpenseMutations` in shape and guarantees — each operation resolves once the change is durable and rejects with nothing changed — injected through `DashboardActions`:
  - `update(categoryId, draft)` with the name, the colour and the budget or `null`
  - `delete(categoryId, reassignTo)`

  One `update` rather than three operations, because one form sheet saves once: three calls behind one Save button would need their own partial-failure rules.
- **In-memory implementation for `/demo`**, following `createDemoExpenseMutations` + `DemoExpenseEdits`: an edit log derived on read, never mutating base data, so budget bars, the pie chart, category names and colours, the expenses total and the summary rows all recompute. No Supabase in this change.
- **BREAKING (internal contract).** `DashboardActions` gains `categories: CategoryMutations`. Only the template and the demo wrapper consume it. Controls without an injected handler stay disabled (existing capability).

### F) Copy, tokens, docs

- A new **`hojaCategoria`** namespace in `messages/es.json` and `messages/en.json`, including the eight colour names — they are user-facing labels now, not just DB values. No literal strings in components.
- **No new colour or spacing tokens**: `pressable`, `min-h-target`, `min-h-row`, `px-inset`, `rounded-sheet`, `liquid-glass`, `bg-handle`, `ease-spring` and `destructive-ink` already exist.
- `DESIGN.md` gains only what its inventory does not cover: the hit area, hairline and checkmark on the swatch-picker entry, and a "more" control entry.

**Out of scope:**

- Any change to how the free margin is computed, and any "reserved" or "before → after" display.
- Creating categories — the "Añadir categoría" card does not exist yet (separate proposal).
- Reorder mode and drag handles (§9, phase 3), including the *Reordenar* entry of the §9 menu.
- Moving a single expense between categories (that is the row menu).
- The fixed-expenses definition screen and any `gastos_fijos` write.
- The Supabase implementation and the real dashboard route.
- Budget alerts over WhatsApp, and budgets suggested from history (phase 3).
- Desktop layout beyond anchoring the surface to its opener.

## Capabilities

### New Capabilities

- `category-editing`: the category sheet (entry point, layout, name, colour and budget fields, validation, saving and error states), deleting a category with its expenses reassigned, what a budget does and does not affect, and the injected category operations.

### Modified Capabilities

- `dashboard-ui`:
  - *Expense card states*: the card header splits into a disclosure and an options control; only category cards get the options control; the budget bar follows the presence of a budget.
  - *Controls without a handler are disabled*: now covers the category operations.
  - *Public demo route*: category editing works in memory, and the free margin holds at 974 € across every category change.
- `design-system`:
  - *Translucent materials*: the category sheet and its scrim join the allowlist.
  - *Motion respects user preference*: now covers the category sheet.

`expense-editing` is **not** modified: no expense behaviour changes, and the free-margin figures in its scenarios stay exactly as they are.

> `openspec/specs/` is still empty because no change has been archived. `dashboard-ui` and `design-system` are defined by `land-finance-dashboard`, `restyle-dashboard-to-v0`, `refine-mobile-ui-apple-hig`, `unify-add-action-rows` and `add-expense-sheet`. Archive this change after those five.

## Impact

- **Data contract:** a new `lib/data/categories.ts` (`CategoryDraft`, `CategoryMutations`, the duplicate-name rejection) and `categories` on `DashboardActions` in `lib/data/dashboard.ts`.
- **Components:** a new `components/organisms/category-sheet.tsx`, a new colour-swatch molecule, and changes to `components/organisms/category-card.tsx` (the header split) and `components/templates/dashboard-template.tsx` (mounting and orchestration).
- **Demo:** a new `lib/demo/demo-categories.ts`, a derivation order added to `lib/demo/demo-expenses.ts`, and `app/demo/demo-dashboard.tsx`.
- **Messages and docs:** `messages/es.json`, `messages/en.json`, `DESIGN.md`, and the five ARCHITECTURE.md passages listed in D.
- **Dependencies:** none new. `Drawer` comes from `@base-ui/react` 1.8.0, already installed.
- **Database:** no migration. `categorias` and `presupuestos` already carry everything this needs, and `presupuestos.categoria_id` is `on delete cascade`, so a deleted category takes its budget row with it.
- **CSS:** none expected. Every token this needs already exists.
