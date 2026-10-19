## Why

The code by mail is the only way into Mango (`open-web-signup` moved Google to block 13 of `ROADMAP.md`). Typing an address, switching to the mail app and copying six digits is the slowest part of a first visit, and the code depends on the shared mail caps (30 per hour through Resend for the whole project). Google brings the address already verified, in one tap, and spends no mail. Most of the plumbing was left ready for it: `/auth/confirm` already exchanges `?code=`, and the `usuarios` trigger of `0025` already covers an auth user created confirmed ("OAuth del bloque 13").

## What Changes

- **Two ways in on `/login`: "Continuar con Google", an "o" divider and "Continuar con email"**, which opens the e-mail step as it was; a "Volver" control goes back one level (field → two ways → Home), and the pieces swap with an exit and a resize. It follows Google's official dark button (border `#8E918F`, text `#E3E3E3`, the "G" in its four standard colours) on the card's own fill: `/login` is always dark (`ForceDarkTheme`), so the button never shows as a white block. The "G" is not recoloured, because Google's branding rules forbid it.
- **The flow runs on the server.** A new route handler, `POST /auth/google`, starts `signInWithOAuth` with the PKCE verifier in a cookie and answers the provider's URL; the browser goes there. Google returns through Supabase to `/auth/confirm?code=`, which already opens the session and leads to `/dashboard` (and from there to the onboarding for a new account).
- **Language and timezone survive the round trip.** Google sends neither. The handler stores the page's language and the browser's timezone in a short-lived cookie, and `/auth/confirm` applies them to the `usuarios` row when the sign-in created it (onboarding not started), as the code request does through the auth metadata.
- **The new account takes the name Google knows.** `crear_usuario_desde_auth` (new migration `0040`) uses the `full_name` (or `name`) of the auth metadata when there is one, else the part of the address before `@` as today. The onboarding's first step already shows that name for the person to keep or change.
- **One account per address.** An existing account that signs in with Google with the same address lands on its own data: Supabase links the Google identity to the existing auth user because Google's address is verified. No row is created or changed.
- **A failed or cancelled Google sign-in returns to `/login`** with its own message ("No se pudo entrar con Google"), not the "invalid link" one.
- **Panel steps (👤 Brian):** OAuth client (Web) and consent screen in Google Cloud, with the Supabase callback as redirect URI; Google provider on in Supabase Auth with that client; the consent screen published (out of "Testing"). The migration goes before the deploy.
- Tests: `tests/login-google.spec.js` with the handler stubbed (button present, colours in the dark variant, the request carries language and timezone, the error message) and unit tests for the cookie parsing. The round trip with Google, the linking with Brian's account and the trigger are checked by hand against the real project.
- Documentation: `ARCHITECTURE.md` §2 (Auth row), §4 and §8; `ROADMAP.md` block 13 (the two Google items); `CLAUDE.md`.

### Not in this change

Apple or other providers, linking or unlinking Google from the account sheet, Google's One Tap, a custom domain for the Supabase auth host (the consent screen will say "noemlszbjqzqbzagahyd.supabase.co" until that paid add-on exists), Google's avatar.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `web-access`: new requirement *Sign-in with Google* (button, flow, error, one account per address); *A token in the confirm route opens a session* gains the Google return with language and timezone; *Account created on first confirmed sign-in* takes the name from the provider when there is one.

*Account created on first confirmed sign-in* is written as `add-web-onboarding` leaves it: archive that change first.

## Impact

- Code: `app/login/login-form.tsx` (button and divider), new `app/auth/google/route.ts`, `app/auth/confirm/route.ts` (error param, cookie), a small module for the cookie, new `components/atoms/google-g.tsx` (the four-colour mark), texts in `acceso` (`messages/es.json`, `en.json`), one section of `/privacidad` (what Google shares).
- Database: `supabase/migrations/0040_nombre_del_proveedor.sql` (replaces `crear_usuario_desde_auth`; triggers unchanged).
- External: Google Cloud project and OAuth client, Supabase Auth provider settings. No new dependency.
