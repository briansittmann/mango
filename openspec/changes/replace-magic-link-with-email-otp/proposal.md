## Why

Signing in by e-mail today means a magic link (`web-access` → *Magic-link sign-in*, *The magic link opens a session*). The link opens a new tab, and with Supabase's default template it carries `?code=`, which only opens a session in the browser that requested it (D5 amendment of `add-supabase-data-layer-and-login`): a link opened from the Mail app on the phone, or in another browser, lands on "enlace inválido". A 6-digit one-time code typed on the same page keeps the person on the tab they started from and puts the session exactly there. Google stays the primary option for block 8 of `ROADMAP.md`; the code replaces the magic link as the alternative, so the branded-template item of that block becomes "template of the code", and the `?token_hash=` workaround of the technical debt is no longer needed.

## What Changes

- **BREAKING** (for the e-mail path): `/login` stops sending a magic link. It becomes two steps on one page: the e-mail step requests a 6-digit code (same provider call as today, no account creation for an unknown address, same "if the address has an account" answer), then the code step shows the address, six cells and a resend action with a countdown; "Cambiar mail" returns to the e-mail step. The code step is addressable by URL (`/login?email=`), so a reload keeps it and tests can open it without a database.
- The code is verified from the page by a server action; a valid code opens the session in the same browser and shows "Listo, entraste" with "Ir a mi mes", which leads to `/dashboard`. A rejected code (wrong, expired, already used), too many attempts and a failed request each map to a message in es/en.
- A new code-entry component in `components/`, reproducing the interaction and motion of the prototype [docs/prototipos/login-otp.html](../../../docs/prototipos/login-otp.html): one real invisible numeric input (`inputmode="numeric"`, `autocomplete="one-time-code"`, `maxlength="6"`) with six visual cells; a pop and a neon light around the cell's frame on every digit; automatic submit on the sixth; cells opening into a hexagon on a dotted ring and spinning 420° while the code is verified; on success, implosion, the check square, the two frames that expand, retract and hit it, the squash-and-bounce to 1.65×, ghosts, a particle burst and a dozen floating remains for 3–4 s; on error, a shake, the cells back in a row and emptied. With `prefers-reduced-motion`, no orbit, no frame light, no particles: a direct fade to the result. Colours only from `design-system` tokens, in both themes.
- `design-system` gains named tokens for the active field (fill, halo, caret colour) that the amount field of the entry sheet already draws inline; the code cells and the amount field compute the same values.
- "Reenviar código" respects Supabase's 60 s minimum between two codes for the same address with a visible countdown, instead of being tappable and failing.
- Supabase's send rate limit — the per-address interval or the hourly cap of the custom SMTP — maps to its own message in es/en ("too many codes, wait"), on the e-mail step and on resend, never to the generic "couldn't send" error.
- `/auth/confirm` is untouched: it stays for the Google callback (block 8) and for the one-time link the WhatsApp bot will send at the end of its onboarding. The "enlace inválido" message stays with it.
- Rate limiting on verification: what Supabase already enforces and what is missing is written down (design, `ARCHITECTURE.md` §10 and §11); no app-level limiter is built in this change.
- Tests: `tests/login-code.spec.js` on the code step without a database (typing, paste, error, reduced motion, "Cambiar mail", token parity with the amount field); `tests/login-access.spec.js` updated to the new copy.
- Documentation: `ARCHITECTURE.md` (§2 table and Auth note, §4 web onboarding and "Acceso a la web", §10, §11), `ROADMAP.md` block 8, and the technical-debt item of `CLAUDE.md` about the unbranded mail.

### Prerequisites (👤 Brian, Supabase panel)

- **Custom SMTP, done (2026-09-28).** It was taken into this change as the prerequisite of the template edit: Resend with the `usemango.dev` domain, sender `no-reply@usemango.dev`. With it, Auth sends at most 30 mails per hour and 60 s apart for the same address.
- The *Magic Link* e-mail template must show `{{ .Token }}`: Supabase's default template only carries `{{ .ConfirmationURL }}`, so without this edit the mail brings a link and no code. Done (task 0.1): Spanish only, the code as a standalone number, no link; the branded template and a per-user language stay out of scope.
- *Email OTP Expiration*: lower it (recommended 600 s; the person is on the tab, and a shorter window is the cheapest brute-force mitigation). Default is 3600 s.
- The minimum interval between two codes for the same address is 60 s, and the resend countdown matches it.

### Open decisions

- **Error colour — decided (design D10).** Red text (`destructive-ink`) on the message, as every field error of the sheets; no red on the cells, which only shake and empty.
- **Resend countdown — decided: 60 s.** The prototype counts 30 s, but with custom SMTP the per-address interval is 60 s, so "Reenviar" at 30 s would fail with "demasiados pedidos". The countdown follows the panel.
- **"Ir a mi mes" pulse.** It pulses once and then every 6 s until touched, off with reduced motion. `design-system` forbids endless animation on the dashboard; `/login` is not the dashboard and the pulse stops on the first touch, so it is kept as specified. Flagged in case the rule is meant to cover every screen.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `web-access`: *Magic-link sign-in* and *The magic link opens a session* are replaced by sign-in by e-mail code (two steps on `/login`, the code step, verification outcomes, resend, motion and reduced motion); the confirm route stays as a token endpoint that no sign-in e-mail points to any more.
- `design-system`: named tokens for the active field (fill, halo, caret), shared by the amount field and the code cells, correct in both themes.

## Impact

- `app/login/actions.ts`: `sendMagicLink` becomes the request-code action (no `emailRedirectTo`); a new verify-code action calls the provider with the address and the token and maps its errors. `app/login/page.tsx` and `app/login/login-form.tsx`: two steps, address from the query string.
- New `components/organisms/code-entry.tsx` (name indicative) with the cells, the invisible input and the `gsap` timelines; `app/globals.css`: the new tokens, `field-focus` rewritten on top of them.
- `messages/es.json` and `messages/en.json`: `acceso` namespace (request, code step, errors, resend, success). `enlaceInvalido` stays for `/auth/confirm`.
- `tests/login-code.spec.js` (new) and `tests/login-access.spec.js` (copy).
- `docs/prototipos/login-otp.html`: the prototype, kept as the interaction reference.
- `ARCHITECTURE.md`, `ROADMAP.md`, `CLAUDE.md` (technical debt only; "Estado actual" at archive time).
- Supabase panel (Brian): template with `{{ .Token }}`, OTP expiration, resend interval. No migration, no database change, no new dependency (`gsap` and `next-intl` are already installed).
- Out of scope: Google login, the branded template (block 8; custom SMTP was brought forward as a prerequisite), the web onboarding, an app-level attempt limiter, the WhatsApp one-time link.
