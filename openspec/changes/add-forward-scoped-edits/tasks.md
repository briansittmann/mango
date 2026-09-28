## 0. Before starting

- [ ] 0.1 Archive `add-cycle-projection-and-recurring-cron` and then `add-entries-in-projected-cycles`; verify `openspec/specs/cycle-projection/` and `openspec/specs/recurring-charge-generation/` exist and `openspec validate add-forward-scoped-edits --strict` shows no "target spec does not exist"
- [x] 0.2 Confirm with Brian the scope of the category delete: "Solo este mes" / "Desde este mes en adelante" (2026-09-28); specs and design updated

## 1. Reproduce and pure logic

- [x] 1.1 Reproduce "no te deja" deleting a category that holds fixed charges or expenses, on `/demo` and on `/dashboard` (script against the real DB, read-only up to the confirmation step); note the cause in design.md → Open Questions and fix it in group 4 if it is a bug
- [x] 1.2 In `lib/data/projection.ts`: `mezclarProyeccion` receives soft-deleted linked rows as held slots; add `congelarCiclos({ definition, cycles })` (what the definition shows in each cycle in between) for D2/D3; unit tests in `projection.test.mjs` for a deleted slot and for the freeze list; `npm run test:unit` passes
- [x] 1.3 Add `categoriaViva(lifetime, ciclo)` in `lib/data/categories.ts` (lifetime and hidden cycles), used by the data sources in group 4 wherever categories are listed for a cycle; unit tests for `null/null`, only `desde`, only `hasta`, a hidden cycle, and the category's first cycle; `npm run test:unit` passes

## 2. Contracts

- [x] 2.1 `lib/data/recurring.ts`: `SlotEntry`, `editInCycle`, `deleteInCycle`, `restoreInCycle` with the doc comment of D5; `update` also rewrites later pending linked rows (design → Risks); `npx tsc --noEmit` fails only in the implementations still missing
- [x] 2.2 `lib/data/expenses.ts`: `categoryId` on update; `lib/data/savings.ts`: `softDelete` and `restore`; `lib/data/categories.ts`: `create(draft, cycle)` and `delete(categoryId, reassignTo, { cycle, scope: 'only' | 'onward' })`; `ExpenseGroup.rowsLater` for the delete step; typecheck as in 2.1. The template passes interim values (`scope: 'onward'`, the card's own category, the displayed cycle) until group 5

## 3. Database (`0024_alcance_y_vida_categorias.sql`)

- [x] 3.1 Columns `categorias.desde_ciclo` and `hasta_ciclo` (nullable date, comment), table `categorias_ocultas` (PK, composite FK, RLS), drop `unique (usuario_id, nombre)` and create the partial unique index `where hasta_ciclo is null`; verify on the real DB with `execute_sql` that no duplicate name exists before applying
- [x] 3.2 `crear_categoria` with `p_periodo` (writes `desde_ciclo`, budget with the onward rule of `0022`) and `eliminar_categoria` with `p_periodo` and `p_alcance` (D7); smoke test in a transaction with `rollback` against the test data
- [x] 3.3 Functions `editar_cargo_en_ciclo`, `eliminar_cargo_en_ciclo`, `restaurar_cargo_en_ciclo` (`security invoker`, explicit `p_usuario_id`, D1–D3); the freeze of step 1 uses the same projection as `generar_ciclo`; smoke test with `rollback`: only, onward from P, onward from P+3, and delete onward
- [x] 3.4 `generar_ciclo` counts every slot held in the generated cycle, and `sumar_repeticion` a slot written in a generated one (D4) and `actualizar_movimiento_recurrente` rewrites the pending linked rows of later cycles; smoke test with `rollback`: running it twice leaves the same count, and a row written ahead is counted once
- [x] 3.5 Ask Brian for confirmation and apply `0024` through the MCP; verify with `list_migrations` and a read of Brian's categories and plans (counts unchanged: Hacienda 2/3, DB Bank 1/4, Cetelem 1/12)

> Smoke tests 3.2–3.4 (2026-09-28): the migration and a test block ran against the real DB in one call ending in `raise exception`, so everything rolled back (checked afterwards: no new table or columns, counts unchanged). All cases matched: counting twice, a future slot not counted, only/onward edits and deletes with frozen cycles, restore, invalid period/date/horizon, category create in a projection, hide only this month, end from a month on, removal from the first cycle, the old three-argument delete, and the missing-receiver rejection.

## 4. Data sources

- [x] 4.1 `lib/data/supabase/recurring.ts` and `categories.ts`, `expenses.ts` (category with its lifetime check), `savings.ts` (soft delete/restore), plus the server actions in `app/dashboard/actions.ts`; typecheck passes
- [x] 4.2 `lib/data/supabase/dashboard.ts`: `resumenMensual` filters categories by lifetime, reads deleted linked rows as held slots, exposes each row's definition to the template and each group's `rowsLater` (verified 2026-09-28 after applying `0024`: October, November and December of Brian's account are identical with the old and the new `resumenMensual`); verify with a local script that October and November of Brian's account list the same charges as before
- [x] 4.3 `lib/data/supabase/bot.ts`: `loadBotContext` loads only categories alive in the cycle in progress; unit test with an ended category; `npm run test:unit` and `npm run test:parser` pass
- [x] 4.4 Demo: `demo-recurring.ts` (three slot operations over the in-memory rows, same rules), `demo-categories.ts` (lifetime, hidden cycles, create in a cycle, delete with scope), `demo-expenses.ts` (move between categories), `demo-savings.ts` (soft delete/restore), `demo-budgets.ts` if creation in a projection needs it; `demo-budgets.test.mjs` adds the create-in-projection case; `npm run test:unit` passes

## 5. UI

- [ ] 5.1 Extract `components/molecules/scope-choice.tsx` from `category-sheet.tsx` (D6) without visual changes to the category sheet; verify with a screenshot of the budget in a projection before and after (code done 2026-09-28; screenshot left to Brian, who runs the visual checks)
- [x] 5.2 `entry-sheet.tsx`: scope question on save for linked rows (the save action stays unavailable until one is chosen), delete step with "Solo este mes" / "Desde este mes en adelante" / Cancel (Cancel focused first), caption "Se repite cada mes"; strings in `messages/es.json` and `en.json` (remove `hojaGasto.soloEsteMes`); typecheck and lint pass
- [ ] 5.3 Header category chip with the glass picker (D8): 44px target, accessible name, Escape/pointer outside/choice close it and return focus, month picker motion and reduced motion; verify with screenshots in both themes at 390px (code done 2026-09-28; screenshots left to Brian)
- [x] 5.4 `dashboard-template.tsx`: projected rows (expenses and income) open the sheet and can be swiped; recurring swipes go to `deleteInCycle('only')` with a toast "Solo se borró el de este mes" and undo via `restoreInCycle`; savings movements with `SwipeToDelete`; "Añadir categoría" tile in projections; verify that `selectUpcomingCharges` lists frozen rows of an inactive definition (design → Risks; it lists every row with `fixed`, whatever the definition's state)
- [x] 5.5 `category-sheet.tsx`: delete confirmation with the scope (hidden when the displayed cycle is the category's first), the counts of expenses and fixed charges, the receiving category among those alive, and `create` with the displayed cycle; confirmation messages with the scope (`recurring-expenses` → *Where you touch decides what you change*)

## 6. Verification

- [x] 6.1 Write the Playwright specs over `/demo` (`scope-edits.spec.js`, `savings-delete.spec.js`, `category-lifetime.spec.js`, `expense-move.spec.js`) from the new scenarios; ask Brian before running them. Also updated for the scope question and editable projected rows: `recurring-scope`, `income-edit-delete`, `projection-demo`, `projected-entries`. Written and linted, not run (Brian runs the suite)
- [ ] 6.2 Verify `/dashboard` by hand against the real DB (one-time token session): onward edit from a projection, swipe of a projected charge and undo, deleting a category from this month on, moving an expense; leave Brian's data as it was (undo, or restore through the MCP with his confirmation)
- [ ] 6.3 Update CLAUDE.md (state, technical debt: remove "Definiciones recurrentes de ingreso sin edición", add the known limits of this change) and archive after 0.1
