## Why

Block 8 of `ROADMAP.md` opens Mango to people who are not Brian: the web registration is open to anyone and WhatsApp stays by invitation (`ARCHITECTURE.md` §4, *Dos puertas de entrada, una cuenta*). Today nobody new can get in: sign-ups are off in Supabase Auth, `/login` asks for the code with `shouldCreateUser: false`, so an unknown address gets the code step and a code that never arrives, and an auth user with no `usuarios` row lands on "cuenta sin vincular". The code mail, which will now be the first thing a stranger receives from Mango, goes out in Spanish only and unbranded. Google moved to block 13: the code by mail is the only way in.

## What Changes

- **Open registration on the same form.** `/login` keeps its two steps (from `replace-magic-link-with-email-otp`); the e-mail step now creates the account when the address has none, and says so in one line under the field ("if it is your first time, we create your account with this e-mail"). An unknown address receives a real code and ends signed in, instead of waiting for a mail that never comes. The page still answers the same for a registered and an unregistered address.
- **The request carries the visitor's language and timezone.** The e-mail step sends the active language (`es`/`en`) and the browser's IANA timezone with the address; they are stored as the auth user's metadata when the account is created and never change an existing account. The request moves from a server action to a route handler, `POST /auth/request-code`, like `/auth/verify-code` already is, so the browser tests can stub it without a database.
- **The `usuarios` row is created by the database when the address is confirmed.** A trigger on `auth.users` inserts the row the moment an auth user has a confirmed e-mail (a new user verifying their first code, or a user created already confirmed), with defaults: name from the e-mail's local part, `moneda_default` `EUR`, `timezone` from the metadata (else `UTC`), `idioma` from the metadata (else `es`), `dia_inicio_ciclo` 1, `onboarding_completo` false, `pais` empty. It never raises: a failure leaves the auth user without a row, which is the old "cuenta sin vincular" state. `pais` becomes nullable (it is read by no code; the onboarding of block 9 fills it). Brian's row and auth user are not touched: his address is already confirmed, so neither trigger path fires for him.
- **A new account lands on an empty `/dashboard`.** No onboarding placeholder: "Ir a mi mes" leads where it leads today, and the empty dashboard already lets the person add categories, income and expenses. The redirect to the onboarding comes with block 9 (`onboarding_completo`).
- **"Cuenta sin vincular" stops happening for new users** by construction. The message stays for the edge cases the trigger skips (an address already held by another `usuarios` row, a trigger failure).
- **Home explains Mango.** Under "Demo" and "Entrar", one line saying what Mango is and that the WhatsApp bot is by invitation, in es/en.
- **Branded, bilingual code mail.** One HTML template in the repo (`supabase/templates/codigo.html`) with Mango's logo, the `design-system` colours and type, and the code as a standalone number; Spanish or English by the auth user's metadata (`{{ .Data.idioma }}`), Spanish when it is missing. The same template goes into Supabase's *Magic Link* template (existing users) and *Confirm signup* template (a new address's first code). Changing the language in the account menu while signed in updates that metadata, so the next mail follows the last language the person chose.
- **Panel steps (👤 Brian), in order:** migration applied → both templates pasted → deploy → sign-ups on. Turning sign-ups off again is the emergency brake: the app keeps working for existing accounts and an unknown address falls back to today's silent answer.
- Tests: `tests/home.spec.js` (the line, in both languages) and a new `tests/login-signup.spec.js` (the new-account hint; a new address, with the request stubbed, reaches the code step; the request carries language and timezone). The trigger, the mail and the empty dashboard are checked by hand against the real project.
- Documentation: `ARCHITECTURE.md` §2 (Auth row: code by mail only, Google in block 13), §4 (row created at confirmation, first landing), §8 (`pais` nullable), §10 and §11 (open registration without rate limiting, the mail cap); `ROADMAP.md` block 8; `CLAUDE.md` technical debt (the two mail items close, new items from *Risks*).

### Not in this change

Google login (block 13), the real onboarding and its redirect (block 9), invitations and rate limiting (block 10), CAPTCHA on the e-mail step, cleanup of auth users that asked for a code and never confirmed.

### Risks named up front

- **Open registration without rate limiting.** Anyone can type any address and make Mango send it a code. Supabase caps it (one code per address per 60 s; 30 mails per hour for the whole project through Resend), which bounds the damage but turns it into a lock-out: whoever spends the 30 mails of the hour leaves every user, Brian included, without a code until the hour turns. Mails to addresses that never asked hurt the sending domain's reputation. Mitigations now: the per-address interval, the hourly cap, and the sign-ups switch as a brake; later (block 10): rate limiting on registration and a CAPTCHA.
- **Resend's own plan limit** (the free plan caps mails per day as well as Supabase's per-hour cap) applies to sign-ins and sign-ups together.
- **Unconfirmed auth users accumulate** (someone asks for a code and never types it). They get no `usuarios` row, because the row waits for confirmation; the `auth.users` rows stay until a cleanup exists.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `web-access`: Home gains the line about Mango and the invitation-only bot; *Sign-in by e-mail code* (as left by `replace-magic-link-with-email-otp`) creates the account for an unknown address and carries language and timezone; new *Account created on first confirmed sign-in* and *Branded sign-in e-mail in the user's language*; *Unlinked account* narrows to the cases the trigger skips.

This change is written on top of `replace-magic-link-with-email-otp`: its `web-access` delta modifies requirements that change adds. Archive that change first.

## Impact

- `supabase/migrations/0025_alta_web.sql` (new): `usuarios.pais` nullable, the trigger function and the two triggers on `auth.users`. Applied before the deploy, like `0024`.
- `app/auth/request-code/route.ts` (new) replaces `requestCode` in `app/login/actions.ts`; `app/login/login-form.tsx` and `app/login/login-steps.tsx` call it with `fetch`; `lib/auth/otp-status.ts` unchanged.
- `app/actions/language.ts`: with a session, also writes `idioma` to the auth user's metadata.
- `app/page.tsx` and `messages/es.json` / `messages/en.json` (`inicio.descripcion`, `acceso.primeraVez`).
- `supabase/templates/codigo.html` (new) and `public/email/mango-logo.png` (new, the logo as PNG for mail clients).
- `tests/home.spec.js`, `tests/login-signup.spec.js` (new).
- `ARCHITECTURE.md`, `ROADMAP.md`, `CLAUDE.md`.
- Supabase panel (Brian): both templates and their subjects, sign-ups on. No new dependency, no new environment variable.
