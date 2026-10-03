> Order per design.md D3: code → deploy → migration `0030` → Vercel variable → docs → archive after `add-web-onboarding`. Brian runs Playwright and deploys; migrations go through the MCP with his confirmation.

## 1. Web and data layer

- [x] 1.1 `lib/data/onboarding.ts`: delete `OnboardingProfile.inviteCode` and `OnboardingData.inviteRequired`, fix the doc comment; `lib/data/profile.ts`: `requestWhatsApp(phone: string)` and its comment — verify `npx tsc --noEmit` lists every caller that still passes two arguments (the files of 1.2–1.5)
- [x] 1.2 `lib/data/supabase/profile.ts`: `requestWhatsApp(phone)` writes `telefono` and `whatsapp_solicitado_en` only; `lib/data/supabase/user.ts`: `codigo_invitacion` out of `Usuario` and `USUARIO_COLUMNS`; `lib/data/supabase/onboarding.ts`: `loadOnboardingData(client, usuario)` without `inviteRequired`/`inviteCode` — verify `npx tsc --noEmit` on these three files is clean
- [x] 1.3 `app/onboarding/page.tsx` (drop the `isInviteRequired` import and argument), `app/onboarding/actions.ts` (`requestWhatsApp(phone)`, no code normalisation), `app/onboarding/supabase-onboarding.tsx` (binding) — verify `npx tsc --noEmit`
- [x] 1.4 `components/organisms/onboarding/whatsapp-step.tsx`: delete `code`, `onCodeChange`, `inviteRequired`, the code `FieldRow`, `enterKeyHint` becomes `'done'`, explanation reads `whatsapp.explicacion`; `components/templates/onboarding-template.tsx`: delete the `code` state, `canLink = phoneValid`, `requestWhatsApp(phone)`, the step's props — verify `npx tsc --noEmit` and `npm run lint`
- [x] 1.5 `lib/demo/demo-onboarding.ts` (`inviteCode` off the profile, `deriveDemoOnboardingData(state)`, `requestWhatsApp(phone)`) and `app/demo/onboarding/demo-onboarding.tsx` (delete the `?e2eInvite` seam and its mention in the comment) — verify `npx tsc --noEmit`
- [x] 1.6 `messages/es.json` and `messages/en.json`: `whatsapp.explicacion` takes the text of `explicacionSinCodigo`; delete `explicacionSinCodigo` and `codigo` — verify `grep -n "invitaci\|invitation\|codigo\"" messages/*.json` returns only the auth code strings (`login`, `codigo.html` references), nothing under `onboarding.whatsapp`

## 2. Bot

- [x] 2.1 Delete `lib/whatsapp/invite.ts` and `lib/whatsapp/invite.test.mjs`; `lib/whatsapp/adapter.ts`: drop the import and the `inviteRequired` argument — verify `npm run test:unit` passes with seven fewer cases and `npx tsc --noEmit` is clean (2026-10-03: 99/99 pass, the deleted file held 7 cases; `tsc` and `npm run lint` clean)
- [x] 2.2 `lib/bot/logic.ts`: `processUnknownNumber({ channel, externalId, text })` with the doc comment and TODOs rewritten per design.md D5 (reply once pointing to the web, after rate limiting; no code, no chat onboarding); `lib/data/users.ts` and `lib/whatsapp/link-request.ts`: comments without `invitaciones`/`codigo_invitacion` — verify `grep -rn "invit" lib app components` returns nothing

## 3. Tests

- [x] 3.1 `tests/onboarding-close.spec.js` per design.md D7: first test "the closing step shows the phone and no code field" (asserts `Código de invitación` has count 0 and the explanation line is the single text), second and third tests without the code lines — verify the file has no `e2eInvite` and no `Código de invitación` except the count-0 assertion
- [x] 3.2 Brian runs `npx playwright test tests/onboarding-close.spec.js --project=chromium` — verify 5/5 pass; 🤖 records the result here (2026-10-03, run by 🤖 at Brian's request: 5 passed in 6.3 s)

## 4. Migration

- [x] 4.1 `supabase/migrations/0030_sin_invitaciones.sql` per design.md D2: header with the decision and the date, `drop policy if exists "invitaciones_select_propias"`, `drop policy if exists "invitaciones_insert_propias"`, `drop table if exists invitaciones`, `alter table usuarios drop column if exists codigo_invitacion`, new `comment on column usuarios.whatsapp_solicitado_en` without the code — verify the file reads as a no-op on a second run (every statement `if exists`)
- [x] 4.2 Before applying, through the MCP (read-only): `select count(*) from invitaciones` (expected 0) and `select id, codigo_invitacion from usuarios` (expected one row, null) — paste the result here
  - 2026-10-03: `invitaciones` → 0 rows. `usuarios` has **two** rows (not one): `96d97872-…` (`codigo_invitacion` null, no `telefono`, `whatsapp_solicitado_en` null) and `b41090cc-…` (`codigo_invitacion` null, has `telefono`, `whatsapp_solicitado_en` null). The column is null on both, so the drop loses nothing.

## 5. Deploy and apply (D3 order)

- [ ] 5.1 Brian deploys the code of sections 1–3 — verify `/dashboard` renders in production with the real account and `/onboarding` renders the closing step with phone only for a `+` alias (or the demo at `/demo/onboarding?paso=7`)
- [ ] 5.2 Apply `0030` through the MCP (`apply_migration`) with Brian's confirmation in chat — verify `select codigo_invitacion from usuarios` errors with "column does not exist", `select * from invitaciones` errors with "relation does not exist", and Brian's row is otherwise identical to 4.2's read; paste the checks here
- [ ] 5.3 Brian removes `WHATSAPP_REQUIRE_INVITE` from Vercel (Production) — verify it is absent from the project's environment variables; no redeploy needed

## 6. Docs and archive

- [ ] 6.1 `CLAUDE.md`: the `separate-identity-from-channel` paragraph loses the switch sentence (say it was removed by this change), the `processUnknownNumber` line loses the TODO remark, the migrations count becomes 30 with `0030` described, the Deploy section lists `0030` as applied with its date, the OpenSpec section lists this change — verify `grep -n "REQUIRE_INVITE\|codigo_invitacion" CLAUDE.md` returns only the history sentence
- [x] 6.2 `ARCHITECTURE.md` §8: the `codigo_invitacion` line becomes one sentence of history naming `0030`; `ROADMAP.md` block 10: tick the "Quitar la invitación del código" task with this change's name — verify both greps show the new text
- [ ] 6.3 Archive after `add-web-onboarding` is archived (design.md D1): `openspec archive remove-whatsapp-invitations` syncs `messaging-channels`, `web-access` and `onboarding` — verify `openspec/specs/messaging-channels/spec.md` has no *invitation is a switch* requirement and `openspec/specs/onboarding/spec.md` has the phone-only closing step
