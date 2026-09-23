## Why

Every screen of the product exists, but only over in-memory sample data on `/demo`: `app/page.tsx` is still the `create-next-app` boilerplate, nothing signs a user in, and the mutation contracts in `lib/data/` have no implementation other than `lib/demo/`. This change is the first one that puts a real user in front of real rows: log in with a magic link and see your own cycle out of Supabase, with `/demo` untouched.

## What Changes

- **Home (`/`)** replaces the boilerplate with two actions: *Demo* → `/demo` and *Entrar* → `/login`. No design work, no session check.
- **Login (`/login`)**: an e-mail field and a submit button. Submitting sends a Supabase magic link; the page then says to check the inbox. The link lands on a route that verifies the token server-side and opens a session. A signed-in visitor is sent to the dashboard.
- **Protected dashboard (`/dashboard`)**: the same `DashboardTemplate` as `/demo`, mounted with data from `resumenMensual` and with the Supabase implementations of every contract injected. Without a session it redirects to `/login`. With a session whose `auth.users` row is not linked to a `usuarios` row it shows a "cuenta sin vincular" message and a log-out action instead of data. Log out is wired (`DashboardActions.signOut`). The month controls navigate between the user's cycles (`?mes=YYYY-MM`); a cycle after the one in progress is not offered, and a `?mes=` naming one shows the cycle in progress instead.
- **Supabase data layer** (`lib/data/supabase/`), running in parallel to `lib/demo/`: implementations of `ExpenseMutations`, `IncomeMutations`, `SavingsMutations`, `CategoryMutations` and `RecurringMutations`, a `resumenMensual(usuario, mes)` that builds `DashboardData` plus the `RecurringDefinition[]` for one billing cycle (`rango_ciclo` from migration 0010, the user's `dia_inicio_ciclo` and `timezone`), and the six-cycle histories of expenses and accumulated savings. Savings (`tipo = 'ahorro'`) enter as the cycle's signed total and the all-time accumulated balance. The free margin comes from the shared `getFreeMargin` (income − savings − fixed expenses − Σ max(budget, spent) − unbudgeted spending). Budgets are read per cycle, from the `presupuestos` rows of the shown cycle. When a cycle becomes current and has none, a SQL function copies them from the most recent cycle that has any. Every query runs through the anon key and RLS as the signed-in user; the service-role client stays where it is (bot only).
- **Execution model**: the dashboard's operations are Next server actions that create a cookie-bound Supabase client and call the implementations, then revalidate the page. The browser bundle never contains a Supabase client. The `lib/data/supabase/*` functions take a client and a `usuarios.id`, so the bot can reuse them later with its service-role client (ARCHITECTURE §3, one data layer).
- **Migration `0017_funciones_dashboard.sql`**: SQL functions (RLS-respecting, `security invoker`) for the operations that touch more than one row and must reject with nothing changed: create/update/delete/reorder category, and create/update/delete recurring definition. It also adds the per-cycle budget copy (`copiar_presupuestos_ciclo`). Single-row operations are plain PostgREST calls.
- **Prerequisite `fix-free-margin-envelope-budgets`**: it must be archived first. It provides:
  - `getFreeMargin` and `BudgetRow` in `lib/data/budget.ts`
  - migration `0018` (`presupuestos.periodo` as the cycle's first day, `monto` nullable as the "no budget" marker) and the edited `0012` seed
  - the per-cycle budget rules in `category-editing`
  - the month selector that disables "next" on the cycle in progress

  This change implements those rules against Supabase and does not redefine them.
- **Session plumbing**: `@supabase/ssr` (new dependency), a cookie-based server client in `lib/supabase/server.ts`, and a root `proxy.ts` (Next 16's name for middleware) that refreshes the session cookies and redirects unauthenticated `/dashboard` requests. Its matcher excludes `/` and `/demo`, so the demo never instantiates a Supabase client.
- **Test user**: `supabase/seed/test-user.sql`, a standalone script (not a migration) with a placeholder e-mail at the top. It links the `auth.users` row created from the dashboard to a `usuarios` row (`auth_user_id`, which is what `usuario_actual_id()` and every policy in 0011/0015 resolve through) and seeds a believable current cycle: categories, budgets half spent on comida and ocio, recurring definitions with this cycle's charges, income, savings movements, and five past cycles for the charts. Deterministic ids and `ON CONFLICT` make a second run update rather than duplicate. Step-by-step run instructions live in the file's header and in *Manual steps* below.
- **Strings**: new `inicio` and `acceso` namespaces in `messages/es.json` / `en.json`; `app/layout.tsx` metadata stops saying "Create Next App".
- **Correction to the request**: `SavingsMutations` already exists (`lib/data/savings.ts`, `addSavingsMovement`), with its in-memory implementation in `lib/demo/demo-savings.ts` and the sheet wired, from `add-savings-mutations` (complete, not yet archived). This change adds only the Supabase implementation and does not touch `lib/demo/`. It assumes `add-savings-mutations` is archived first, so that `savings-editing` exists as a main spec.
- **Not in this change**: visual design for Home and Login, Google OAuth, the WhatsApp bot and its web-access code, the recurring cron, editing `meta_ahorro_mensual`, optimistic UI, generated database types.

## Capabilities

### New Capabilities
- `web-access`: the routes a person can reach (`/`, `/login`, `/auth/confirm`, `/dashboard`, `/demo`), magic-link sign-in, session protection of the dashboard, the unlinked-account state, and sign-out.
- `dashboard-data`: what the signed-in dashboard shows — the user's own rows only, scoped to one billing cycle in the user's timezone, with savings in the summary — and that every dashboard operation persists with the outcomes the existing contracts promise.
- `test-user-seed`: the standalone SQL script that makes an `auth.users` row a usable test account: linking, seeded cycle, idempotency and run instructions.

### Modified Capabilities
- None. `expense-editing`, `income-editing`, `category-editing`, `category-reordering`, `category-creation` and `savings-editing` already require "the same operations on another data source"; this change fulfils them without changing them. `dashboard-ui`'s *Public demo route* is unchanged: `/demo` keeps its in-memory implementation and its disabled month navigation and log-out.

## Impact

- **New**: `app/login/` (page + server action), `app/auth/confirm/route.ts`, `app/dashboard/` (page, client wrapper, server actions), `proxy.ts`, `lib/supabase/server.ts`, `lib/data/supabase/{user,cycle,dashboard,expenses,income,savings,categories,recurring}.ts`, `supabase/migrations/0017_funciones_dashboard.sql`, `supabase/seed/test-user.sql`, Playwright specs for Home, Login and the redirect.
- **Changed**: `app/page.tsx` (rewritten), `app/layout.tsx` (metadata), `messages/es.json`, `messages/en.json`, `package.json` (`@supabase/ssr`), `CLAUDE.md` (status and debt).
- **Untouched**: `lib/demo/*`, `app/demo/*`, every component under `components/`, `lib/supabase/admin.ts`, existing migrations (0001–0016, plus 0018 and the 0012 edit from the prerequisite).
- **Environment**: `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` in `.env.local` (names from ARCHITECTURE §2; the value may be the project's legacy anon JWT or its new `sb_publishable_…` key). `SUPABASE_SERVICE_ROLE_KEY` is not needed by anything in this change.
- **Tests**: the existing `/demo` specs keep passing unchanged. Specs against `/dashboard` need a live Supabase project and cannot run in this environment (no docker, Supabase CLI or psql); the tasks list a manual verification against the real project instead.

## Gaps between schema and architecture (flagged, not decided)

Each of these is worked around in `design.md` with an explicit, provisional rule; none is silently resolved.

1. **`transacciones.estado` does not exist.** §7/§8 rely on `pendiente | confirmada` for "charged vs pending" and for reconciling a definition update with this cycle's pending charge; 0008 and 0015 never created the column (already in `CLAUDE.md` → *Deuda técnica*). Provisional rule: a charge is *charged* when its local date is not after the cycle's today, which is what the demo does. Adding the column belongs with the cron.
2. **No cron inserts recurring charges.** A real cycle has no rows from `movimientos_recurrentes` unless something writes them. The seed writes this cycle's charges by hand; from the next cycle on, "Próximos cobros" will be empty for the test user until the cron exists.
3. **`movimientos_recurrentes.dia_del_mes` is nullable**, and 0012 seeds Brian's definitions with nulls, but `RecurringDefinition.day` is a number and the sheet requires one. Provisional rule: a null day is shown as day 1. Deciding whether the column should become `NOT NULL` is left open.
4. **`usuarios.telefono` is `NOT NULL` and unique.** A web-first test account has no phone; the seed uses a valid-shaped placeholder (`+10000000001`) and says so.
5. **`repeticiones_insertadas` for a definition created from the sheet.** The entry sheet creates this cycle's row and the definition in one save; the demo shows "0 of N" afterwards. The Supabase implementation links that row to the new definition and counts it as the first repetition ("1 of N"), because a plan of N pays N times and that row is one of them. The two implementations disagree on this figure until the demo is aligned or the cron change decides otherwise.
6. **`moneda` per row.** Mutations write `usuarios.moneda_default`; `resumenMensual` sums `monto` regardless of `moneda` and labels everything with the user's currency. Rows the bot may one day store in another currency would be summed unconverted.
7. **Migrations 0015 and 0016 were never applied to a real database**, only reviewed statically. 0017 and the prerequisite's 0018 join that list. The first manual step applies all of them in order and stops at the first failure.
8. **`ingresos_esperados`** stays unread, as today.
9. **`status.md`** does not exist in the repository; the status that CLAUDE.md carries was used instead.

## Manual steps in the Supabase dashboard

In this order, once, before the first login:

1. **Apply the migrations.** SQL Editor → run `supabase/migrations/0001…0018` one file at a time, in order (or `supabase db push` if the CLI is available elsewhere). Do this only after `fix-free-margin-envelope-budgets` is archived: the old 0012 writes `'mensual'`, which 0018's cast to `date` rejects. If 0015 fails, stop: the rest of this change assumes the renamed table and columns.
2. **Email provider.** Authentication → Sign In / Providers → *Email*: enabled (default). Turn **off** "Allow new users to sign up": the app asks Supabase not to create users from the login form, and this closes the other door.
3. **URL configuration.** Authentication → URL Configuration: Site URL `http://localhost:3000`; Redirect URLs: add `http://localhost:3000/auth/confirm`. Add the Vercel URLs the same way when deploying.
4. **Magic-link e-mail template.** Authentication → Email Templates → *Magic Link*: replace the `{{ .ConfirmationURL }}` link with `{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type=email`. The default link carries the session in a URL fragment the server never sees; the token-hash link is verified server-side and works even when the e-mail is opened in a different browser than the one that requested it.
5. **Create the test auth user.** Authentication → Users → *Add user* → *Create new user*: the test e-mail, "Auto Confirm User" checked. The password is unused.
6. **Run the seed.** Open `supabase/seed/test-user.sql`, replace the placeholder e-mail at the top, paste it into the SQL Editor and run it. It fails with a clear message if step 5 was skipped.
7. **Keys.** Project Settings → API: copy the project URL and the anon/publishable key into `.env.local` as `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
8. **Rate limit to know about.** Supabase's built-in mailer allows only a handful of auth e-mails per hour per project. Requesting several magic links while testing hits it; either wait, or configure custom SMTP under Project Settings → Authentication → SMTP.
