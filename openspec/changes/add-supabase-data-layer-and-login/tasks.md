## 1. Prerequisite and dependencies

- [x] 1.1 Archive `add-savings-mutations` (`openspec archive add-savings-mutations`) so `savings-editing` exists as a main spec — verify `openspec list --specs` lists `savings-editing`
- [x] 1.2 Add `@supabase/ssr` (`npm install @supabase/ssr`) — verify `package.json` lists it and `npm ls @supabase/ssr` resolves without errors
- [x] 1.3 Add `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` to `.env.local` from the Supabase project (proposal → *Manual steps* 7) — verify `grep -c SUPABASE .env.local` prints 2 and the file is ignored by git (`git check-ignore .env.local`)
- [ ] 1.4 Confirm the prerequisite `fix-free-margin-envelope-budgets` is archived — verify `openspec list` no longer shows it, and `supabase/migrations/0018_presupuestos_periodo_ciclo.sql`, `getFreeMargin` and `BudgetRow` in `lib/data/budget.ts` exist

## 2. Supabase clients and session plumbing

- [x] 2.1 Create `lib/supabase/server.ts` with `supabaseServer()` (D3): `createServerClient` over `next/headers` cookies with `getAll`/`setAll`, `setAll` tolerant of the Server Component case, `import 'server-only'`, env read inside the function — verify `npx tsc --noEmit` passes
- [x] 2.2 Create root `proxy.ts` (D4): refresh the session with `getClaims()`, redirect `/dashboard*` to `/login` without a user, matcher `['/dashboard/:path*', '/login', '/auth/:path*']` — verify `npm run build` reports the proxy and `curl -sI http://localhost:3000/dashboard` returns a 307 to `/login` with no cookies

## 3. Migration 0017

- [ ] 3.1 Write `supabase/migrations/0017_funciones_dashboard.sql` with `copiar_presupuestos_ciclo`, `crear_categoria`, `actualizar_categoria`, `eliminar_categoria`, `reordenar_categorias`, `crear_movimiento_recurrente`, `actualizar_movimiento_recurrente` and `eliminar_movimiento_recurrente` (D12). Throughout: `security invoker`, explicit `p_usuario_id`, stable raise messages, the claim rule, `ciclo_mes` via `rango_ciclo_usuario`, and `repeticiones_insertadas = 1` on a claimed row. Budgets:
  - `copiar_presupuestos_ciclo` computes the current cycle itself and copies markers too
  - `crear_categoria` and `actualizar_categoria` call it before writing the current cycle's row
  - a null budget becomes a marker

  Verify by static review against the constraints in 0004–0016 and 0018 (unique names, FK `restrict` on `categoria_id`, check constraints on `tipo`/`categoria_id`, `unique (usuario_id, categoria_id, periodo)`, nullable `monto`), and that no function can write a `periodo` other than the current cycle's first day.
- [ ] 3.2 After 1.4, apply 0001–0018 in order to the real project (proposal → *Manual steps* 1) — verify each file runs without error in the SQL Editor; record here which file fails, if any, and stop until it is fixed
- [ ] 3.3 Smoke-test the functions as `postgres` in the SQL Editor on Brian's seeded user. Verify the three raises, that the successful create shows up in `categorias`, and the copy results:
  - `crear_categoria` twice with the same name (the second raises `duplicate-category-name`)
  - `reordenar_categorias` with a missing id (raises `invalid-order`)
  - `eliminar_categoria` on a category with rows and a null target (raises `category-not-empty`)
  - after deleting the current cycle's `presupuestos` rows, `copiar_presupuestos_ciclo` twice: the first call restores them from the latest earlier cycle, the second adds nothing

## 4. Data layer (`lib/data/supabase/`)

- [ ] 4.1 Create `context.ts` (`DataContext`) and `cycle.ts` (`cycleRange` via `rpc('rango_ciclo')`, `refInstantForMonth`, `shiftMonth`, `parseMonthParam` with the clamp to the cycle in progress, `localDateOf`, `cycleMonthOf`, D9) — verify `tsc` and, in a throwaway `node` script against the real project, that month `2026-09` with start day 26 and Europe/Dublin yields start `2026-08-26`, end `2026-09-25`, and that a month after the cycle in progress resolves to it
- [ ] 4.2 Create `user.ts` with `findCurrentUsuario(client)` (D6) — verify `tsc`
- [ ] 4.3 Create `dashboard.ts` with `resumenMensual(client, usuario, month?)` (D8): the four queries, bucketing by the six ranges, groups for every category, `fixed` with the D11 `isCharged` rule and `day ?? 1`, the copy RPC before reading budgets of the cycle in progress, budgets from the shown cycle's rows (marker = none), bars on spending without recurring charges, income entries with `recurring`, savings cycle/accumulated/target/history, `history`, `freeMargin` from `getFreeMargin`, `definitions` — verify `tsc` and that the assembled object for the test user (task 6.2) matches `dashboard-data` → *Seeded cycle*: 2 820 / 1 700 / 146 / 844, "transporte" 80 of 100, accumulated 2 646, six history points
- [ ] 4.4 Create `expenses.ts`, `income.ts`, `savings.ts` factories (D13: `.select()` on every write, empty result → reject, `T12:00:00Z` dates, `moneda` from context, negative `monto` for withdrawals) — verify `tsc`
- [ ] 4.5 Create `categories.ts` (RPCs of 3.1, `duplicate-category-name` → `DUPLICATE_CATEGORY_NAME`) and `recurring.ts` (RPCs plus `stop` as a plain update) — verify `tsc`
- [ ] 4.6 Guard the demo: — verify `grep -rn "lib/supabase/server\|lib/data/supabase" app/demo lib/demo components` prints nothing

## 5. Routes and strings

- [ ] 5.1 Add the `inicio` and `acceso` namespaces to `messages/es.json` and `messages/en.json` (D16) and set `app/layout.tsx` metadata title to "Mango" — verify `tsc` and `npm run lint`
- [ ] 5.2 Rewrite `app/page.tsx` as Home: two links, "Demo" → `/demo` and "Entrar" → `/login`, texts from `inicio` — verify the page renders the two links in Spanish and "Log in" in English (locale cookie) and that `/` makes no request to a Supabase host
- [ ] 5.3 Create `app/login/actions.ts` (`sendMagicLink`, `shouldCreateUser: false`, same `sent` result for success and "signups not allowed", `error` otherwise) and `app/login/page.tsx` (signed-in → `redirect('/dashboard')`; otherwise `LoginForm` with `useActionState`, e-mail input `type="email" required`, sent/error messages, `?error=enlace` message) — verify `tsc` and that `/login` renders the form with placeholder env values
- [ ] 5.4 Create `app/auth/confirm/route.ts` (`verifyOtp({ token_hash, type })`, redirect to `/dashboard`, errors to `/login?error=enlace`) — verify `tsc` and that `GET /auth/confirm` without params redirects to `/login?error=enlace`
- [ ] 5.5 Create `app/dashboard/actions.ts` (`'use server'`): one action per contract operation building the `DataContext` from `findCurrentUsuario`, calling the factories of section 4 and `revalidatePath('/dashboard')`; `signOut` (`auth.signOut()` + `redirect('/')`) — verify `tsc`
- [ ] 5.6 Create `app/dashboard/page.tsx` (session check → `redirect('/login')`; unlinked → message + sign-out form; else `resumenMensual` with `parseMonthParam(searchParams.mes)`) and `app/dashboard/supabase-dashboard.tsx` (D14: charges via `selectUpcomingCharges`, actions from 5.5, `changeLanguage`, cycle navigation through `?mes=`, `nextCycle` always supplied and disabled by the shared month selector on the cycle in progress, no `openSavingsHistory`, no `notice`) — verify `tsc` and `npm run build`

## 6. Test user seed

- [ ] 6.1 Write `supabase/seed/test-user.sql` (D15): header with the run instructions, `do` block with the placeholder e-mail first, raise when the auth user is missing, upserts for `usuarios`/`categorias`/`movimientos_recurrentes`, `presupuestos` rows for the current cycle and each of the five past ones keyed by each cycle's first day, deterministic-id transactions for the current cycle and five past cycles reaching the totals in `test-user-seed` → *The seeded cycle is believable and current* — verify by static review that every `on conflict` targets an existing unique constraint and that no `insert` lacks one
- [ ] 6.2 Create the auth user and run the script on the real project (proposal → *Manual steps* 5–6) — verify it completes without error and `select count(*) from transacciones where usuario_id = (select id from usuarios where email = '<placeholder>')` matches the number of seed rows
- [ ] 6.3 Run the script a second time — verify every per-table count for the test user is unchanged (`test-user-seed` → *Second run*)

## 7. Automated verification

- [ ] 7.1 Add `tests/home.spec.js`: `/` shows "Demo" and "Entrar", each navigates to its route, and no request to `*.supabase.co` is made — verify `npx playwright test tests/home.spec.js` passes with placeholder `NEXT_PUBLIC_SUPABASE_*` values in the environment
- [ ] 7.2 Add `tests/login-access.spec.js`: `/login` renders the e-mail field and submit; "brian" is refused without a request; `/dashboard` and `/dashboard?mes=2026-08` redirect to `/login`; `/demo` still renders the sample notice — verify the spec passes
- [ ] 7.3 Run `npx tsc --noEmit`, `npm run lint`, `npm run build` and the full `npm test` — verify all green, with the pre-existing `/demo` specs unchanged

## 8. Manual verification against the real project

- [ ] 8.1 Complete proposal → *Manual steps* 2–4 (email provider, URL configuration, magic-link template) — verify the template body contains `/auth/confirm?token_hash={{ .TokenHash }}&type=email`
- [ ] 8.2 Log in with the test e-mail: request the link on `/login`, open it from the inbox — verify landing on `/dashboard` with the seeded figures (2.820 € / 1.700 € / 146 € / 844 €, accumulated 2.646 €, "comida" 310 of 400, "transporte" 80 of 100, six bars) and the account menu showing the seeded name and phone
- [ ] 8.3 Exercise every operation once and reload after each: add/edit/delete/restore an expense, an income entry, a savings deposit and a withdrawal; create/rename/recolour/re-budget/clear the budget of/reorder/delete a category (delete onto another; after the re-budget and the clear, the previous cycle keeps its own budget, and the cleared one is not copied back on reload); create a recurring expense from the sheet, edit its definition, stop it, delete it — verify each result survives the reload as `dashboard-data` → *Every dashboard operation persists* describes, and that the two-user and foreign-id scenarios hold using Brian's seeded user as the second account
- [ ] 8.4 Navigate cycles: previous, next (disabled on the cycle in progress), the picker, `?mes=abc`, a `?mes=` two months ahead (shows the cycle in progress, and no `presupuestos` row exists after the current cycle) — verify `dashboard-data` → *Figures are scoped to one billing cycle* scenarios
- [ ] 8.5 Open `/login` while signed in, sign out from the account menu, open `/dashboard` again, open a used magic link — verify the `web-access` scenarios *Signed-in visitor on login*, *Log out* and *Expired or reused link*
- [ ] 8.6 Create a second auth user without running the seed and log in with it — verify the "cuenta sin vincular" message and the sign-out action, with no figures
- [ ] 8.7 Open `/demo` signed in with the network panel recording, open every panel and add an expense, an income entry and a savings movement — verify no request to a Supabase host and the sample figures unchanged
- [ ] 8.8 Record the outcome of 8.1–8.7 in this file (a line per task, with the date) and update `CLAUDE.md` → *Estado actual*, *Proyección* and *Deuda técnica* (real data layer done for the web; `estado`, cron, null `dia_del_mes`, `repeticiones_insertadas` divergence, currency mixing, and 0015–0018 status; remove the "Supabase implementation of `BudgetRow`" entry left by `fix-free-margin-envelope-budgets`) — verify the debt list no longer says the contracts have no real implementation
