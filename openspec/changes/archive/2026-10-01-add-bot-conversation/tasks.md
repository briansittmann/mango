> Claude runs every database step through the Supabase MCP, and asks Brian to confirm each write to the real database (production) first. 👤 marks Brian's tasks: the deploy and the WhatsApp round. Brian runs Playwright. Groups 1–5 need no deploy; group 6 needs `GEMINI_API_KEY`; group 7 needs the deploy.

## 1. Schema

- [x] 1.1 Write `supabase/migrations/0028_conversacion_bot.sql` (design D1, D8, Migration Plan):
  - `usuarios.vip boolean not null default false`;
  - `transacciones` `unique (id, usuario_id)`;
  - `canales.ultima_carga_id uuid` with FK `(ultima_carga_id, usuario_id) → transacciones (id, usuario_id) on delete set null`;
  - the `mensajes` table with index `(usuario_id, creado_en)`, partial unique `(usuario_id, canal, mensaje_id_externo) where direccion = 'entrante'`, composite FK on `transaccion_id`, and RLS on with no policies;
  - comments, and the `pregunta_pendiente` comment updated to the two kinds.

  Verify by static review against `0019`, `0020` and `0023`.
- [x] 1.2 Dry-run `0028` on the real database with `execute_sql` inside a `do` block ending in `raise`. Check that:
  - the columns and table exist;
  - setting Brian's channel `ultima_carga_id` to one of his rows works, and to a made-up id fails;
  - a duplicate incoming `mensajes` row is rejected by the partial unique;
  - `mensajes` is not readable as `authenticated`;
  - afterwards nothing persisted.

  Record the results here.

  Result (2026-10-01): `cols=2; own-row=ok; fake-id=rejected; outgoing-same-id=ok; dup-incoming=rejected; on-conflict-count=1; authenticated-sees=0; admin-sees=3`. Afterwards `mensajes`, both columns and both constraints were absent.
- [x] 1.3 With Brian's confirmation, apply `0028` with `apply_migration`. Verify with `list_migrations` and a read-only query that `vip` is false for Brian, `ultima_carga_id` is null on his channel and `mensajes` is empty.

  Applied 2026-10-01 (version `20260930233128`): `vip` false, `ultima_carga_id` null on his `whatsapp` channel, `mensajes` 0 rows.

## 2. Data layer

- [x] 2.1 `lib/data/channels.ts`:
  - `PendingQuestion` becomes the union of design D5 (read without `pregunta` → `categoria`);
  - `readChannelState(channel, externalId)` returns `{ pending, lastLoadId }` in one select;
  - add `setLastLoad(channel, externalId, id | null)`.

  Verify `npx tsc --noEmit` passes.
- [x] 2.2 `lib/data/supabase/user.ts`: `Usuario` gains `vip`, `cargas_confirmadas` and `modo_confirmacion` in `findUsuarioById`'s select. Verify `npx tsc --noEmit` passes and `/dashboard`'s `findCurrentUsuario` still compiles.
- [x] 2.3 Move `CATEGORY_COLORS` to `lib/data/categories.ts` and re-export it from `components/molecules/color-swatch-picker.tsx` (design D7). Verify `npx tsc --noEmit` and `npm run lint` pass and `dashboard-template.tsx` / `category-sheet.tsx` imports still resolve.
- [x] 2.4 `lib/data/supabase/bot.ts`: `similarCategory(name, categories)` returns `{ kind: 'same' | 'similar', category }` or null. Same is `normalizeName` equality; similar is containment either way or Levenshtein ≤ 2. Verify unit tests in `bot.test.mjs`: "mascotas" = Mascotas is `same`, "Mascota" is `similar` to Mascotas, "Viajes" matches nothing against Brian's 9 categories, "Ocio" / "Oficio" is `similar`.
- [x] 2.5 Create `lib/data/messages.ts` (admin client, design D8) with `recentMessages(userId)` (20 messages, 24 h, oldest first), `storeExchange({ userId, channel, externalId, incoming, outgoing, transactionId })` (incoming `on conflict do nothing`) and `purgeOldMessages()` returning the count, plus the constants `HISTORY_LIMIT`, `HISTORY_WINDOW_MS` and `RETENTION_DAYS`. Verify `npx tsc --noEmit` passes.
- [x] 2.6 Add `SITE_URL` to `lib/metadata.ts` and use it for `metadataBase` in `app/layout.tsx`. Verify `npx tsc --noEmit` passes and the rendered `<head>` URLs are unchanged: `npm run build` output, or a `curl` of `/` on the dev server grepped for `og:url`.

## 3. Parser

- [x] 3.1 `lib/bot/parser.ts` (design D9):
  - schema: `crear_categoria` with `presupuesto?` and `confirmada` (default false);
  - `ParseInput` gains `history?: { direction, text }[]`;
  - `buildPrompt` gains the history block, a pending block per kind, the loose-correction and bare-"sí" rules, and examples for `borrar`, `consultar` and a creation with a budget.

  Verify `npx tsc --noEmit` passes.
- [x] 3.2 Extend `lib/bot/parser.test.mjs`:
  - the history block appears only with `history` and in order;
  - the creation pending block names the category and the similar one;
  - `crear_categoria` without `confirmada` parses as false;
  - `presupuesto: 0` is rejected.

  Verify `npm run test:unit` passes offline.

## 4. Logic

- [x] 4.1 `lib/bot/logic.ts`, reply contract (design D5):
  - `loaded` replaces `recurring-discrepancy`;
  - `lastLoad` on every reply;
  - `IncomingMessage` gains `lastLoadId?` and `undoId?`;
  - `load` looks up the created row's id by `(usuario_id, canal, mensaje_id_externo)` and returns `loaded` with the icon;
  - a differing recurring amount appends `bot.soloEsteMes` and sets `alwaysText`;
  - a load answering a pending category question sets `alwaysText`;
  - confirmations take the D10 form (`Anotado <icon> <name> · <amount>`, ` en <categoría>` when the name differs, day only when not today);
  - after an expense in the cycle in progress, read `resumenMensual` and, when the category's group has a budget, append `bot.lineaPresupuesto` with the light from `getBudgetStatus(...).level`; a failed read sends the confirmation without it.

  Verify `npx tsc --noEmit` passes, and a unit test of the pure text builder covers: name vs category, "Ingreso" fallback, day omitted today, and 🟢 / 🟡 / 🔴 at 79 %, 80 % and 100 %.
- [x] 4.2 Delete, correct and undo (design D3, `bot-conversation`):
  - read the target row filtered by account and not deleted;
  - `borrar` / undo soft-delete through the contract, or reopen a recurring charge at `monto_actual` on `fechaEnCiclo`;
  - `corregir` updates the amount (withdrawal keeps its sign) or the category (expenses only; unknown name lists the categories);
  - replies `borrado`, `corregido`, `deshecho`, `yaDeshecho`, `nadaQueCorregir`, `soloGastosCategoria`;
  - `lastLoad` null after a delete or undo of the pointed row.

  Verify `npx tsc --noEmit` and `npm run lint` pass.
- [x] 4.3 Queries (design D7): `consultar` calls `resumenMensual(client, usuario)` and builds `bot.consultaMes` (total plus up to 5 lines, spent > 0, largest first, then one `bot.consultaResto` line with how many were left out and their sum) or `bot.consultaLibre`, both ending with `${SITE_URL}/dashboard`. Verify `npx tsc --noEmit` passes, and a unit test of the pure line-builder covers ordering, the cap of 5, skipping 0 and the rest's count and sum.
- [x] 4.4 Category creation (design D7):
  - same name → `bot.categoriaExiste`;
  - similar name without a matching pending confirmation → `ask` with the `crear_categoria` question and `bot.categoriaParecida`;
  - otherwise `crear_categoria` for the cycle in progress with the first unused color and `presupuesto` → `bot.categoriaCreada` / `bot.categoriaCreadaConPresupuesto`;
  - `duplicate-category-name` from the database → `categoriaExiste`.

  Verify `npx tsc --noEmit` passes.
- [x] 4.5 VIP history (design D8): when `usuario.vip`, load `recentMessages` before parsing and pass it as `history`; after the reply is decided, `storeExchange` with the reply text and the loaded row. Button presses are stored as `↩︎ Deshacer`. Non-VIP accounts touch nothing. Verify `npx tsc --noEmit` passes.
- [x] 4.6 `messages/es.json` and `en.json` (`bot`):
  - add `deshacer` (≤ 20 characters), `soloEsteMes`, `borrado`, `corregido`, `deshecho`, `yaDeshecho`, `nadaQueCorregir`, `soloGastosCategoria`, `categoriaNoExiste`, `consultaMes`, `consultaLinea`, `consultaLibre`, `categoriaCreada`, `categoriaCreadaConPresupuesto`, `categoriaExiste`, `categoriaParecida`, each starting with an icon;
  - rewrite `confirmacionGasto`, `confirmacionIngreso`, `confirmacionAhorro` and `confirmacionRetiro` in the D10 form (these start with "Anotado", not the icon), and add `lineaPresupuesto`;
  - move every Spanish `bot` text to voseo (`Respondeme`, `cargalo`, `Podés`, `Volvé`, `Llevás`);
  - remove `todaviaNo`.

  Verify both catalogs parse and hold the same `bot` keys (`node -e` comparing `Object.keys`).

## 5. WhatsApp adapter and cron

- [x] 5.1 `lib/whatsapp/payload.ts`: extract `interactive.button_reply.id` as `buttonId` with empty `text`. Other interactive types are ignored. Verify a unit test (`lib/whatsapp/payload.test.mjs`) covers a text message, a button reply and an unrelated interactive type.
- [x] 5.2 `lib/whatsapp/send.ts`: `sendUndoButton(phone, text, buttonId, label)` sends an interactive `button` message; `sendReaction(phone, messageId, emoji)` sends `type: 'reaction'`. Both log with the number masked and never throw. Verify `npx tsc --noEmit` passes, and that a call without `WHATSAPP_TOKEN` logs and does not throw.
- [x] 5.3 `lib/whatsapp/adapter.ts` (design D1, D2, D6):
  - read `readChannelState` after the retry check;
  - parse `undo:<id>` from `buttonId`;
  - pass `pending`, `lastLoadId` and `undoId`;
  - write or clear the pending question as today;
  - apply `lastLoad`;
  - on `loaded`, choose text + Undo or reaction with `TEXT_CONFIRMATIONS = 15` and `modo_confirmacion`, then raise `cargas_confirmadas`;
  - delete `PendingRecurringDecision` and the discrepancy log.

  Verify `npx tsc --noEmit`, `npm run lint` (no warnings left from the old type) and `npm run build` pass.
- [x] 5.4 `app/api/cron/recurrentes/route.ts`: after the user loop, `purgeOldMessages()` in its own `try`, with `purged` or `purgeError` added to the response and log. Verify `npx tsc --noEmit` passes.

## 6. Parser evaluation (needs `GEMINI_API_KEY`)

- [x] 6.1 Add the conversation cases to `lib/bot/parser-cases.json`: "no, era 40", "osea lo que gaste esos 50 eran comida", "borrá eso", "¿cómo vengo?", "libre", "nueva categoría Viajes, presupuesto 200", "crea categoria Musica", "sí" with a pending creation question → `confirmada` true, and "sí" with nothing pending → `no_entendido`. Add optional `pending` support to `parser.eval.mjs`. Verify `npm run test:parser` runs end to end.
- [x] 6.2 Iterate on the prompt until `npm run test:parser` passes every case twice in a row (the cases are the truth; only the prompt changes). Record the final run here.

  Result (2026-10-01): 22/22 twice in a row (19 recorded cases plus 3 extra), with no prompt iteration needed after 3.1.

## 7. Production (after `0028` and the deploy)

- [x] 7.1 👤 Deploy. Then, with Brian's confirmation, mark him VIP through the MCP: `update usuarios set vip = true where email = 'brianrebadj@gmail.com'`. Verify with a read-only query.

  Done 2026-10-01 after Brian's deploy: `vip` true, `cargas_confirmadas` 0, `modo_confirmacion` `auto`.
- [x] 7.2 👤 Round by WhatsApp. Check each of these and record anything that fails here:
  - "café 3" arrives as text with Undo, and Undo deletes it;
  - "súper 15" names Súper and Comida and shows "Llevás X de 300 € este mes" with the same figures and color as the dashboard bar;
  - "nafta 45" then "no, era 40" then "borrá eso";
  - "gasté 50" then "comida" then "osea eran ocio";
  - "¿cómo vengo?" and "libre" match the dashboard;
  - "creá la categoría Mascota" (ask) then "sí", and it shows on the web;
  - a fixed charge with another amount says "solo este mes";
  - after the round, `mensajes` holds the exchange and `cargas_confirmadas` rose.

  Findings (2026-10-01):
  - "¿cómo vengo?" listed 2.878 € and five categories adding up to 2.556 €: the other 322 € were the categories past the top 5. Fixed in code with a `consultaResto` line ("3 categorías más: 322 €"); spec, design and 4.3 updated. Needs a redeploy.
  - Passed: café with Undo; súper with the budget line (91,02 € de 300 € 🟢); "como vengo" and "y el margen libre"; nafta 45 → "no, era 40" → "borra eso"; "gaste 50 en comida" → "ósea era ocio" → "bórralo". `mensajes` holds 14 incoming and 14 outgoing; `cargas_confirmadas` went 0 → 4.
  - "crea categoría mascota" created Mascota without asking: correct, since the account had no similar category (the checklist assumed a Mascotas). The "sí" that followed was `no_entendido`, as specified. The similar-name question was not exercised.
  - "Prime 9€" (definition 7 €, due day 2) → "Anotado ✅ Prime · 9 € en Suscripciones.\n📌 Solo cambia este mes: Prime sigue en 7 €.", sent as text. The definition stayed at 7. At Brian's request the test was undone through the MCP: the charge is back to pending at 7 € on 2/10, without `canal` / `mensaje_id_externo`, and the channel's last load cleared.
  - "Elimina categoría mascota" → `noEntendi`: deleting a category by chat is out of scope.
  - "Gaste 50" → category question → "Comida" → "Anotado ✅ Comida · 50 €. Llevás 126,02 € de 300 € este mes 🟢"; the pending question was cleared, the channel's last load is that row and `cargas_confirmadas` reached 6. The category list included Valencia, which ends in the cycle in progress: correct.
  - "Que me recomendas hacer con mi dinero ?" → `noEntendi`: advisor mode is block 13.
  - The exchange is written up in `docs/bot-conversacion-ejemplo.md` for the website.
- [x] 7.3 Through the MCP and with Brian's confirmation, clean up the test rows of 7.2 (the category and any leftover expenses). Verify with a read-only query.

  Done 2026-10-01: "Super 15" soft-deleted; Mascota (no rows, definitions or budgets) deleted. Café, Nafta and Comida 50 were already deleted from the chat. Read back: no Mascota; the only active chat load since 30/9 is "Supermercado 20,38", which is not from this round and was left alone.

## 8. Documentation

- [x] 8.1 Update:
  - `ROADMAP.md`: tick the block 5 items and close Fase 1;
  - `ARCHITECTURE.md` §3 (discrepancy decision, Undo by row, last load per channel) and §8 (`canales.ultima_carga_id`, `mensajes.mensaje_id_externo`);
  - `CLAUDE.md` *Estado actual*;
  - *Deuda tecnica*, with the risks of design.md that stay open.

  Verify by reading the diffs.
