## Context

See proposal.md → *Why* and *Gaps*. What shapes the approach:

- `DashboardTemplate` is a client component that takes `data: DashboardData`, `definitions`, `charges` and `actions: DashboardActions`. `/demo` mounts it from `app/demo/demo-dashboard.tsx`, a client wrapper that builds the actions from `lib/demo/*`. The real route needs the same wrapper shape with another source.
- The contracts (`ExpenseMutations`, `IncomeMutations`, `SavingsMutations`, `CategoryMutations`, `RecurringMutations`) promise "resolves once durable, rejects with nothing changed". Several operations touch more than one row (category delete, reorder, recurring create/update/delete).
- The entry sheet saves a recurring expense as two sequential calls on the same values: `expenses.create(categoryId, draft)` then `recurring.create(target, { name, expectedAmount, day, … })`, with the draft's date already overridden to the recurrence day (`entry-sheet.tsx`, `handleSubmit`). The demo correlates the two by matching category, amount, day and name (`attachCreatedDefinitions`).
- Schema after 0015/0016: `movimientos_recurrentes` (with `tipo`, nullable `categoria_id`, `repeticiones_*`), `transacciones` (`movimiento_recurrente_id`, `ciclo_mes`, `borrado_en`, no `estado`), `usuarios.auth_user_id`, `usuarios.meta_ahorro_mensual`. RLS on every table resolves the user through `usuario_actual_id()` = `usuarios.id where auth_user_id = auth.uid()`. `rango_ciclo(dia, tz, ref)` returns `[inicio, fin)` as instants.
- `lib/supabase/admin.ts` is the only client today (service role, `server-only`). `@supabase/ssr` is not installed. There is no `middleware.ts`/`proxy.ts`. Next is 16.3, where the middleware file is `proxy.ts` exporting `proxy`.
- next-intl resolves the locale from a cookie in `i18n/request.ts` (no locale routing), so a root proxy does not interfere with it. Its formatting timezone is UTC; the template already passes `data.user.timezone` to the rows.
- No docker, Supabase CLI or psql here. Playwright runs against `npm run dev` on `/demo`, and the prerequisite adds `npm run test:unit` (Node's test runner) for pure functions.
- Prerequisite `fix-free-margin-envelope-budgets`:
  - `presupuestos.periodo` is a `date`, the cycle's first day, with `unique (usuario_id, categoria_id, periodo)`. `monto` is nullable, and null is the "no budget in this cycle" marker (0018).
  - `lib/data/budget.ts` has `getFreeMargin` and `BudgetRow`.
  - `category-editing` → *Budgets belong to one cycle* defines the copy into a new current cycle, current-cycle-only writes, the marker on clear, and no future rows.
  - `category-editing` → *A budget reserves its amount in the free margin* defines the margin and the "spent" a bar uses: spending outside recurring charges.
  - `month-selector.tsx` disables "next" while `inProgress`.

## Goals / Non-Goals

**Goals:**
- One data layer, two mounts: the same components render `/demo` and `/dashboard`; only the injected implementation differs.
- Every Supabase call is server-side, as the signed-in user, through RLS. Nothing Supabase-related in the browser bundle.
- Multi-row operations are atomic.
- The implementations are reusable by the bot with the admin client (they take a client and a `usuarios.id`; they never call `auth.uid()` themselves).
- Provisional rules for every schema gap are explicit and local, so replacing them later is a one-place change.

**Non-Goals:**
- Optimistic updates or client-side caching; each operation is a round trip that revalidates the page.
- Generated database types (`supabase gen types`); the layer uses hand-written row types for the columns it reads.
- Realtime, multiple sessions, e-mail change, account deletion.
- Any change to `lib/demo/`, `components/` or the existing migrations.

## Decisions

**D1. Route map.**
- `/` → `app/page.tsx`, server component, two `<Link>`s. No Supabase import.
- `/login` → `app/login/page.tsx` (server: if a session exists, `redirect('/dashboard')`; else renders `LoginForm`, a small client component using `useActionState`) and `app/login/actions.ts` (`sendMagicLink(prev, formData)`).
- `/auth/confirm` → `app/auth/confirm/route.ts`, `GET`: `verifyOtp({ token_hash, type })`, then `redirect('/dashboard')`; on any error `redirect('/login?error=enlace')`.
- `/dashboard` → `app/dashboard/page.tsx` (server), `app/dashboard/supabase-dashboard.tsx` (client wrapper), `app/dashboard/actions.ts` (`'use server'`).
- `/demo` untouched.
- `proxy.ts` at the repo root (D4).

*Alternative:* mounting the real dashboard at `/` — rejected by the request (Home has the two buttons).

**D2. Server actions, no browser client.** The wrapper assembles `DashboardActions` from server actions imported from `app/dashboard/actions.ts`, one per contract operation, plus `signOut`. Each action: create the cookie-bound server client (D3) → `findCurrentUsuario` (D6) → call the implementation (D7) → `revalidatePath('/dashboard')`. The action result flows back through the promise the sheet awaits; the revalidation re-renders the page with fresh `data`, and `DashboardTemplate` keeps its local UI state because it stays mounted. `categories.create` returns the new id through the action's return value.

*Why:* RLS still applies (the server client carries the user's session with the anon key); the browser bundle never includes supabase-js; the `lib/data/supabase/*` functions stay pure of Next and can be called by the bot with the admin client. *Alternative:* a browser client with `createBrowserClient` and `router.refresh()` — also RLS-safe, but it ships a second client, needs `NEXT_PUBLIC_*` in the bundle, and splits the data layer across two runtimes. *Trade-off:* each edit costs a round trip (a few hundred ms); the sheets already show a busy state while awaiting. No optimistic UI in this change.

**D3. Clients and environment.** `lib/supabase/server.ts` exports `supabaseServer()`: `createServerClient(url, anonKey, { cookies: { getAll, setAll } })` over `next/headers` `cookies()`, `import 'server-only'`, env read inside the function like `admin.ts`. `setAll` swallows the error thrown from a Server Component (cookies are read-only there; the proxy does the writing). Env names stay `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` (ARCHITECTURE §2); the value works with either the legacy anon JWT or a publishable key. New dependency: `@supabase/ssr`.

**D4. `proxy.ts`.** Follows Supabase's `updateSession` pattern: build a server client over `request.cookies` / `response.cookies`, call `auth.getClaims()` (verifies the JWT; refreshes and rewrites cookies when the access token expired), and redirect to `/login` when there is no user and the path starts with `/dashboard`. `config.matcher = ['/dashboard/:path*', '/login', '/auth/:path*']`. `/` and `/demo` are outside the matcher, so no Supabase client is ever created for them; the redirect is also enforced in `app/dashboard/page.tsx` (D6) so the page does not depend on the proxy being configured.

**D5. Magic link by token hash.** `sendMagicLink` calls `auth.signInWithOtp({ email, options: { shouldCreateUser: false } })` and returns `{ status: 'sent' }` for both success and the "signups not allowed" error (no address enumeration); any other error returns `{ status: 'error' }`. The Supabase *Magic Link* template is changed (manual step) to `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email`, so `/auth/confirm` verifies the token server-side with `verifyOtp({ token_hash, type: 'email' })` and the session cookies are set by the route handler. *Alternative:* the default `{{ .ConfirmationURL }}` (PKCE `?code=` + `exchangeCodeForSession`) — rejected: it depends on a code-verifier cookie from the browser that requested the link, which fails when the e-mail opens in another browser (the usual case on a phone).

**D6. Current user.** `lib/data/supabase/user.ts` → `findCurrentUsuario(client)`: `from('usuarios').select('id, nombre, telefono, foto_url, moneda_default, timezone, dia_inicio_ciclo, meta_ahorro_mensual').maybeSingle()` — RLS already restricts it to the row whose `auth_user_id = auth.uid()`. `app/dashboard/page.tsx`: `getClaims()` → no user → `redirect('/login')`; user → `findCurrentUsuario` → null → render the "cuenta sin vincular" message with a sign-out form (no `DashboardTemplate`); else `resumenMensual` → `<SupabaseDashboard data definitions />`. Server actions throw `Error('unlinked-account')` when the lookup returns null.

**D7. Data-layer layout.** `lib/data/supabase/`:
- `context.ts`: `type DataContext = { client: SupabaseClient; usuarioId: string; currency: string; timezone: string }`, built by the actions from the `usuarios` row.
- `cycle.ts`: `cycleRange(client, { diaInicio, timezone, ref })` → `rpc('rango_ciclo', …)`; `refInstantForMonth(month)` (D9); `shiftMonth(month, n)`; `parseMonthParam(value)`; `localDateOf(iso, tz)` (the same `Intl` formatter the template uses); `cycleMonthOf(range, tz)`.
- `dashboard.ts`: `resumenMensual(client, usuario, month?)` → `{ data: DashboardData; definitions: RecurringDefinition[] }` (D8).
- `expenses.ts`, `income.ts`, `savings.ts`: `createSupabaseExpenseMutations(ctx)` etc., single-row PostgREST calls (D13).
- `categories.ts`, `recurring.ts`: factories over the RPCs of 0017 (D12), plus `stop` as a plain update.
- No file under `lib/data/supabase/` or `lib/supabase/server.ts` is imported by `app/demo`, `lib/demo` or `components`; `server-only` makes an accidental client import a build error.

`resumenMensual` keeps its Spanish name because ARCHITECTURE §3 names it; everything else follows the English naming of `lib/data/`.

**D8. `resumenMensual` queries and assembly.** With `usuario` and the target `month` (default and upper bound: `cycleMonthOf(cycleRange(now))`, D9):
1. Six `rango_ciclo` calls in parallel, for `month` and the five preceding months (`refInstantForMonth`).
2. When the shown cycle is in progress, `rpc('copiar_presupuestos_ciclo', { p_usuario_id })` (D12) runs first. It is a no-op once the cycle holds any row. Then, in parallel: `categorias` of the user ordered by `orden, nombre`; `presupuestos` with `periodo = cycle.start` (the shown cycle only, as `BudgetRow`s); `movimientos_recurrentes` (all).
3. `transacciones` with `borrado_en is null`, `fecha >= oldest.inicio`, `fecha < shown.fin`, selecting `id, monto, moneda, fecha, categoria_id, descripcion, tipo, es_fijo, movimiento_recurrente_id`.
4. `transacciones` with `tipo = 'ahorro'`, `borrado_en is null`, `fecha < shown.fin` (all-time savings, for the accumulated balance and its history).

Assembly (pure, in `dashboard.ts`):
- Bucket rows by the six ranges. Build groups from every category (D11 for `fixed`). A row with `movimiento_recurrente_id` is a recurring charge.
- Budget: the category's row of the shown cycle, where `monto null` (the marker) or no row means no budget. `getBudgetStatus` receives the category's spending *without* recurring charges, with `currentDay = daysBetween(start, today) + 1` and `cycleDays = daysBetween(start, end) + 1`. The group's `total` keeps every row.
- Income entries with `recurring: { definitionId, day }` when linked. Savings movements. `savings.cycle`, `accumulated` (cumulative sum of query 4 at each range's `fin`), `target = meta_ahorro_mensual ?? null`, `history`. `expenses.total`, `history` (six totals).
- `freeMargin = getFreeMargin({ income, savings: savings.cycle, fixed: Σ recurring charges, categories: [{ budget, spent }] })`. `definitions` mapped from `movimientos_recurrentes` (`day = dia_del_mes ?? 1`, `repetitions = totales == null ? null : { total, done: insertadas }`). Amounts are wrapped in `Number()` regardless of how PostgREST serialised `numeric`.

**D9. Cycle arithmetic.** A cycle is named after the calendar month of `fin − 1 day` (local). For a month `YYYY-MM` the reference instant is `YYYY-MM-01T12:00:00Z`: local day 1 is `< dia_inicio` for every allowed start day above 1, so `rango_ciclo` returns the cycle that ends in that month, and for `dia_inicio = 1` it returns the calendar month. `cycle.start = localDateOf(inicio)`, `cycle.end = localDateOf(fin − 1 ms)`, `cycle.today = clamp(localDateOf(now), start, end)`, `inProgress = inicio <= now < fin`. `parseMonthParam` accepts `^\d{4}-(0[1-9]|1[0-2])$` only. A month after the cycle in progress (compared as `YYYY-MM` strings against `cycleMonthOf(cycleRange(now))`) is replaced by the cycle in progress, the same as an invalid value, so no URL shows a future cycle or asks for its budgets.

**D10. Dates written.** A `LocalDate` from a draft is stored as `${date}T12:00:00Z` — the demo's own convention — so the calendar day reads back identically through `localDateOf(fecha, tz)` for every timezone between UTC−11 and UTC+11, with no offset arithmetic in TypeScript. Rows the cron or the bot write later carry real instants and read through the same `localDateOf`. *Limitation:* a user in UTC+12 or beyond would see such rows one day early; not a real case for this product. `ciclo_mes` on a claimed charge is computed in SQL from the row's `fecha` with `rango_ciclo_usuario` (D12).

**D11. Provisional rules for the schema gaps.** Kept in one place each so the cron change can replace them:
- *Charged/pending* (no `estado`): `charged = localDateOf(fecha) <= cycle.today` (`dashboard.ts`, one function `isCharged`). `actualizar_movimiento_recurrente` (D12) uses the same rule in SQL: the linked charge in the cycle containing `now()` is rewritten only when its local date is after the local today.
- *Null day*: `day = dia_del_mes ?? 1` in the definition mapping and in `Expense.fixed.day`.
- *First repetition*: `crear_movimiento_recurrente` sets `repeticiones_insertadas = 1` when it links a row, 0 otherwise; the demo shows 0 for the same case (proposal, gap 5).

**D12. Migration `0017_funciones_dashboard.sql`.** `language plpgsql`, `security invoker` (RLS applies inside), every function takes `p_usuario_id uuid` first and filters on it explicitly, so the same functions serve the web (where `with check` also enforces ownership) and, later, the bot with service role. A violated precondition raises with a stable message the TypeScript layer maps to the contract's error:
- `copiar_presupuestos_ciclo(p_usuario_id) returns void`. It computes `v_periodo := (inicio at time zone u.timezone)::date` from `rango_ciclo_usuario(p_usuario_id, now())`, so it can only ever write the current cycle, never a past or future one. Then:

  ```sql
  insert into presupuestos (usuario_id, categoria_id, monto, periodo)
  select usuario_id, categoria_id, monto, v_periodo from presupuestos
  where usuario_id = p_usuario_id
    and periodo = (select max(periodo) from presupuestos where usuario_id = p_usuario_id and periodo < v_periodo)
    and not exists (select 1 from presupuestos where usuario_id = p_usuario_id and periodo = v_periodo)
  on conflict (usuario_id, categoria_id, periodo) do nothing
  ```

  Markers (`monto null`) are copied like amounts. A cycle holding any row, markers included, is never copied into again. Two concurrent calls both pass `not exists`, and the unique constraint turns the second insert into no-ops.
- `crear_categoria(p_usuario_id, p_nombre, p_color, p_presupuesto numeric) returns uuid` — raises `duplicate-category-name` when `lower(trim(nombre))` collides; inserts with `orden = coalesce(max(orden), -1) + 1`. When `p_presupuesto` is not null, it calls `copiar_presupuestos_ciclo` first and then inserts the current cycle's row. Without that first copy, a lone new row would make an empty cycle look copied, and the other categories would lose their budgets.
- `actualizar_categoria(p_usuario_id, p_id, p_nombre, p_color, p_presupuesto)` — same duplicate check excluding `p_id`; updates name and colour; calls `copiar_presupuestos_ciclo` first. Then:
  - with an amount: upserts the current cycle's row `on conflict (usuario_id, categoria_id, periodo) do update set monto`
  - with `null`: sets that row's `monto = null` (the marker) when it exists, and writes nothing when it does not

  Earlier cycles are never touched. Raises `not-found` when no category matched.
- `eliminar_categoria(p_usuario_id, p_id, p_reasignar_a)` — if `p_reasignar_a` is null and any `transacciones` (deleted included) or `movimientos_recurrentes` reference `p_id`, raises `category-not-empty`; else moves both (`update … set categoria_id = p_reasignar_a`), deletes the category (its `presupuestos` rows in every cycle cascade, 0006). `p_reasignar_a` must belong to `p_usuario_id`, else raises.
- `reordenar_categorias(p_usuario_id, p_ids uuid[])` — raises `invalid-order` unless `p_ids` has no duplicates and equals, as a set, the user's category ids; then `orden = array_position(p_ids, id) - 1`.
- `crear_movimiento_recurrente(p_usuario_id, p_tipo, p_categoria_id, p_nombre, p_monto, p_dia, p_recordatorio, p_dias_antes, p_repeticiones) returns uuid` — inserts the definition; then claims at most one row: the latest `transacciones` of the user with `tipo = p_tipo`, `categoria_id is not distinct from p_categoria_id`, `monto = p_monto`, `descripcion = p_nombre`, `movimiento_recurrente_id is null`, `borrado_en is null`, and whose local day (`extract(day from fecha at time zone u.timezone)`) equals `p_dia`; sets `movimiento_recurrente_id`, `es_fijo = (p_tipo = 'gasto')`, `ciclo_mes = (rango_ciclo_usuario(p_usuario_id, fecha)).inicio at time zone u.timezone :: date`; sets `repeticiones_insertadas = 1` when a row was claimed. Rejects `p_tipo = 'gasto'` without a category (the check constraint does too).
- `actualizar_movimiento_recurrente(p_usuario_id, p_id, p_nombre, p_monto, p_dia, p_recordatorio, p_dias_antes)` — updates the definition; then rewrites `monto` of the linked charge inside the cycle containing `now()` whose local date is after the local today (D11). `repeticiones_totales` is not a parameter: the sheet cannot change it.
- `eliminar_movimiento_recurrente(p_usuario_id, p_id)` — `update transacciones set borrado_en = now() where movimiento_recurrente_id = p_id and borrado_en is null`, then `delete from movimientos_recurrentes where id = p_id` (the FK sets the soft-deleted rows' link to null).

`categories.ts` maps a PostgREST error whose message is `duplicate-category-name` to `new Error(DUPLICATE_CATEGORY_NAME)`; every other error is rethrown. *Alternative:* sequential statements from TypeScript — rejected because a failure halfway leaves partial state, which the contracts forbid; supabase-js has no client-side transaction.

**D13. Single-row operations detect silent misses.** Inserts use `.insert(row).select('id').single()`; updates use `.update(patch).eq('id', id).eq('usuario_id', usuarioId).is('borrado_en', null).select('id')` and reject when the returned array is empty — RLS filters a foreign id to zero rows rather than raising, and the contract requires a rejection. `restore` matches `borrado_en is not null` instead. Expense rows: `tipo = 'gasto'`, `categoria_id`, `moneda = ctx.currency`, `es_fijo = false`, `descripcion = description || null`. Income: `tipo = 'ingreso'`, `categoria_id = null`. Savings: `tipo = 'ahorro'`, `monto = kind === 'withdrawal' ? -amount : amount`, `descripcion = name`. `stop`: `update movimientos_recurrentes set activo = false`.

**D14. Wrapper and navigation.** `SupabaseDashboard` mirrors `DemoDashboard`: `charges = selectUpcomingCharges(data.expenses.groups, definitions)`, actions built once with `useMemo`. `selectCycle(month)` → `router.push('/dashboard?mes=' + month)`; `previousCycle` → `shiftMonth(data.cycle.month, -1)`; `nextCycle` → `shiftMonth(+1)`, always supplied. The shared month selector disables it on the cycle in progress (`dashboard-ui` → *Cycle header and free margin*, from the prerequisite), and D9 clamps any URL past it. `openSavingsHistory` is not supplied (as on the demo). `changeLanguage` reuses `app/actions/language.ts`; `signOut` is a server action: `auth.signOut()` then `redirect('/')`. `page.tsx` reads `searchParams.mes` and passes the parsed month to `resumenMensual`.

**D15. Seed script structure** (`supabase/seed/test-user.sql`). One `do $$ … $$` block: declares `v_email` (placeholder, first line of the block), `v_telefono := '+10000000001'`, `v_tz := 'Europe/Dublin'`, `v_dia_inicio := 26`; resolves `v_auth_id` from `auth.users` or raises; upserts `usuarios` `on conflict (telefono)` setting `auth_user_id`, `email`, `nombre`, `pais`, `timezone`, `moneda_default`, `idioma`, `dia_inicio_ciclo`, `onboarding_completo`, `meta_ahorro_mensual`; upserts categories `on conflict (usuario_id, nombre)`, definitions `on conflict (usuario_id, nombre)`; computes the current cycle with `rango_ciclo_usuario(v_usuario_id, now())` and `v_dia0 := (inicio at time zone v_tz)::date`, and each past cycle with `now() - (k || ' months')::interval`; upserts budgets comida 400, ocio 150 and transporte 100 for the current cycle and each of the five past ones (`periodo` = that cycle's first day) `on conflict (usuario_id, categoria_id, periodo) do update set monto`, so past cycles show their bars and the copy RPC finds the current cycle already filled; writes every `transacciones` row with a deterministic id (`'a0000000-0000-4000-8000-0000000000NN'`, one per seed row) `on conflict (id) do update` on `monto, fecha, categoria_id, descripcion, tipo, es_fijo, movimiento_recurrente_id, ciclo_mes, borrado_en = null`; dates as `((v_dia0 + n) + time '12:00') at time zone 'UTC'` (D10); a definition's charge date = day `d` in the cycle's first calendar month when `d >= v_dia_inicio`, else in the second; `ciclo_mes = v_dia0` for linked rows. Past cycles: unlinked `gasto` rows across vivienda, comida, ocio and transporte reaching the totals in the spec, plus one `ahorro` of 500 each. The header carries the run instructions verbatim from the proposal's *Manual steps* 5–6.

**D16. Strings and pages.** `messages/*.json` gain `inicio` (`demo`, `entrar`, `titulo`) and `acceso` (`titulo`, `email`, `enviarEnlace`, `enlaceEnviado`, `errorEnvio`, `enlaceInvalido`, `cuentaSinVincular`, `cerrarSesion`). Home and Login use existing tokens and `components/ui/button` only; no new components, no layout work. `app/layout.tsx` metadata becomes `title: 'Mango'`.

**D17. Verification split.** Playwright can cover, without a Supabase project and with placeholder `NEXT_PUBLIC_*` values: `/` (two links and their targets, no Supabase host in the network log), `/login` (form renders, malformed e-mail refused client-side), and `/dashboard` → `/login` redirect (no cookies → no network call to Supabase). Everything that needs rows (`dashboard-data`, `test-user-seed`, the link flow) is verified by hand against the real project following the proposal's manual steps, and the outcome is recorded in `tasks.md`.

## Risks / Trade-offs

- [0015/0016/0017/0018 never ran against a real database] → manual step 1 applies them in order and stops at the first failure; the tasks do not proceed to the login test until they all apply.
- [PL/pgSQL is validated only by the real project] → each function is small and takes the same explicit `p_usuario_id`; a quick `select crear_categoria(...)` in the SQL Editor as `postgres` after applying 0017 checks the signatures before the UI does.
- [The expense + definition pair is two operations] → if `recurring.create` fails after `expenses.create` succeeded, the row exists without a definition; the sheet shows its error and the row can be deleted. Same shape as today's contract; a single linked insert is a future `RecurringMutations` refinement.
- [Claim rule matches by values] → two identical unlinked rows on the same day are indistinguishable; either is linked. Acceptable.
- [Round trip per edit] → no optimistic state; the sheets' busy state covers it. Revisit if it feels slow.
- [Supabase built-in mailer rate limit] → surfaced in the manual steps; the login page's error message covers the refusal.
- [`getClaims()` may fall back to a network call on projects still on the legacy JWT secret] → one call per request on the matched routes only.
- [Reading the dashboard can write] → the first read of a new cycle inserts its budget rows through `copiar_presupuestos_ciclo`. It runs as the user through RLS, only for the cycle in progress, and is a no-op afterwards, so a reload or a second tab changes nothing.
- [0017 is written before 0018 is applied] → its functions write `periodo` as a `date` and `monto` as nullable, which holds only after 0018. PL/pgSQL bodies are checked at call time, not at creation, so creating 0017 first is safe. Manual step 1 applies 0001–0018 before anything calls them.
- [`repeticiones_insertadas` differs between demo (0) and Supabase (1) for a just-created plan] → flagged in the proposal; resolved when the cron change owns the counter.
- [Existing `hojaGasto` naming debt is untouched] → the login strings go in a new namespace instead of extending it.
