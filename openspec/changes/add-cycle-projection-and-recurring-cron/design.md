## Context

See proposal.md → Why. State of the code and the real database on 2026-09-27:

- **Cycles.** `rango_ciclo` / `rango_ciclo_usuario` (0010) compute `[inicio, fin)` on the user's timezone; `lib/data/supabase/cycle.ts` calls the RPC once per cycle (`refInstantForMonth`, `shiftMonth`). `parseMonthParam` clamps `?mes=` to the cycle in progress, and `MonthSelector` / `MonthPicker` disable "next" while `cycle.inProgress`.
- **Charges.** `transacciones.ciclo_mes` exists only for charges tied to a definition, and `unique (movimiento_recurrente_id, ciclo_mes)` already exists (0008, renamed in 0015). Soft-deleted rows keep their slot. There is no `estado`: `isCharged` (`lib/data/supabase/dashboard.ts`) and `actualizar_movimiento_recurrente` (0017) both use "local date not after today".
- **Definitions.** `movimientos_recurrentes` (0005 → 0013 → 0015) has `activo`, `repeticiones_totales`, `repeticiones_insertadas`, `dia_del_mes` (nullable; 0 null rows), `tipo` (`gasto` | `ingreso` | `ahorro`). `crear_movimiento_recurrente` claims the row the same save created and counts it as 1.
- **Budgets.** `presupuestos.periodo` is the cycle's first day (0018). `copiar_presupuestos_ciclo`, `crear_categoria` and `actualizar_categoria` (0017) write the cycle in progress only, computed inside with `now()`. The demo mirrors the rules in `lib/demo/demo-budgets.ts` (`copyForward`, `setBudget`, with tests).
- **Real data** (Brian's only account, `dia_inicio_ciclo = 1`, Europe/Dublin): 23 definitions (19 expenses, 4 income) and 21 September charges, all with `ciclo_mes = 2026-09-01`, dated at 12:00 UTC of their local day. Instalments: Hacienda 1/3, DB Bank 0/4 (no September row), Cetelem 0/12 (no September row). No savings target. Budgets Comida 300 and Suplementos 100 on `2026-09-01`.
- **Infra.** No `vercel.json` yet. `lib/supabase/admin.ts` builds the service-role client from `SUPABASE_SERVICE_ROLE_KEY`; whether that variable and a `CRON_SECRET` exist in Vercel Production is unverified.
- **Deadline.** The October cycle starts on Thursday 1 October 2026, local midnight in Dublin.

## Goals / Non-Goals

**Goals:**
- One function decides what a cycle holds; the dashboard's projection, `/demo` and the cron all call it.
- The cron is safe to run any number of times, at any hour, after any number of missed days.
- The October charges exist on 1 October 2026 — through the cron or through the fallback — with the instalments counted once.
- The part on the October critical path (migration 0021, projection function, cron) ships before the UI part.

**Non-Goals:**
- A second implementation of the projection in SQL or pg_cron.
- Matching a free-text message to a definition (that is the bot, block 5; this change only gives it the operation to call).
- A "confirm" button on charges; confirming is saving the row.
- Projecting variable spending (history-based estimates) or planned one-off expenses.
- Fixing the demo's fixed sample dates (see Risks).

## Decisions

### D1 — `proyectarCiclo` is pure TypeScript in `lib/data/projection.ts`

Signature, roughly: `proyectarCiclo({ start, end, cyclesAfterGenerated, definitions, budgetRows, savingsTarget })` → `{ charges: { definitionId, tipo, categoryId, amount, date }[], budgets: Map<categoryId, number | null>, savings }`. Inputs are plain data, so `/dashboard`, `/demo` and the cron map their own rows into it; it imports only types, so `node --test` loads it like `demo-budgets.test.mjs`.

- A definition is included when `active && (total == null || done + n <= total)`, with `n = cyclesAfterGenerated` (1 for the cycle right after the last generated one). `ahorro` definitions are ignored (none exist; nothing creates them yet).
- `fechaEnCiclo(start, end, day)` implements `cycle-projection` → *A recurring charge falls on its day inside the cycle*: a day ≥ the cycle's start day goes in the start's month, otherwise in the following month; a day the month lacks goes to that month's last day (Q3).
- Budgets: the cycle's own rows if any, else the latest earlier cycle's — the same selection `copyForward` makes, without writing.
- The free margin is not computed inside: callers pass the result to the existing `getFreeMargin`, so there is one margin formula.

*Alternative rejected:* porting the projection to SQL so the cron can run in pg_cron. It would be the second implementation ARCHITECTURE.md §3 exists to prevent.

### D2 — The cron is a Next route that decides in TypeScript and writes through one SQL function per cycle

`vercel.json` schedules `GET /api/cron/recurrentes` at `0 5 * * *` — 05:00 UTC, every day (Q2). The route checks `Authorization: Bearer ${CRON_SECRET}` (the header Vercel sends), builds the admin client, and for each user:

1. Reads the user, definitions, budget rows and `ciclo_generado_hasta` (D3).
2. Computes the cycles to generate: from the one after the marker (or the cycle in progress, when the marker is null) up to the cycle in progress, with `rango_ciclo`.
3. For each, in order, calls `proyectarCiclo` with `n = 1` against the definitions as they stand after the previous cycle, and sends the resulting charges to `generar_ciclo(p_usuario_id, p_periodo, p_cargos jsonb)`.
4. Calls `cerrar_pendientes(p_usuario_id)`.

`generar_ciclo` does everything that must be atomic: it returns without writing when `ciclo_generado_hasta >= p_periodo` (a concurrent or repeated run); inserts the rows `on conflict (movimiento_recurrente_id, ciclo_mes) do nothing returning movimiento_recurrente_id`; for the returned ids only, increments `repeticiones_insertadas` and sets `activo = (repeticiones_totales is null or repeticiones_insertadas + 1 < repeticiones_totales)` in the same update (0013's rule); re-filters in SQL by `activo and (totales is null or insertadas < totales)` so a stale input can never over-count; sets the marker. Rows are `estado = 'pendiente'`, `es_fijo = (tipo = 'gasto')`, `moneda = moneda_default`, `fecha = <local date>T12:00:00Z` like every other write.

`cerrar_pendientes` sets `estado = 'confirmada'` on the user's pending rows whose `ciclo_mes` is before the cycle in progress. Both functions are `security invoker`, and `execute` is revoked from `public`, `anon` and `authenticated`: only the service role calls them.

Each user runs in its own `try`; the response is `{ users: [{ id, generated: [periodo], inserted, closed }] | { id, error } }` with no amounts or names (logs are visible in Vercel).

*Alternative rejected:* Supabase Edge Function + pg_cron — second runtime to deploy and keep in sync with `lib/data`, and it cannot import `proyectarCiclo` without a build step.

### D3 — `usuarios.ciclo_generado_hasta` decides whether a cycle is generated

A nullable `date`: the first day of the last generated cycle. Migration 0021 back-fills it with `max(ciclo_mes)` of the user's linked transactions (Brian → `2026-09-01`; the fallback script moves it to `2026-10-01` if it runs).

*Alternatives rejected:*
- "Generate when today is the start day": a missed run loses the cycle, and there is nothing to retry.
- "A cycle is generated when it holds any linked row" (the budget-copy rule): a definition created from the entry sheet on day 2 would make the cycle look generated before the cron ever ran, and the other definitions would be skipped for that cycle. It also cannot tell DB Bank (0/4, starts in October) from a definition that missed September: with a marker, September is already generated and DB Bank waits for October.

The projection counts `n` from the marker, so when the cron has not run yet on day 1 the cycle in progress still counts as one pending generation and the next cycles are projected correctly.

### D4 — `transacciones.estado`, back-filled with the old rule

`estado text not null default 'confirmada' check (estado in ('pendiente','confirmada'))`, plus a partial index on `(usuario_id, ciclo_mes) where estado = 'pendiente'`. Back-fill: `pendiente` where `movimiento_recurrente_id is not null and borrado_en is null and (fecha at time zone tz)::date > (now() at time zone tz)::date`. On 2026-09-28 that marks only Sueldo (29/9) and would leave the screen identical.

Then:
- `isCharged` stays as the display rule, now `estado === 'confirmada' || localDate <= today` (Q4): the screen behaves as today, and a pending row whose day has passed is still there for reconciliation.
- `actualizar_movimiento_recurrente` rewrites the linked charge of the cycle in progress only when it is shown as pending: `estado = 'pendiente'` **and** its local date after today. A pending charge whose day passed was, as far as the screen says, already paid at that amount.
- `ExpenseMutations.update` and `IncomeMutations.update` in Supabase always write `estado: 'confirmada'`: for a manual row it is a no-op, for a pending charge it is the reconciliation. No new contract method.
- `completar_cargo_recurrente(p_usuario_id, p_movimiento_id, p_periodo, p_monto, p_fecha)` is the operation for the bot: updates the pending row, or inserts a confirmed linked row and counts it (same update as `generar_ciclo`), or raises `already-confirmed` when a confirmed or soft-deleted row holds the slot. Nothing in the web calls it; block 5 does.
- The demo has no `estado`: its sample keeps date-derived taken/pending flags as today.

### D5 — Two migrations, split by the deadline

- `0021_estado_y_generacion.sql` (critical path): D3, D4, `generar_ciclo`, `cerrar_pendientes`, `completar_cargo_recurrente`, the new `actualizar_movimiento_recurrente`, updated column comments (`ciclo_mes` is no longer "solo cron"), and `dia_del_mes set not null` (Q1; 0 null rows today — the migration checks and fails loudly otherwise). The "null → day 1" fallbacks in `resumenMensual` and `RecurringDefinition` mapping go away. Additive for the deployed code: the old `isCharged` keeps working until the new code ships.
- `0022_presupuestos_ciclo_futuro.sql` (UI part): `copiar_presupuestos_ciclo(p_usuario_id, p_periodo date default null)` copies into any cycle ≥ the current one; `actualizar_categoria` gains `p_periodo date default null, p_alcance text default null` — null periodo or a past one writes the cycle in progress as today; a future periodo must be a cycle start between the next cycle and the sixth, materialises it (copy), writes the category, and with `'solo'` materialises the following cycle from the pre-edit inheritance when it holds no row. The 5-argument version is dropped in the same migration, so PostgREST has one candidate and the deployed code (5 named arguments, rest default) keeps working. The `presupuestos.periodo` comment loses "nunca se escribe un ciclo posterior al actual".

### D6 — Projection branch in `resumenMensual`

`parseMonthParam(value, current)` clamps to `shiftMonth(current, 6)` instead of `current`. When the shown cycle starts after the cycle in progress, `resumenMensual` does not run `copiar_presupuestos_ciclo` for it and does not query its transactions; it reads budget rows with `periodo <= start`, maps definitions and calls `proyectarCiclo`. Projected rows get synthetic ids (`proj:<definitionId>`) and `fixed.charged = false`; income entries carry `recurring`. `DashboardData.cycle` gains `projected: boolean` and `maxMonth: string` (the sixth cycle), so the template and the month controls stop inferring the horizon from `inProgress`. `history` keeps the six cycles ending at the one in progress; the template hides the chart in a projection.

### D7 — Category contract: the cycle travels with `update`

`CategoryMutations.update(categoryId, draft, target: { cycle: LocalDate; scope: 'only' | 'onward' | null })`, `cycle` being the displayed cycle's start. The template passes `scope` only for a projected cycle; the server action forwards `p_periodo` / `p_alcance`. The demo implements the same rules in `lib/demo/demo-budgets.ts` as pure functions (`materialize`, `setBudgetInCycle`) with tests next to the existing ones.

### D8 — The template reads `cycle.projected`

One flag drives every difference listed in `cycle-projection` → *What a projected cycle shows and allows*: the label, read-only rows (no swipe, no entry sheet on tap), empty budget bar, no add rows, no reorder, hidden chart and accumulated savings, and the scope choice in the category sheet. New strings (`proyeccion`, `soloEsteMes`, `desdeEsteMes`) in both catalogs. Motion stays within the existing patterns and respects `prefers-reduced-motion`; screenshots in both themes before marking the UI tasks done.

### D9 — The demo projects from its sample cycle

`deriveDemoData` takes the shown month; the sample cycle (September 2026) is the demo's "last generated" cycle, so `n = months after the sample`. Projected cycles come from the demo definitions after in-memory recurring edits and from the demo budget rows after in-memory budget edits, through `proyectarCiclo`. `nextCycle` / `selectCycle` move within the sample and its six projections; `previousCycle` keeps `showUnavailable`.

### D10 — October fallback

`supabase/seed/octubre-2026.sql` (a script, not a migration), written in the first group of tasks and run only if the cron is not live on 1 October:

- Refuses to run if the account has any linked row with `ciclo_mes = '2026-10-01'`, or if `ciclo_generado_hasta` exists and is already `2026-10-01`.
- Inserts one row per active definition with repetitions left — 19 expenses and 4 income, 23 rows — at `monto_actual`, dated with the same day rule as D1, `ciclo_mes = '2026-10-01'`, `estado = 'pendiente'` when the column exists.
- Increments `repeticiones_insertadas` for each (Hacienda 2/3, DB Bank 1/4, Cetelem 1/12, the rest +1) and sets `activo` with 0013's rule (none reaches its total).
- Sets `ciclo_generado_hasta = '2026-10-01'` when the column exists; otherwise 0021's back-fill derives it from `max(ciclo_mes)`.

Either way the cron later finds October generated and neither inserts nor counts again. Decision point: the evening of 30 September — if the cron route is not deployed with 0021 applied and a successful authorised call, Brian runs the script on 1 October (after local midnight).

## Risks / Trade-offs

- [The deadline is four days away and the change is large] → Tasks are ordered so 0021 + `proyectarCiclo` + the cron ship first; the projection UI does not block October. The fallback (D10) covers the rest.
- [`CRON_SECRET` or `SUPABASE_SERVICE_ROLE_KEY` missing in Vercel] → a 👤 task checks both before the deploy; the route returns 500 without touching data when either is missing.
- [Vercel Hobby fires daily crons at any minute within the scheduled hour] → the generation is time-insensitive (D2, D3); only the latency changes.
- [A user west of UTC−5 gets the new cycle a day late with 05:00 UTC] → catch-up semantics make it late, never wrong.
- [Q4 keeps a date rule next to `estado`, so "taken" on screen and `estado` can differ for a pending charge whose day passed] → deliberate: the screen shows what was most likely paid, `estado` keeps the slot open for reconciliation. The two meet at cycle close, when `cerrar_pendientes` confirms everything.
- [`generar_ciclo` given stale input by a slow run] → the marker check and the in-SQL repetition filter make a second or stale call a no-op.
- [PostgREST overload ambiguity when `actualizar_categoria` changes signature] → drop and recreate in one migration (D5).
- [The demo's sample is fixed to September 2026; from 1 October it is no longer "in progress"] → pre-existing, out of scope; the projection counts from the sample, not from today, so it keeps working. Recorded in *Deuda técnica*.
- [The fallback and a late cron could race on 1 October] → both are guarded by the unique key and the marker; whichever runs second inserts and counts nothing.

## Migration Plan

1. Dry-run 0021 on the real database inside a `do` block that ends in `raise` (as with 0020): check the back-fill (only Sueldo pending), the marker (`2026-09-01`), a simulated `generar_ciclo` for `2026-10-01` (23 rows, counts 2/3, 1/4, 1/12, marker moved), a second call inserting nothing, and `cerrar_pendientes` closing September. Nothing commits.
2. Brian confirms → apply 0021 through the MCP. The deployed code keeps working (additive).
3. Deploy the cron route and `vercel.json` with `CRON_SECRET` set; call the endpoint once by hand with the secret before 1 October: it must report nothing generated and close nothing (September is in progress).
4. 1 October: check the report in the Vercel logs and the October rows. If step 3 did not happen by the evening of 30 September, run D10 instead.
5. Later, independently: 0022 (dry-run → confirm → apply) and the UI deploy.

Rollback: the cron is disabled by removing it from `vercel.json` and redeploying. 0021's columns and functions are additive; if needed, `estado` and the marker can be dropped and 0017's `actualizar_movimiento_recurrente` restored, and the old `isCharged` code redeployed. Inserted October rows are real charges and stay.

## Decisions (asked, answered by Brian on 2026-09-27)

- **Q1 — `dia_del_mes` becomes `NOT NULL`.** In 0021, after checking there are 0 nulls. The "null → day 1" rule leaves `resumenMensual` and the `dashboard-data` spec; the *Deuda técnica* item closes. Alternative not taken: keep it nullable and treat null as day 1 everywhere.
- **Q2 — The cron runs daily at 05:00 UTC** (`0 5 * * *`): 06:00 in Dublin in summer, 05:00 in winter, already the new local day for every timezone down to UTC−5. Each user's cycle is still computed in their own timezone. Not taken: 00:05 UTC (a day late west of UTC), hourly (Pro plan only). On Hobby the run fires at some minute between 05:00 and 05:59; the plan was not stated, and nothing depends on the exact minute.
- **Q3 — A day the month lacks goes to that month's last day** (31 → 30 September; 30 in the 26/2–25/3 cycle → 28 February). Not taken: the cycle's last day, or skipping the cycle.
- **Q4 — "Taken" = confirmed or its day has passed.** `estado` drives reconciliation, the definition-update rewrite and cycle close; the screen behaves as today. Not taken: taken only when confirmed, which would leave the day-1 rent "pendiente" all month and name it as the next charge in the collapsed card.
