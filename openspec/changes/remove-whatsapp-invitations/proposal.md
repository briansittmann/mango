## Why

On 2026-10-03 the invitation was dropped as a concept: the account is created only on the web and WhatsApp is a channel the person links from their account (`ARCHITECTURE.md` §4, `ROADMAP.md` header and block 10). The code, the database and three specs still carry the previous model — the `WHATSAPP_REQUIRE_INVITE` switch, an invitation code field on the onboarding's closing step, `usuarios.codigo_invitacion` and the never-read `invitaciones` table — and every day they stay, the closing step keeps asking new accounts for a code that no one can give them.

## What Changes

- **The closing step of the onboarding asks only for the phone.** No invitation code field, no "today it works by invitation" line, no switch that shows or hides them. "Vincular" needs a valid phone and nothing else. The stored request keeps the phone and the time, as today.
- **The invitation switch is gone.** `lib/whatsapp/invite.ts`, its test and the `WHATSAPP_REQUIRE_INVITE` variable are removed from the adapter, from `/onboarding` and from Vercel. An unknown WhatsApp number is still handed to the bot logic with the channel, the identifier and the text, and the logic still replies nothing (the one-line reply that sends people to the web is a separate block-10 task, because it spends quota and needs the rate limiting).
- **Database cleanup, `0030_sin_invitaciones.sql`**: drops `usuarios.codigo_invitacion` and the `invitaciones` table with its policies. **BREAKING** for nothing that runs: no TypeScript reads `invitaciones`, and the column is read only by the code this change removes. Applied to the real project through the MCP with Brian's confirmation, after the code that reads the column is deployed.
- **Comments and copy** that still describe the chat onboarding, the invitation code or the switch (`lib/bot/logic.ts`, `lib/data/users.ts`, `lib/whatsapp/link-request.ts`, the `0029` comments stay as history) are rewritten to the new model; the two `whatsapp.*` texts about invitations go, in both languages.
- **Specs catch up**: `messaging-channels` loses the switch requirement and stops passing it to the logic; `web-access` stops saying the footer mentions an invitation (the landing already does not); `onboarding` describes the closing step without a code.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `messaging-channels`: *The bot logic does not know the channel's mechanics* no longer passes "whether an invitation is required" for an unknown sender; *The WhatsApp invitation is a switch* is removed; *Nothing depends on the test number's limits* no longer names the switch as part of moving to an owned number.
- `web-access`: *Home is the landing page* — the footer says what Mango is; it does not say the bot is by invitation (it already does not).
- `onboarding`: *Closing step stores a WhatsApp request and sends nothing* — phone only, no code, no switch. This capability lives today in the open change `add-web-onboarding` (`openspec/changes/add-web-onboarding/specs/onboarding/spec.md`), not yet in `openspec/specs/`: this delta is written against that text and applies once that change is archived (or its specs synced). See design.md D1.

## Impact

- **Web**: `components/organisms/onboarding/whatsapp-step.tsx`, `components/templates/onboarding-template.tsx`, `app/onboarding/page.tsx`, `app/onboarding/actions.ts`, `app/onboarding/supabase-onboarding.tsx`, `app/demo/onboarding/demo-onboarding.tsx` (the `?e2eInvite` seam goes), `messages/es.json`, `messages/en.json`.
- **Data layer**: `lib/data/onboarding.ts` (`inviteCode`, `inviteRequired`), `lib/data/profile.ts` (`requestWhatsApp(phone)`), `lib/data/supabase/profile.ts`, `lib/data/supabase/onboarding.ts`, `lib/data/supabase/user.ts` (`codigo_invitacion` out of `Usuario` and `USUARIO_COLUMNS`), `lib/demo/demo-onboarding.ts`.
- **Bot**: `lib/whatsapp/adapter.ts`, `lib/bot/logic.ts` (`processUnknownNumber` without `inviteRequired`), `lib/whatsapp/invite.ts` and `lib/whatsapp/invite.test.mjs` deleted, `lib/whatsapp/link-request.ts` and `lib/data/users.ts` comments.
- **Database**: new migration `0030_sin_invitaciones.sql`, applied to the real project (Brian's row loses one null column; nothing else changes).
- **Environment**: `WHATSAPP_REQUIRE_INVITE` removed from Vercel after the deploy (👤).
- **Tests**: `tests/onboarding-close.spec.js` rewritten without the code; `npm run test:unit` loses the switch's seven cases.
- **Docs**: `CLAUDE.md` state (the switch paragraph, the stub line, the migration list), `ROADMAP.md` block 10 first task ticked. `ARCHITECTURE.md` §4 and §8 already describe the target; the `codigo_invitacion` line in §8 and the `0030` get the migration's number.
