## Context

- **Recurring rows today.** A charge row in a category card edits only its own row (`ExpenseMutations.update`), and the definition sheet from "Próximos cobros" edits the definition (`RecurringMutations.update`, which rewrites this cycle's charge while it is pending). Projected charges (`proj:<definicion>` ids, `projected: true`) are read-only: no sheet and no swipe (`dashboard-template.tsx`, `projected` gating). Income definitions have no edit path at all.
- **Slots already exist.** `transacciones` has a unique `(movimiento_recurrente_id, ciclo_mes)` that counts soft-deleted rows (`0021`), `generar_ciclo` inserts with `on conflict do nothing`, and `mezclarProyeccion` (`lib/data/projection.ts`) drops a projected charge whose `(definition, cycle)` is held by a real row. What is missing is passing soft-deleted linked rows into the merge.
- **Budgets per cycle** already have "only / onward" semantics for projections (`CategoryUpdateTarget`, `actualizar_categoria` with `periodo` and `alcance`, `0022`), with the same pair of labels (`categoria.soloEsteMes` / `desdeEsteMes` in `messages/*.json`, rendered in `category-sheet.tsx:318`).
- **Categories** have no dates (`categorias`: `id`, `usuario_id`, `nombre`, `orden`, `color`; `unique (usuario_id, nombre)` from `0004`). `eliminar_categoria` (`0017`) moves every `transacciones` row and every `movimientos_recurrentes` row to `p_reasignar_a`, then deletes.
- **Plan counts** are incremented by `generar_ciclo` on each insert and by `crear_movimiento_recurrente` when it claims the current charge.
- **Savings** only has `SavingsMutations.addSavingsMovement`; the panel lists `data.savings.movements` without a swipe.
- Written over two open changes (`add-cycle-projection-and-recurring-cron`, `add-entries-in-projected-cycles`); archive after both (as `add-entries-in-projected-cycles` D8).

## Goals / Non-Goals

**Goals:**
- One rule for anything that repeats: "Solo este mes" or "Desde este mes en adelante", never backwards.
- No new concept for "only this month" on a definition: it is the cycle's slot, which the schema already has.
- Categories get a lifetime so a delete can keep history and a category can start in a future month.

**Non-Goals:**
- Editing a savings movement (only delete/restore).
- "Solo este mes" for a category delete (hide one month and come back). Not asked for; see Open Questions.
- The widgets missing from projected cycles, and the language-switch bug that shows zeros until reload: separate work.
- Changing the definition sheet from "Próximos cobros": it keeps meaning "from the cycle in progress on".

## Decisions

### D1 — "Only this month" is the cycle's slot
Editing a definition's row with "only" writes the row linked to `(definition, ciclo_mes)`: update it when it exists, otherwise insert a pending row. Deleting with "only" soft-deletes it, or inserts it soft-deleted. The unique key and `on conflict do nothing` already make the cron respect it. `mezclarProyeccion` gets the linked rows including soft-deleted ones; `resumenMensual` reads them (only `movimiento_recurrente_id`, `ciclo_mes` for deleted rows) and never lists them.
*Alternative:* a per-cycle exceptions table. Rejected, because it would duplicate what the unique key already guarantees.

### D2 — "From this month on" freezes the cycles in between, then edits the definition
From cycle X, with P the cycle in progress:
1. For every cycle strictly between P and X with no slot, insert a pending linked row with what the projection shows today (`proyectarCiclo` for that cycle, the same computation the cron uses).
2. Update the definition (`monto_actual`, `dia_del_mes`, `nombre`, `categoria_id`).
3. Rewrite every **pending** linked row of cycle ≥ X with the new values (date recomputed with `fechaEnCiclo`). Confirmed rows are untouched.
When X = P, step 1 is empty, and step 3 covers this cycle's pending charge, which matches today's definition update. Later "only" exceptions are overwritten in step 3, the way calendar apps treat "this and following".
*Alternative:* versioned definitions (`desde_ciclo`/`hasta_ciclo`, split in two on each onward edit). Rejected. Splitting breaks the plan counter and progress ("4 de 6"), the bot's one-definition-per-name matching and "Próximos cobros", and the horizon is only six cycles, so at most five rows are frozen.

### D3 — "Delete from this month on" = freeze, delete slots, stop
Freeze the cycles between P and X as in D2. Soft-delete every linked row of cycle ≥ X: pending ones, plus X's own row even if confirmed, since the user asked to delete it. Then set `activo = false`. A frozen row keeps its cycle, so the projection and the cron treat it as any held slot. When X = P, nothing is frozen, and this cycle's charge is soft-deleted before stopping.

### D4 — Plan counts are recounted
`generar_ciclo`, after inserting a cycle C, sets `repeticiones_insertadas = count(linked rows with ciclo_mes <= C, deleted included)` for every plan of the user. It turns inactive at `>= repeticiones_totales`. Frozen and "only" rows written ahead are counted when their cycle is generated, exactly once, and a second run changes nothing. `crear_movimiento_recurrente` keeps claiming and counting the current charge, and the recount agrees with it because the claimed row is ≤ C. `proyectarCiclo` keeps `done + n <= total`: ahead slots sit inside that window and are replaced through `mezclarProyeccion`.
Consequence (in the spec): a skipped instalment counts, so the plan's end does not move.

### D5 — Three slot operations on `RecurringMutations`
```ts
type SlotEntry = { amount: number; description: string; date: LocalDate; categoryId: string | null }
editInCycle(definitionId: string, cycle: LocalDate, entry: SlotEntry, scope: 'only' | 'onward'): Promise<void>
deleteInCycle(definitionId: string, cycle: LocalDate, scope: 'only' | 'onward'): Promise<void>
restoreInCycle(definitionId: string, cycle: LocalDate): Promise<void>
```
The template routes a row through these whenever it has a definition (`recurring.definitionId` on income, the linked definition on an expense, or a `proj:` id). Other rows keep going through `ExpenseMutations`/`IncomeMutations`. Swipe calls `deleteInCycle(..., 'only')` and undo calls `restoreInCycle`. In Supabase each operation is one `security invoker` function in `0024`, with `p_usuario_id` explicit as in `0017`, so every step is atomic. The demo mirrors them in `lib/demo/demo-recurring.ts` over its in-memory rows.

### D6 — One scope control, extracted from the category sheet
The radio group in `category-sheet.tsx` (~l.300–330) moves to `components/molecules/scope-choice.tsx` with the same labels and styling. The category sheet (budget), the entry sheet (save) and the entry sheet's delete step use it. For a delete, the two options are the destructive actions themselves (two rows in destructive colour), with Cancel first. The entry sheet's header caption for a linked row changes from "Solo el cargo de este mes" (`hojaGasto.soloEsteMes`, which disappears) to "Se repite cada mes".

### D7 — Category lifetime as two nullable cycle dates
`categorias.desde_ciclo date null` and `hasta_ciclo date null`, both cycle-start dates like `presupuestos.periodo`. Existing rows stay `null/null`. A category is alive in cycle S iff `(desde is null or desde <= S) and (hasta is null or S <= hasta)`.
- `crear_categoria` takes `p_periodo` and writes `desde_ciclo`; with a budget it writes that cycle's entry with the "onward" rule of `0022` (materialising inherited rows first).
- `eliminar_categoria` takes `p_periodo` and `p_alcance` (`'desde'` | `'todos'`). With `'desde'` and `desde_ciclo` not equal to `p_periodo`, it moves the rows with local `fecha >= p_periodo` and every definition to `p_reasignar_a`, deletes the `presupuestos` with `periodo >= p_periodo`, and sets `hasta_ciclo` to the cycle before. Otherwise it keeps today's behaviour.
- The unique `(usuario_id, nombre)` becomes a partial unique index `where hasta_ciclo is null`. A category ended in the future (its `hasta_ciclo` is set but still ahead) reserves its name only through that index. The spec only frees names of categories that ended before the cycle in progress, and the partial index is at least that permissive.
- `resumenMensual`, the demo, the pickers, `reordenar_categorias` input and the bot's `loadBotContext` (`lib/data/supabase/bot.ts`) filter by lifetime (the bot filters by the cycle in progress).

### D8 — Moving an expense: header chip + glass picker
`ExpenseDraft` gains `categoryId` for update (create keeps taking it from the card). The header's category becomes a button with the dot. It opens a popover with the same `liquid-glass` surface, radius and spring motion as `month-picker.tsx` (open/close with scale + opacity, `motion-reduce:transition-none`), listing the cycle's live categories as rows with a check on the current one. On a linked row, the new category goes in `SlotEntry.categoryId` and the scope decides whether the definition moves (D2). The Supabase update (`lib/data/supabase/expenses.ts`, a direct `update` today) writes `categoria_id` after checking that the category is alive in the row's cycle; the composite FK of `0019` already guarantees ownership.

### D9 — Savings delete like income
`SavingsMutations` gains `softDelete(id)` and `restore(id)`, the same shape as `IncomeMutations`. The panel wraps each movement row in `SwipeToDelete` with the same toast and undo. No sheet changes: there is no edit, and the add sheet has no delete action because it is create-only.

### D10 — Undo for a swiped projected row
The toast keeps `(definitionId, cycle)` instead of a row id, since a projected row had no id before the swipe. `restoreInCycle` clears `borrado_en` on the slot row. The slot row itself stays, holding the cycle with the projected values, which is what the projection would show anyway.

## Risks / Trade-offs

- **Frozen rows don't follow later "every month" edits** → they are real pending rows between P and X. A later edit from "Próximos cobros" rewrites only this cycle's pending charge. Mitigation: `RecurringMutations.update` (definition sheet) also rewrites every pending linked row of later cycles, which is D2 step 3 with X = P, so frozen rows are overwritten too. The spec already says the definition sheet changes every cycle from the cycle in progress on.
- **A frozen row outlives an inactive definition** → after D3, cycles between P and X keep real pending rows; "Próximos cobros" in those projections must list linked rows even when the definition is inactive. Verify in `selectUpcomingCharges` (task 5.4).
- **Bot and ended categories** → a name match against an ended category would file an expense into a cycle outside its lifetime. Filtered by the cycle in progress (D7). The eval set has no ended categories, so a unit test covers it.
- **Unique name to partial index** → dropping a constraint on the real DB with real data. The migration is additive otherwise. Check that no duplicate names exist before creating the index (there can't be any today).
- **Scope question friction** → every edit of a fixed charge needs one more tap. Accepted: Brian asked for it on every change ("Siempre, cualquier mes").
- **Demo / Supabase drift** → six new data-source behaviours. Each gets the same scenario on both sides, and the pure parts (freeze list, recount, lifetime filter) live in `lib/data/` with unit tests.

## Migration Plan

1. Archive `add-cycle-projection-and-recurring-cron` and `add-entries-in-projected-cycles` first, so `cycle-projection` and `recurring-charge-generation` exist in `openspec/specs/`.
2. `0024_alcance_y_vida_categorias.sql`: category columns, partial unique index, `crear_categoria` / `eliminar_categoria` changes, the three slot functions, `generar_ciclo` recount, `actualizar_movimiento_recurrente` rewriting later pending rows. Apply through the MCP after Brian confirms. Rollback: the functions are `create or replace`, so re-applying `0017`/`0021`/`0022` bodies restores them, and the columns are nullable and can stay.
3. Deploy the web. The bot needs no deploy of its own beyond the web deploy, because the category filter ships in the same bundle.

## Open Questions

- **"Solo este mes" for a category delete.** Brian's answer was "de este mes o todos". This design reads it as "from this month on" vs "all months", since a category hidden for one month and back the next has no clear use. Confirm before implementing the delete step.
- **"No te deja" when deleting.** Brian reports that a category with fixed charges or recorded expenses cannot be deleted. `eliminar_categoria` does move both, so either the UI blocks it or a path fails. Reproduce on `/dashboard` first (task 1.1). If it is a bug, fix it as part of this change.
