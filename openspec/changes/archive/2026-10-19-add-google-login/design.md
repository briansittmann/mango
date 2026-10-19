## Context

- `/login` (`app/login/page.tsx`) renders `LoginSteps`: the e-mail step (`login-form.tsx`, `ElectricLogo`, field, "Enviar código" that folds into a spinner) and the code step (`CodeEntry`). The page mounts `ForceDarkTheme`: it is always dark, whatever the user's theme.
- The code request is a route handler, `POST /auth/request-code`, so the browser tests stub it with `page.route`; it passes `idioma` and `timezone` as `options.data` of `signInWithOtp`, which become `raw_user_meta_data`.
- `/auth/confirm` (`app/auth/confirm/route.ts`) already handles `?code=` with `exchangeCodeForSession` and redirects to `/dashboard`, or to `/login?error=enlace` on any failure (no code, exchange error).
- `supabaseServer()` uses `@supabase/ssr`, whose server client defaults to the PKCE flow and writes the code verifier as a cookie through `setAll`, which works in a route handler.
- `crear_usuario_desde_auth` (`0025`, not redefined since) runs on `after insert when email_confirmed_at is not null` — the path a new Google user takes — and on the first confirmation. It reads `idioma` and `timezone` from `raw_user_meta_data` and names the row after the address's local part. `onboarding_paso` defaults to 1 (`0029`); the onboarding's first step (`basics-step.tsx`) shows the stored name for the person to keep or change, and `updateBasics` writes name and timezone again, but not the language.
- `usuarios.idioma` is what the bot and the reminders speak; the web's own language is the `locale` cookie.

## Goals / Non-Goals

**Goals:**
- One-tap sign-in and registration with Google from the e-mail step, with the code staying as the alternative.
- A Google account starts with the same defaults a code account gets, plus Google's name.
- The button fits the dark login without breaking Google's branding rules.

**Non-Goals:**
- Other providers, One Tap, managing identities from the account sheet, avatars.
- A custom auth domain on the consent screen.

## Decisions

### D1. Start the flow in a route handler, not in the browser
`POST /auth/google` (body `{ idioma, timezone }`) calls `signInWithOAuth({ provider: 'google', options: { redirectTo: `${origin}/auth/confirm`, skipBrowserRedirect: true } })` on `supabaseServer()`, sets the cookies the client writes (the PKCE verifier) plus the sign-up cookie (D3), and answers `{ url }`; the button does `window.location.assign(url)`. The browser bundle keeps not shipping Supabase (a rule since `add-supabase-data-layer-and-login`), and the tests stub the handler with `page.route`, as they do the code request. `origin` comes from the request (`request.nextUrl.origin`), so preview deploys and `localhost` return to themselves; each must be in Supabase's redirect allow list (D6). Alternative: a GET that answers a 302 to Google, which a plain `<a>` could hit. Rejected: it cannot carry the timezone (only the browser knows it), and a GET that writes cookies is something link prefetchers would trigger.

### D2. Tell the Google return apart from a link
Supabase sends a failed or cancelled consent back to `redirectTo` with `?error=…&error_description=…` and no code. `/auth/confirm` maps that, and a `?code=` that fails to exchange while the sign-up cookie is present (the code came from our Google start), to `/login?error=google`; everything else keeps `?error=enlace`. `login-form.tsx` shows `acceso.errorGoogle` for `error=google`. A `?code=` without our cookie is still treated as a link, so the bot's link path is unchanged.

### D3. Language and timezone in a short-lived cookie, applied once
Google's metadata has no `idioma` or `timezone`, so the trigger would store `es` and `UTC`. The language matters most: the onboarding never asks it, and the bot and the reminders use it. The handler writes `mango-alta` (`{"idioma":"en","timezone":"Europe/Madrid"}`, httpOnly, `sameSite=lax` so it travels on the top-level return from Google, path `/auth`, max-age 600 s), validated as the code request validates its body. After a successful exchange, `/auth/confirm` reads it, deletes it, and updates `usuarios` set `idioma`, `timezone` where `auth_user_id = auth.uid()` and `onboarding_completo = false and onboarding_paso = 1`, with the session's client (RLS `usuarios_update_propio` allows it). The timezone is checked against `Intl.supportedValuesOf('timeZone')` and skipped if unknown. It also calls `updateUser({ data: { idioma } })` so a later code mail is in that language, matching what the language switch does. An account that started its onboarding keeps its own values: signing in again from an English page must not flip a Spanish account. Parsing and validation live in a pure module (`lib/auth/signup-prefs.ts`) with a unit test. Alternatives: pass them through `queryParams` (Google does not echo them into metadata); write them after the onboarding (the welcome step would already be in the wrong language for the bot's later messages; and nothing asks for the language there).

### D4. Google's name in the trigger
`0040_nombre_del_proveedor.sql` replaces `crear_usuario_desde_auth` with the same body except the name: `coalesce(nullif(btrim(meta ->> 'full_name'), ''), nullif(btrim(meta ->> 'name'), ''), split_part(email, '@', 1))`, cut to 60 characters as a guard against a pathological value. The triggers are not recreated. Supabase fills `full_name` and `name` from Google's profile; a code account has neither, so its behaviour does not change. The `security definer`, `search_path = ''`, never-raise structure stays as in `0025` (D3 of `open-web-signup`). The migration goes before the deploy, but it is independent of the code: a deploy without it only names a Google account after its address.

### D5. The button
Google's dark variant on the always-dark `/login`, with the card's own fill (`bg-card`, `#131814`) instead of Google's `#131314` so the button does not read as a block on the card (Brian's review, 2026-10-17; a near-identical dark is within the spirit of the dark theme, the mark is untouched), 1px `#8E918F` border, label `#E3E3E3` in the page's font, 20px "G" in its four colours (`#4285F4`, `#34A853`, `#FBBC05`, `#EA4335`) as an inline SVG atom (`components/atoms/google-g.tsx`, `aria-hidden`), `h-target`, the same `rounded-lg` as "Enviar código" (Google allows rectangular and pill shapes), the same press scale and spinner fold as "Enviar código". Border and label are Google's literal values, not tokens: they live in the component. Hover lays 5 % of the foreground over the fill. `mt-8` above it gives back the room that the logo's negative margin (`-my-8`) takes, which a small label hid but a full-height button does not, and the title's `mb-6` matches it above the logo. The first-time hint ("Si es tu primera vez, creamos tu cuenta…") stays under the field: it is true for both ways.

### D5b. Two ways, then the field (Brian's review, 2026-10-17)
The first screen offers only the two ways: Google, the "o" divider (hairlines in `--border`, the letter in `text-muted-foreground`), and "Continuar con email" (primary button, lucide `Mail`), so the e-mail field no longer competes with Google. `LoginForm` holds `mode` (`choose` | `email`); "Cambiar mail" from the code step opens on `email` (it passes `defaultEmail`). The onboarding's `GlassBackButton` sits top left: on `email` it returns to `choose` (focus on Google), on `choose` it goes to `/`. Pieces that belong to one mode carry `data-step`; a switch runs `EXIT` on them (opacity 0, `y` 10, scale 0.97, `blur(6px)`, 280 ms `power2.in`, 40 ms stagger), then the layout effect animates the form from its old height (450 ms `power3.out`, `overflow: hidden` only during it) while the new pieces replay the entrance without the title. Pressing Google runs `EXIT` on `[data-not-google]` (divider and the e-mail button) while the button folds and its slot (`[data-google-slot]`) glides down to the divider's middle (450 ms `power3.inOut`), so the spinner sits centred in the space the two ways leave (Brian's review, 2026-10-19); a failure or a bfcache return brings them back and the slot up. The effect compares the mode it last ran for, not a mounted flag, because React runs it twice on mount in development. Under reduced motion nothing animates and the swap is immediate. Recolouring the "G" to one colour was asked about and declined: Google's guidelines require the standard mark, and brand verification of the consent screen can flag it.

### D6. Panel configuration (👤 Brian)
1. Google Cloud: a project, the consent screen (external, app name "Mango", support mail, logo, home `https://www.usemango.dev`, privacy policy `https://www.usemango.dev/privacidad`, scopes `openid`, `email`, `profile` only, authorized domain `usemango.dev` and `supabase.co`), and an OAuth client of type Web with redirect URI `https://noemlszbjqzqbzagahyd.supabase.co/auth/v1/callback`.
2. Supabase Auth → Providers → Google: on, client id and secret. URL configuration: keep `https://www.usemango.dev/auth/confirm`, add `http://localhost:3000/auth/confirm` for local tries.
3. Publish the consent screen to production. With non-sensitive scopes there is no security review; brand verification (so the screen shows the name and logo) takes a few days and is optional for it to work. Until published, only the listed test users can sign in.
Google asks for the privacy policy's URL to publish: `/privacidad` exists; it SHALL mention that signing in with Google shares the name and address with Mango (task 4.3).

## Risks / Trade-offs

- **The consent screen names the Supabase host** ("to continue to noemlszbjqzqbzagahyd.supabase.co") until a custom auth domain exists (paid add-on). It looks less trustworthy than "usemango.dev". Accepted for now; written to the technical debt.
- **Automatic linking relies on Supabase's rule** that an identity with a verified e-mail joins the existing user with that address. Brian's account is confirmed, so Google joins it. An auth user that asked for a code and never typed it is unconfirmed; the expected outcome is that Google confirms that auth user, the confirmation trigger fires and the row is created as for a new account. Checked by hand (task 5.3).
- **A Google Workspace address whose admin blocks third-party apps** cannot finish the consent; it gets the Google error message and can use the code.
- **The cookie can be missing** (blocked cookies, more than 10 minutes on the consent screen): the account keeps `es`/`UTC`, as the trigger leaves it, and the onboarding asks the timezone anyway. The language then waits for the account menu's switch, which only moves the metadata (existing debt: *`usuarios.idioma` no sigue al selector*).

## Open Questions

None.
