## Context

See proposal.md → Why. State of the code on 2026-09-28, after `add-cycle-projection-and-recurring-cron` (open, 28/30, its UI deployed):

- **Projection branch.** `resumenMensual` (`lib/data/supabase/dashboard.ts`) queries transactions over the six cycles ending at the one in progress, never over a projected range. For a projected cycle `shownRows` is the output of `proyectarCiclo` mapped to rows with ids `proj:<definitionId>`, `fixed.charged = false`, budgets inherited through `projection.budgets`, savings = the target. `cycle.today` is clamped to the cycle's first day.
- **Template.** One flag, `data.cycle.projected`, drives every read-only difference (`dashboard-template.tsx:190`): rows without swipe or sheet, no add rows (expense, income, savings), no add-category tile, no reorder, no chart, no "Acumulado", the empty bar (`CategoryCard` / `BudgetProgress` take `projected`). The entry sheet already defaults its date to `clampDate(cycle.today, start, end)` and limits it to `[start, end]`, and the savings sheet defaults to `cycle.today` — both already give a projected cycle's first day. The recurrence switch is offered in create mode.
- **Mutations.** The Supabase adapters (`lib/data/supabase/expenses.ts`, `income.ts`, `savings.ts`) insert a confirmed row dated `<day>T12:00:00Z` with no `ciclo_mes` and no definition, whatever the day; the server actions revalidate `/dashboard`. Nothing in them depends on the shown cycle.
- **Cron.** `generar_ciclo` (0021) inserts one row per definition `on conflict (movimiento_recurrente_id, ciclo_mes) do nothing`, counts only the returned ids, and never selects by date; `cerrar_pendientes` touches `estado = 'pendiente'` rows only. `crear_movimiento_recurrente` (0017) links the row of the *cycle in progress* to a definition created from the sheet, regardless of the shown cycle.
- **Demo.** `deriveDemoData` applies every in-memory edit to the sample and, for a later month, hands the edited definitions and budget rows to `projectDemoCycle`, which ignores expense, income and savings edits. Edits are flat lists keyed by row id; a created row carries its draft date.
- **Specs.** The `cycle-projection`, `dashboard-data` and `dashboard-ui` requirements this change modifies live in the open change's deltas, not in `openspec/specs/`. This change's deltas are written over those versions; whichever change archives second has to be synced against the other's result.

## Goals / Non-Goals

**Goals:**
- One merge rule, pure and unit-tested, used by `/dashboard` and `/demo`.
- No migration and no change to the mutation adapters, the server actions, the cron or the database functions.
- The `projected` gating in the template narrows to what stays read-only, instead of being replaced by a second flag per surface.

**Non-Goals:**
- Planning a new recurrence from a projected cycle (the switch is hidden there, D5).
- Editing or deleting a savings movement (not possible in any cycle; *Deuda técnica*).
- Showing manual future rows in the spend chart or the savings history (both hidden in a projection).
- Instalment progress per projected cycle (*Deuda técnica*, unchanged).

## Decisions

### D1 — The merge is a pure function next to `proyectarCiclo`

`mezclarProyeccion({ charges, rows, start })` in `lib/data/projection.ts`, type-only imports so `node --test` loads it: given the projected charges and the cycle's real rows as `{ definitionId: string | null; cycle: LocalDate | null }`, it returns the charges whose definition holds no real row with `cycle === start` — the slot the unique key `(movimiento_recurrente_id, ciclo_mes)` protects. The caller lists its real rows plus the returned charges. Ordering, totals and the margin stay where they are today.

The slot is matched by `ciclo_mes`, not by date: a linked row whose date was edited into another cycle's range is shown by date (the existing rule) but keeps holding its own cycle's slot, exactly as the cron sees it. A row with no definition never replaces anything.

*Alternative rejected:* filtering inside `proyectarCiclo` by passing it the held slots. It would give the cron's caller a second input to get wrong; `generar_ciclo` already does this filtering in SQL, and the web needs the projected charge list *and* the real rows, not one list.

### D2 — `resumenMensual` reads the projected range and merges

- The transaction query's upper bound becomes `shownRange.fin` when the shown cycle is later than the one in progress (one query, as today); `history` keeps filtering by its own six ranges, so the chart's data does not change.
- `shownRows` for a projection = the real rows inside `shownRange` (same `inRange` filter as any cycle) + `mezclarProyeccion(...)` charges mapped as today (`proj:<definitionId>`, pending). Real linked rows in a projection get `charged = estado === 'confirmada'`; date-based "taken" makes no sense before the cycle starts.
- Budgets still come from `projection.budgets` (inherited, unwritten). `getBudgetStatus` is computed for every budgeted group as today, with `currentDay = 1`; the template decides whether to show it (D3).
- Savings of a projection = `max(savingsTarget ?? 0, sum of the cycle's real savings rows)` (D4). `movements` lists the real rows.
- The `copiar_presupuestos_ciclo` call stays gated on `inProgress`; the branch writes nothing.

### D3 — The bar in a projection stays empty until the category holds a real row

`Expense` and `IncomeEntry` gain `projected?: true` for rows computed from a definition (the `proj:` rows), set by both data sources. The template derives:

- **Editable row** = the mutation exists and the row is not `projected`; `cycle.projected` no longer gates rows or add rows.
- **Empty bar** = `cycle.projected && !group.expenses.some((e) => !e.projected)`. With a real row, `BudgetProgress` renders the ordinary state: spent = real rows + projected charges (the group's `total`, the same figure `getFreeMargin` reserves), weekly allowance over the whole cycle since today is the first day.

Why not always show the total in a projection: the empty bar on an untouched projection was reviewed and approved in 6.3/6.6 of the previous change, and it reads as "nothing planned by you yet". Why not show only the real rows: the bar would say "60 of 100" while the margin reserves 110 — the bar and the margin must never disagree. The discontinuity (adding 20 € to "suplementos" with a projected 90 € jumps the bar from empty to over budget) is the honest figure; if Brian prefers the bar always filled in a projection, the change is the one condition above and the *A budgeted card in a projection* scenario.

### D4 — The savings target is an envelope in a projection

A projected cycle's savings = `max(target ?? 0, Σ real movements)`, shown in the savings column and used by `getFreeMargin`. The target plays the role a budget plays for a category (`getFreeMargin` reserves `max(budget, spent)`): a planned deposit below the target changes nothing, one above it lowers the margin by the excess. A planned withdrawal alone leaves the margin at the target; that is accepted (nothing today lets the user plan against the target, and the cycle in progress ignores the target altogether). The accumulated balance and the savings history are not recomputed for a projection, since neither is shown there.

*Alternative rejected:* savings = Σ real movements when any exists, else the target. A 50 € deposit would drop the cycle's savings from 300 to 50 and raise the margin by 250 — the opposite of what the user meant by entering it.

### D5 — No recurrence switch in a projected cycle

The entry sheet (expense and income configurations) hides the switch when `cycle.projected`. Two reasons: `crear_movimiento_recurrente` claims the row of the cycle in progress, so a definition created from November would link nothing and November would show both the manual row and the projected charge; and a recurrence that starts in a future cycle is its own feature (start date, first repetition), out of scope here. The `EntrySheet` already takes the field configuration; `projected` travels as a prop and removes the switch from the rendered fields.

### D6 — The demo buckets edits by the cycle their date falls in

`deriveDemoData` resolves each expense, income and savings edit to its effective draft (the update if any, else the created draft or the base row) and buckets rows by the calendar month of that date — the demo's cycles are calendar months. The sample step (`resolveExpenses`, `resolveIncome`, the savings step) keeps only rows whose effective month is the sample's; `projectDemoCycle` receives the edits and adds the rows whose month is the shown one, then applies `mezclarProyeccion` (a no-op today, since demo rows in a projection are never linked, D5) and the D3/D4 rules. `deletedIds` and `updated` apply wherever the row lands. Ids stay global (`demo-new-<n>`), so undo works across cycles.

*Alternative rejected:* a separate edit store per month. It would duplicate the resolve helpers and break undo when the toast outlives a month change.

### D7 — The cron is verified, not changed

`generar_ciclo` already satisfies `dashboard-data` → *The generation leaves manual rows alone*: rows are inserted by definition with `on conflict do nothing`, manual rows have no definition, and only inserted ids are counted. Verification is a static review of 0021 plus a rolled-back `do` block on the real database (as 1.2 of the previous change did, with `fin_ciclo_generable` replaced inside the block to bypass the future-cycle check): insert a manual November row and a row holding the "Luz" November slot, call `generar_ciclo` for November, and check the counts and rows, ending in `raise`. Brian confirms before the block runs, as with every write to the real database.

### D8 — Specs written over the open change

`add-cycle-projection-and-recurring-cron` has not been archived (2.6–2.7 wait for 1 October). The three overlapping deltas here start with a note saying so. Archiving order: the previous change first (it syncs its deltas into `openspec/specs/`), then this one; if this one lands first, its `cycle-projection`, `dashboard-data` and `dashboard-ui` deltas already contain the previous change's text for those requirements, so the previous change's later sync must not overwrite them with its older versions — check at that archive.

## Risks / Trade-offs

- [The bar jumps from empty to filled with the first real row (D3)] → documented trade-off; a one-condition change if Brian prefers the bar always filled in a projection.
- [`revalidatePath('/dashboard')` after a mutation on `?mes=2026-11`] → the page reads `searchParams` and is dynamic, so the revalidation covers every `mes`; verified in production in the last task group before closing.
- [A future manual row and the cron on 1 October] → the cron inserts by definition and touches no other row; D7 verifies it. Manual rows created before this change ships are impossible (the UI had no add row).
- [Unit tests of `deriveDemoData` do not exist; the bucketing is covered through Playwright] → `mezclarProyeccion` gets `node --test` coverage; the demo's bucketing is checked by the Playwright scenarios that assert the sample and the other projections stay untouched.
- [Specs overlap with an open change (D8)] → note at the top of each overlapping delta and the archive-order rule above.
- [The savings envelope hides a planned withdrawal (D4)] → accepted; recorded here and in *Deuda técnica* when archiving.

## Migration Plan

No migration. Deploy is the ordinary Vercel deploy of the UI and `resumenMensual`; a manual row written from a projected cycle is an ordinary `transacciones` row, so the previous code would simply show it once the cycle is in progress. Rollback is redeploying the previous commit; rows entered in projected cycles stay and surface when their cycle arrives.
