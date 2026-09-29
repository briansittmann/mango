> Written on top of `replace-magic-link-with-email-otp` (open): archive that change first (design → Risks, archive order). Order of the rollout is design → Migration Plan: migration → templates → deploy → sign-ups on. Brian's row and auth user must come out of every step unchanged. Brian runs the Playwright specs; Claude runs typecheck, lint and unit tests.

## 1. Database

- [x] 1.1 `supabase/migrations/0025_alta_web.sql`: `alter table usuarios alter column pais drop not null`; function `public.crear_usuario_desde_auth()` per D1–D3 (`security definer`, `set search_path = ''`, qualified names, `idioma`/`timezone` validated from `raw_user_meta_data`, `nombre` = `split_part(email, '@', 1)`, `moneda_default` `EUR`, `insert … on conflict do nothing`, the whole body inside `exception when others then raise warning`); `revoke execute … from public, anon, authenticated`; trigger `after insert on auth.users … when (new.email_confirmed_at is not null)` and trigger `after update of email_confirmed_at on auth.users … when (old.email_confirmed_at is null and new.email_confirmed_at is not null)`; header comment in Spanish like the other migrations (why on confirmation, why it never raises) — verify the file reads coherently and nothing in it references an existing row
- [x] 1.2 Before applying: save Brian's state with `select * from usuarios` and `select id, email, email_confirmed_at, raw_user_meta_data, updated_at from auth.users` (MCP, read-only) and paste the two results here
  - 2026-09-28 16:01 UTC, `usuarios` (1 row): `{"id":"b41090cc-c7c8-4c89-bdd2-e4109a9db2cf","auth_user_id":"42334531-a19e-428e-aab8-b0992008b51c","telefono":"+353851528917","nombre":"Brian","email":"brianrebadj@gmail.com","pais":"IE","timezone":"Europe/Dublin","moneda_default":"EUR","onboarding_completo":true,"recordatorio_diario":false,"dia_inicio_ciclo":28,"idioma":"es","foto_url":null,"cargas_confirmadas":0,"modo_confirmacion":"auto","meta_ahorro_mensual":null,"ciclo_generado_hasta":"2026-09-28"}`
  - `auth.users` (1 row): `{"id":"42334531-a19e-428e-aab8-b0992008b51c","email":"brianrebadj@gmail.com","email_confirmed_at":"2026-09-24 01:41:22.692236+00","raw_user_meta_data":{"email_verified":true},"updated_at":"2026-09-28 14:32:41.196512+00"}`
  - Security advisors before `0025`: `rls_enabled_no_policy` (`canales`), `function_search_path_mutable` (`rango_ciclo`, `rango_ciclo_usuario`, `fecha_en_ciclo`), `anon_/authenticated_security_definer_function_executable` (`usuario_actual_id`), `auth_leaked_password_protection`
- [x] 1.3 Apply `0025` through the MCP (`apply_migration`), with Brian's confirmation first — verify: `\d`-equivalent query shows `pais` nullable and both triggers on `auth.users`; re-running the 1.2 queries returns the same values; `get_advisors` (security) reports nothing new for the function
  - Applied 2026-09-28 ~16:08 UTC as `0025_alta_web`, with Brian's go-ahead. `pais` nullable; `crear_usuario_al_crear_confirmado` and `crear_usuario_al_confirmar` on `auth.users`; the function is `security definer`, owner `postgres`, `search_path=""`, execute only for `postgres` and `service_role`. The 1.2 rows are identical (same `updated_at`), `count(*) from usuarios` = 1. Advisors: the same five as before, none about the new function.

## 2. Request route and language

- [x] 2.1 `app/auth/request-code/route.ts` (D5): `POST { email, idioma, timezone }` → `{ status, email? }`, same checks and `sendStatus` mapping as `requestCode`, `shouldCreateUser: true` and `data: { idioma, timezone }` (each only when valid), never throws; header comment on why a route and not a server action — verify `npx tsc --noEmit`
- [x] 2.2 `app/login/login-form.tsx` and `app/login/login-steps.tsx`: a client function posts to `/auth/request-code` with `useLocale()` and the browser's timezone, used by the e-mail step (inside `useActionState`) and by "Reenviar"; remove `requestCode` from `app/login/actions.ts` (and the file if it is left empty) — verify `npx tsc --noEmit`, `npm run lint`, and `grep -rn "requestCode\|shouldCreateUser: false" app` finds nothing
- [x] 2.3 `app/actions/language.ts` (D7): after setting the cookie, with a session (`getClaims`), `auth.updateUser({ data: { idioma } })`; errors swallowed and logged — verify `npx tsc --noEmit`, and on `/demo` signed out that switching language still works with no request to Supabase from the browser
  - `/demo` signed out at 390 px: switching to English sets `locale=en`, the page re-renders in English, and the browser made no request to a Supabase host.

## 3. Copy and Home

- [x] 3.1 `messages/es.json` / `messages/en.json`: `inicio.descripcion` (what Mango is + the WhatsApp bot is by invitation) and `acceso.primeraVez` (D9) — verify the key sets of both catalogs are equal (`node -e` diff) and `npx tsc --noEmit`
- [x] 3.2 `app/page.tsx`: the line under the two buttons (D9 classes, `design-system` type scale) — verify `npx tsc --noEmit` and a screenshot at 390 px and desktop, light and dark
  - Screenshots at 390 px and 1280 px, light and dark: the line sits centred under the buttons, `max-w-sm`, muted.
- [x] 3.3 `app/login/login-form.tsx`: the `primeraVez` hint under the field (D9) — verify a screenshot of the e-mail step at 390 px, light and dark, and that the card keeps the 16 px gutter
  - Screenshots at 390 px, light and dark: the hint sits under the field; the card is at x=16 with 16 px on the right and no horizontal scroll.

## 4. Mail template

- [x] 4.1 `public/email/mango-logo.png`: 2× PNG export of `public/mango-logo-light.svg` at the size the template shows — verify the file opens and `https://www.usemango.dev/email/mango-logo.png` path matches `public/`
  - 2026-09-29, after Brian saw the real mail: the full 1024 canvas carried the SVG's empty margin, so the fruit sat indented from the heading and far from "Mango". Re-exported cropped to the fruit (62×72, shown at 31×36) and the template's `<img>` size and gap updated; the panel templates need pasting again after the deploy.
- [x] 4.2 `supabase/templates/codigo.html` (D6, D8): table layout, inline light colours from the tokens, dark `@media` block, Manrope link and fallback stack, logo by absolute URL, the code as a standalone number, es/en through the guarded `$en` branch, no link; top comment with both subjects and "paste into *Confirm signup* and *Magic Link*" — verify: `grep -n "href=" supabase/templates/codigo.html` shows only the font link; every colour matches a token of `app/globals.css`; the file opened in a browser (with `{{ … }}` visible) lays out correctly at 375 px and 600 px
  - `href=` shows only the font link and all 14 colours are tokens. Opened in Chromium at 375 and 600 px, light and dark: centred card with a 16 px gutter at 375, no horizontal scroll, dark block applied; the logo shows broken locally because its absolute URL is not deployed yet. The `eq` compares `printf "%v" .Data.idioma`, so a non-string `idioma` (a user can write their own metadata) cannot make Go's `eq` fail and drop the mail. Not rendered with Go locally (no Go toolchain): the first real render is 7.4.

## 5. Tests

- [x] 5.1 `tests/home.spec.js`: the line is visible and mentions the invitation; in English with the `locale=en` cookie; the no-Supabase-request test unchanged — verify `npx tsc --noEmit` (👤 Brian runs the spec)
- [x] 5.2 `tests/login-signup.spec.js` (D10): hint visible; with `/auth/request-code` stubbed as `sent`, a new address reaches the code step and `/login?email=`; the stubbed request body carries the address, `en` and `Europe/Madrid`; stubbed `rate_limited` and `error` show their messages; no request to a Supabase host — verify `npx tsc --noEmit` (👤 Brian runs the spec)
- [x] 5.3 👤 Brian runs `npx playwright test tests/home.spec.js tests/login-signup.spec.js tests/login-code.spec.js tests/login-access.spec.js` — record the result here
  - Run by Claude at Brian's request, 2026-09-29, `--workers=3`: all tests of the four specs pass in Chromium, Firefox and WebKit.

## 6. Documentation

- [x] 6.1 `ARCHITECTURE.md`: §2 Auth row "código por mail (Google, en el bloque 13)" and a decision note (registration opens with the code only); §4 *Onboarding web* step 1 and *Comunes*: the row is created at the first confirmed code by a trigger, the person lands on an empty dashboard until block 9; §8 `pais` nullable and the trigger; §10 rate limiting: open registration without a limiter, the shared 30/h and the brake; §11 two rows: "Registro abierto sin rate limiting (bloqueo del cupo de mails)" and "Auth users sin confirmar" — verify `grep -n "Google" ARCHITECTURE.md` shows Google only as block 13 or history
- [x] 6.2 `ROADMAP.md` block 8: tick the 🤖 items when done, and the 👤 sign-ups item after 7.4 — verify the block reads coherently
- [x] 6.3 `CLAUDE.md` technical debt: remove "Mail de Auth solo en espanol" and "Mail del codigo sin marca"; add "Todos en EUR hasta el onboarding", "Auth users sin confirmar sin limpieza", "`usuarios.idioma` no sigue al selector" and "Registro sin rate limiting ni CAPTCHA (bloque 10)"; do not touch "Estado actual" (archive time) — verify the removed items are gone and the new ones cite this change

## 7. Rollout (👤 Brian, needs the real project and a real mail)

> Use a `+` alias of your mailbox as the new address (for example `brianrebadj+alta1@gmail.com`): it is a new account for Supabase and lands in your inbox. Note what you saw next to each step.

- [x] 7.1 Resend: read the plan's daily cap in the Resend dashboard and write it here next to the 30/h of Supabase
  - Resend free plan: 100 mails per day (Brian, 2026-09-29), next to Supabase's 30 per hour. The daily 100 is the real ceiling: a little over three hours of the hourly cap.
- [x] 7.2 Supabase → Auth → Emails → *Confirm signup*: paste `supabase/templates/codigo.html` and the subject line from its top comment. Test with sign-ups still off: nothing to test yet; move on
  - Pasted by Brian, 2026-09-29.
- [x] 7.3 Deploy the branch to production (after 1.3). With sign-ups still off, on `/login` submit the new alias: the code step shows, no mail arrives, and `select count(*) from auth.users` (🤖, MCP) is still 1
  - Deployed (`fbe1dfb`). With sign-ups off, the alias got the code step and no account: the auth logs show two `/verify` → 403 "User not found" at 23:44 UTC and `auth.users` stayed at 1.
- [x] 7.4 Supabase → Auth → Sign In / Providers: turn on *Allow new users to sign up*. Then, with the page in English, submit the alias: an English mail arrives with the logo and the code, subject "Your Mango code". Type the code: success, "Ir a mi mes", an empty dashboard of the cycle in progress, no "cuenta sin vincular". 🤖 checks by MCP that the alias has a `usuarios` row with name, `en`, your browser's timezone, `EUR`, cycle 1, `onboarding_completo` false, `pais` null
  - Sign-ups on at 00:10 UTC (config reload in the auth logs). The alias was created at 00:11 by a request from a page in Spanish, so its metadata and its mail were Spanish, not English; the English branch was checked instead with Brian's own account (7.6) and the second alias carried `en` (7.7). Code accepted at 00:16, dashboard shown. `usuarios` row checked by MCP: name `brianrebadj+alta1`, `es`, `Europe/Dublin`, `EUR`, cycle 1, `onboarding_completo` false, `pais` null.
- [x] 7.5 Supabase → Auth → Emails → *Magic Link*: paste the same template and subject. Sign out of the alias, request a code for your own address from `/login`: the mail arrives in Spanish with the new design (your account has no stored language), and you sign in to your data. 🤖 re-runs the 1.2 queries: your row unchanged, only `last_sign_in_at`-type auth fields moved
  - Pasted by Brian; his own address got the new design and signed in to his data. His `usuarios` row is unchanged (same values as 1.2); in `auth.users` only sign-in fields and `raw_user_meta_data.idioma` moved (the latter by 7.6).
- [x] 7.6 Language sync: signed in as the alias, switch to Spanish in the account menu, sign out, request a code: the mail arrives in Spanish
  - Done with Brian's own account: after switching to English in the account menu, the next code mail came in English. His metadata now holds `idioma: en`.
- [x] 7.7 Unconfirmed address: submit a second alias and do not type the code. 🤖 checks by MCP that it has an `auth.users` row and no `usuarios` row
  - `brianrebadj+alta2@gmail.com`: auth user with `email_confirmed_at` null and metadata `en` / `Europe/Dublin`, no `usuarios` row.
- [x] 7.8 Cleanup (🤖, MCP, with your confirmation, filtered by the exact alias addresses and never by anything that matches your account): delete the aliases' `usuarios` rows (their data cascades), then their `auth.users` rows; re-run the 1.2 queries and `select count(*) from usuarios` → 1
  - 2026-09-29, with Brian's go-ahead, filtered by the two exact addresses: the alias's `usuarios` row, then both auth users. After: 1 auth user, 1 `usuarios` row, Brian's row identical to 1.2.
