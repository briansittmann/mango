## 1. Base

- [x] 1.1 Write `supabase/migrations/0040_nombre_del_proveedor.sql`: `create or replace function crear_usuario_desde_auth()` with the `0025` body and the name from `full_name` / `name` / the local part, cut to 60 (D4); triggers untouched. Verify by reading it against `0025` that only the name expression changed.
- [x] 1.2 👤 Apply `0040` to the real project (MCP with Brian's confirmation, or SQL editor), before the deploy; verify with `pg_get_functiondef` that the function has the new name expression and the two triggers still exist.

## 2. Server

- [x] 2.1 `lib/auth/signup-prefs.ts` (pure): build and parse the `mango-alta` cookie value, keeping `idioma` only for `es`/`en` and a timezone only when it is a known IANA name (D3); `lib/auth/signup-prefs.test.mjs` covers valid, unknown language, unknown timezone, malformed JSON and empty. Verify with `npm run test:unit`.
- [x] 2.2 `app/auth/google/route.ts`: `POST` with `{ idioma, timezone }`, `signInWithOAuth` with `skipBrowserRedirect` and `redirectTo` from the request's origin, sets the PKCE and `mango-alta` cookies (httpOnly, lax, path `/auth`, 600 s), answers `{ url }` or `{ status: 'error' }` (D1). Verify with a local `curl -i -X POST` that the answer carries a Google URL and both `Set-Cookie`.
- [x] 2.3 `app/auth/confirm/route.ts`: provider `?error=` and a failed exchange with `mango-alta` present go to `/login?error=google`; after a successful exchange read and delete the cookie and, if the row is at `onboarding_paso = 1` and not completed, update `idioma`/`timezone` and the auth metadata's `idioma` (D2, D3). The token-hash path and a bare `?code=` keep their behaviour. Verify the error mapping with `curl -i "localhost:3000/auth/confirm?error=access_denied"` (redirect to `/login?error=google`) and that `?token_hash=bad&type=magiclink` still goes to `?error=enlace`.

## 3. Login UI

- [x] 3.1 `components/atoms/google-g.tsx`: the four-colour "G" as inline SVG, `aria-hidden`. Verify it renders at 20px with its four colours in a screenshot.
- [x] 3.2 `login-form.tsx`: "Continuar con Google" above the field with the "o" divider, Google's dark values, `h-target`, press scale and spinner fold while the redirect is prepared, a second click ignored, part of the staggered entrance; `error=google` shows `acceso.errorGoogle`, as does a failed request (D5). `login-steps.tsx` and `page.tsx` pass the error through. Texts `acceso.continuarConGoogle`, `acceso.o`, `acceso.errorGoogle` in `messages/es.json` and `en.json`. Verify on `/login` at 390px and 1280px with screenshots, reduced motion included.
- [x] 3.3 `tests/login-google.spec.js` with `/auth/google` stubbed by `page.route`: button above the field with the four-colour mark and the three Google values (computed styles); English labels; the request body carries `en` and the stubbed timezone and the page goes to the returned URL (stubbed); busy state and a single request on double click; failed request shows the message; `/login?error=google` shows it and `?error=enlace` keeps its own; axe on the e-mail step. Verify it passes in Chromium, Firefox and WebKit, and `login-code`, `login-signup` and `login-access` still pass.
- [x] 3.4 Brian's review (2026-10-17): two ways first ("Continuar con Google", "o", "Continuar con email" with `Mail`), the field behind the second, `GlassBackButton` (field → two ways → `/`), exit and resize transitions, the way not taken leaving on Google, `mt-8` / `mb-6` around the logo (D5b). `login-google` (12 tests), `login-signup` and `login-access` updated; all green in the three browsers.

## 4. Panels and documentation

- [x] 4.1 👤 Google Cloud: consent screen and Web OAuth client with redirect `https://noemlszbjqzqbzagahyd.supabase.co/auth/v1/callback` (D6.1). Verify the client id and secret exist.
- [x] 4.2 👤 Supabase Auth: Google provider on with that client; `http://localhost:3000/auth/confirm` added to the redirect URLs (D6.2). Verify from local that the button reaches Google's account choice.
- [x] 4.3 Add a section to `/privacidad` (`privacidad` in both catalogues): signing in with Google shares the name and the address with Mango, and nothing else is read. Verify the page in both languages.
- [x] 4.4 Docs: `ARCHITECTURE.md` §2 (Auth row: Google and the code), §4 and §8 (row from Google, name from the provider, the cookie); `ROADMAP.md` block 13 (the two Google items); `CLAUDE.md` (status, technical debt: the Supabase host on the consent screen). Verify by reading the diffs.

## 5. Verification against the real project

- [x] 5.1 From local, a new Google account (not Brian's) with the page in English: lands in the onboarding, `usuarios` row with its Google name, `idioma = 'en'` and the browser's timezone; delete the test auth user and row afterwards with Brian's confirmation. Verify by reading the row.
- [x] 5.2 Brian signs in with Google with `brianrebadj@gmail.com`: his own dashboard, no new `usuarios` row, no column of his row changed (compare a read before and after), and the code still works for the same address.
- [x] 5.3 (Run by hand by Brian on 2026-10-19, fine.) An address that asked for a code and never typed it, then signs in with Google: one auth user, a `usuarios` row created, signed in. Verify in `auth.users` / `auth.identities` and clean up.
- [x] 5.4 Cancel on Google's consent: back on `/login` with the Google message and no session.
- [x] 5.5 👤 Publish the consent screen (D6.3) after the deploy, and repeat 5.4 and a sign-in from production.
- [ ] 5.6 👤 Brand verification (free; optional, so the consent screen says "Mango" with its logo): verify `usemango.dev` in Search Console with a TXT in Vercel DNS, upload the 120×120 logo in Branding (from `app/apple-icon.png`), and after 5.5 submit in Verification Center. Verify on production that the consent screen shows the name and logo. The paid alternative (Supabase custom domain, Pro + 10 USD/month) was declined on 2026-10-18.
