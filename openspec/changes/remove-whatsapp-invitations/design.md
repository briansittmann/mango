## Context

See proposal.md — Why. What exists today:

- `lib/whatsapp/invite.ts` (`isInviteRequired`, seven unit cases) is read in two places: `lib/whatsapp/adapter.ts` passes it to `processUnknownNumber`, and `app/onboarding/page.tsx` passes it to `loadOnboardingData`, which puts it in `OnboardingData.inviteRequired`. `processUnknownNumber` (`lib/bot/logic.ts`) is a stub that returns `{ kind: 'none' }` and only `void`s the flag.
- The closing step: `OnboardingProfile.inviteCode`, `OnboardingData.inviteRequired`, `ProfileMutations.requestWhatsApp(phone, inviteCode)`, the `code` state and `canLink` in `onboarding-template.tsx`, the code `FieldRow` and two explanation strings in `whatsapp-step.tsx`, the `?e2eInvite=0` seam in `app/demo/onboarding/demo-onboarding.tsx`, and `tests/onboarding-close.spec.js`, which exercises the code field in three of its five tests.
- The database: `usuarios.codigo_invitacion` (`0029`, with a check and a comment; Brian's row holds null) and `invitaciones` (`0003`, RLS and two policies from `0011`), which no TypeScript has ever read. `usuarios.whatsapp_solicitado_en` stays: it is the request's timestamp and the linking of block 10 reads it.
- `openspec/specs/onboarding/` does not exist yet: the capability is a delta of the open change `add-web-onboarding` (35 tasks done, 11 verification tasks open).

## Goals / Non-Goals

**Goals:**
- No reference to invitations in code, texts, tests, database or live specs.
- The closing step keeps its behavior minus the code: same phone validation, same errors, same honest copy, same stub.
- The migration is a pure drop, reversible by re-running the relevant parts of `0003`, `0011` and `0029`.

**Non-Goals:**
- Replying to an unknown number (the one-line "register on the web" reply). It spends quota on every stranger's message and `ARCHITECTURE.md` §10 ties it to the rate limiting; both stay in block 10.
- Sending the linking message or creating the `canales` row from the web (block 10, pending Brian's decision on template vs. first message).
- The "WhatsApp" section in settings (block 9).
- Rewriting `0029`'s comments: they are history of what that migration did.

## Decisions

**D1. The `onboarding` delta targets the text in `add-web-onboarding`.** The main spec does not exist yet, so this change's `specs/onboarding/spec.md` copies the requirement as `add-web-onboarding` wrote it and rewrites it without the code. Order: `add-web-onboarding` is archived (or its specs synced) first, then this change applies and archives on top. The code of this change can be written before that archive — nothing in it depends on the spec file — but the archive of this change waits. Alternative rejected: editing `add-web-onboarding`'s delta in place, which would make an archived-later change describe behavior it never built.

**D2. One migration, `0030_sin_invitaciones.sql`, in this order:** `drop policy if exists` × 2 on `invitaciones`, `drop table if exists invitaciones`, `alter table usuarios drop column if exists codigo_invitacion`. The check constraint goes with the column. `if exists` everywhere so a re-run is a no-op. The comment on `whatsapp_solicitado_en` is rewritten in the same migration (it names `codigo_invitacion`). Rollback: re-create from `0003` + the two policies of `0011` + the `codigo_invitacion` block of `0029`; nothing to restore because the table is empty and the column null.

**D3. Deploy before migrate.** The current code selects `codigo_invitacion` in `USUARIO_COLUMNS`; dropping the column first would break `findCurrentUsuario` for every page until the deploy lands. So: merge and deploy the code (which no longer selects it), then apply `0030` through the MCP with Brian's confirmation, then remove `WHATSAPP_REQUIRE_INVITE` from Vercel. The reverse of the project's usual "migration before deploy" rule, and the reason it is written down here. Between deploy and migration the column simply sits unread.

**D4. `requestWhatsApp(phone)` keeps its shape otherwise.** The contract loses the second argument; the Supabase implementation writes `telefono` and `whatsapp_solicitado_en`; the demo keeps `phone` on the profile. `OnboardingProfile.inviteCode` and `OnboardingData.inviteRequired` are deleted rather than left optional: an optional field that nothing sets invites the next reader to wonder what sets it.

**D5. `processUnknownNumber` keeps `{ channel, externalId, text }` and stays a stub.** Its doc comment and TODOs are rewritten to the new model: reply once pointing to the web, after rate limiting (block 10). Removing the function entirely was considered and rejected: the adapter's unknown-number branch is the seam block 10 fills, and keeping it costs nothing.

**D6. Copy.** `whatsapp.explicacion` becomes the current `explicacionSinCodigo` text ("Es opcional: con el bot cargas gastos escribiendo un mensaje." / English equivalent); `explicacionSinCodigo` and `codigo` are deleted in both files. `guardado` is unchanged: it is still true.

**D7. Tests.** `tests/onboarding-close.spec.js`: the first test becomes "the closing step shows the phone and no code field"; the second drops the code lines; the third fills only the phone; the last two are unchanged. `lib/whatsapp/invite.test.mjs` is deleted with its module. No new spec: the behavior that remains is already covered.

## Risks / Trade-offs

- [The column is dropped while an old deployment still selects it] → D3: migration only after the deploy is live, verified by opening `/dashboard` in production first.
- [A future reader finds `0003` and `0011` creating a table that `0030` drops and wonders why] → `0030`'s header says the decision and the date; `ARCHITECTURE.md` §8 keeps the one-line history.
- [`add-web-onboarding` never archives and this change's `onboarding` delta has nothing to apply to] → the code is independent of the spec file; at worst this change waits to archive. Tracked in tasks 6.x.
- [Someone has `WHATSAPP_REQUIRE_INVITE` in `.env.local`] → harmless: nothing reads it. Task 5.3 removes it from Vercel for tidiness.

## Migration Plan

1. Code and tests (tasks 1–4), `npx tsc --noEmit`, `npm run lint`, `npm run test:unit`; Brian runs `tests/onboarding-close.spec.js`.
2. Brian deploys. Verify `/dashboard` and `/onboarding` (an alias) render in production.
3. Apply `0030` through the MCP with Brian's confirmation; verify `select codigo_invitacion from usuarios` fails and `invitaciones` is gone.
4. Brian removes `WHATSAPP_REQUIRE_INVITE` from Vercel (no redeploy needed, nothing reads it).
5. Docs, then archive after `add-web-onboarding`.
