> Every write to the real database (production since 2026-09-27) is confirmed by Brian first. 👤 marks Brian's tasks. Groups 1–3 need no key and no database; group 4 needs `GEMINI_API_KEY`; groups 6–7 need the deploy.

## 1. Dependencies and schema

- [x] 1.1 `npm install zod @google/genai`; add `"test:parser": "node --env-file=.env.local lib/bot/parser.eval.mjs"` to `package.json` — verify both packages are in `dependencies`, `npm run test:unit` still passes and `npm run build` passes
- [x] 1.2 Create `lib/bot/parser.ts` (design D1–D3): `ActionSchema` as a Zod discriminated union over the seven actions with the refinements of `bot-message-parsing` → *A message becomes exactly one action from a fixed set*; `buildPrompt(input)` with today, language, categories, recurring names, conventions, examples in the account's language and the pending-question block; `parseMessage(input, model)` calling `model` at most twice, feeding the Zod issues back on the retry and returning `{ accion: 'no_entendido' }` after two failures or a thrown model error. Relative imports only, no `server-only` — verify `npx tsc --noEmit` passes and a throwaway Node one-liner imports the module without Next
- [x] 1.3 Create `lib/bot/parser.test.mjs` with a fake `model`: valid JSON on the first call → parsed once; broken JSON then valid → two calls and the valid action; two invalid → `no_entendido` and exactly two calls; a thrown model error → `no_entendido`; `monto` as a string rejected; `ahorro` with `monto` 0 rejected; the prompt contains every category name and the pending block only when `pending` is set — verify `npm run test:unit` passes offline
- [x] 1.4 Create `lib/bot/gemini.ts` (design D1): `createGeminiModel()` reads `GEMINI_API_KEY` inside the function and returns `(prompt) => Promise<string>` using `models.generateContent` with `responseMimeType: 'application/json'`, temperature 0 and the model id constant — verify `npx tsc --noEmit` passes and the key is never read at module scope

## 2. Data layer

- [x] 2.1 Add `origin?: { channel: Channel; externalMessageId: string }` to `DataContext` and spread `canal` / `mensaje_id_externo` into the inserts of `expenses.ts`, `income.ts` and `savings.ts` when set (design D4) — verify `npx tsc --noEmit` passes and `app/dashboard/actions.ts` needs no change
- [x] 2.2 Add `idioma: 'es' | 'en'` to `Usuario` and to `findCurrentUsuario`'s select; add `findUsuarioById(client, id)` in `lib/data/supabase/user.ts` (design D9) — verify `npx tsc --noEmit` passes
- [x] 2.3 Create `lib/data/supabase/bot.ts` with `loadBotContext(client, usuarioId)` returning categories and active `gasto` definitions, and `normalizeName` (lowercase, accents stripped) (design D9) — verify a unit test in `lib/data/supabase/bot.test.mjs` covers `normalizeName` ("Súper" = "super", "SALUD" = "salud") under `npm run test:unit`
- [x] 2.4 Create `lib/data/channels.ts` (admin client) with `readPendingQuestion`, `writePendingQuestion(…, ttlMs)` and `clearPendingQuestion`, keyed by channel type and external id, `PENDING_QUESTION_TTL_MS = 30 * 60_000`, and an expired question read as null (design D7) — verify `npx tsc --noEmit` passes
- [x] 2.5 Write `supabase/migrations/0023_pregunta_pendiente_y_origen.sql` (design D5): `canales.pregunta_pendiente jsonb` and `pregunta_vence_en timestamptz`, nullable, with comments; `completar_cargo_recurrente` recreated with `p_canal text default null` and `p_mensaje_id_externo text default null` written in both the update and the insert path, `execute` revoked from `public`, `anon`, `authenticated`, old signature dropped — verify by static review against 0020/0021 and the unique `(usuario_id, canal, mensaje_id_externo)`
- [x] 2.6 Dry-run 0023 on the real database through `execute_sql` inside a `do` block ending in `raise`: columns exist; completing a pending October charge with `p_canal = 'whatsapp'` and an id writes both columns and confirms the row; a second call raises `already-confirmed`; a call on a finished plan raises `plan-completed`; `execute` is false for anon and authenticated; afterwards nothing persisted — record the results here
  - 2026-09-28. No pending rows existed yet (October is generated on 1/10), so inside the block the September Netflix row was set back to `pendiente` first. Result: `columnas=2; firmas=1; update: misma_fila=t estado=confirmada monto=13.00 canal=whatsapp msg=dryrun-0023-a fecha=2026-09-28 12:00:00+00; segunda: already-confirmed; insert (Cetelem, no September row): estado=confirmada canal=whatsapp msg=dryrun-0023-b ciclo=2026-09-01 insertadas=1; plan (DB Bank set inactive): plan-completed; exec anon=f authenticated=f service_role=t`. Afterwards: 0 `pregunta_*` columns, only the 0021 signature, Netflix `confirmada 15.00` with no `canal`, 0 `dryrun%` rows, Cetelem 0 inserted and active, DB Bank active.
- [x] 2.7 👤 Brian confirms, then apply 0023 with `apply_migration` — verify with `list_migrations` and a read-only query that the two columns exist, are null on the one channel, and the function has seven parameters
  - 2026-09-28, confirmed by Brian. `list_migrations` shows `20260928011726 0023_pregunta_pendiente_y_origen`; the `whatsapp` channel has `pregunta_pendiente` and `pregunta_vence_en` null; one `completar_cargo_recurrente` with 7 parameters; anon cannot execute it.

## 3. Logic, adapter, texts

- [x] 3.1 Add the `bot` namespace to `messages/es.json` and `messages/en.json` (design D10): `confirmacionGasto`, `confirmacionIngreso`, `confirmacionAhorro`, `confirmacionRetiro`, `hoy`, `ayer`, `preguntaCategoria`, `yaCargado`, `noEntendi`, `todaviaNo` — verify both files parse and hold the same keys (`node -e` comparing `Object.keys`)
- [x] 3.2 Rewrite `processMessage` in `lib/bot/logic.ts` (design D6, D8, D9, D10): load user and bot context with `supabaseAdmin()`, build `pending` from `IncomingMessage`, parse, then per action: `cargar` → date from `dias_atras` in the user's timezone, category by normalised name → "Otros" → `ask` when neither exists, write through the creators with `origin`, or the recurring branch with `completar_cargo_recurrente` (`text` on equal amount, `recurring-discrepancy` with `text` on a different one, `yaCargado` on `already-confirmed`, ordinary load on `plan-completed` / `not-found`); `repreguntar` → `{ kind: 'ask' }`; `no_entendido` → `noEntendi`; the other four → `todaviaNo`. Add `ask` and the `text` field of `recurring-discrepancy` to `BotReply`; `IncomingMessage` gains `pending?` — verify `npx tsc --noEmit` and `npm run lint` pass
- [x] 3.3 Add `formatBotAmount(locale, currency, amount)` and `formatBotDay(locale, today, date)` next to the logic, reusing `currencyFormatOptions` — verify a unit test covers "45 €" (es, EUR), "€45.50" (en, EUR), `hoy` / `ayer` / short date, under `npm run test:unit`
- [x] 3.4 Create `lib/whatsapp/send.ts` with `sendText(phone, text)` posting to the Cloud API, logging (masked) and swallowing failures (design D11) — verify `npx tsc --noEmit` passes and a call without `WHATSAPP_TOKEN` logs and does not throw
- [x] 3.5 Update `lib/whatsapp/adapter.ts` (design D7, D12): read the pending question after the retry check and pass it to `processMessage`; on `ask` write the question then send; on any other kind clear it; `sendReply` sends `text`, `ask` and the discrepancy's `text` through `sendText`, and keeps logging the discrepancy. Set `export const maxDuration = 60` in `app/api/whatsapp/route.ts` — verify `npx tsc --noEmit`, `npm run lint` and `npm run build` pass
- [x] 3.6 Model down (amendment, 2026-09-28, asked by Brian): `parseMessage` returns `{ accion: 'no_disponible' }` (type `ParseResult`, outside `ActionSchema`) when both model calls throw; the logic replies `{ kind: 'unavailable', text: bot.noDisponible }`; the adapter does not clear the pending question on `unavailable`. `noDisponible` in both catalogs — verify `npx tsc --noEmit` passes, `npm run lint` shows only the known `PendingRecurringDecision` warning, `npm run test:unit` passes (parser tests: two throws → `no_disponible`; throw then invalid → `no_entendido`; throw then valid → the action) and the `bot` keys match in both catalogs
  - 2026-09-28: tsc clean, lint 0 errors (the known warning), 63/63 unit tests, keys equal.
- [x] 3.7 Timeout per model call (amendment, 2026-09-28, from the 6.2 silence): `createGeminiModel` passes `abortSignal: AbortSignal.timeout(GEMINI_TIMEOUT_MS)` (20 s) so two attempts fit in `maxDuration` 60 and a hung call ends in `no_disponible` (3.6) instead of the function dying without a reply — verify `npx tsc --noEmit`, `npm run lint` (known warning only), `npm run test:unit` and `npm run test:parser` pass, and a direct SDK call with a 300 ms signal throws `AbortError`
  - 2026-09-28: tsc clean, lint 0 errors, 63/63, eval 18/18, SDK aborted after 309 ms with `AbortError`.

## 4. Parser evaluation (needs `GEMINI_API_KEY`)

- [x] 4.1 👤 Create a Gemini API key and put `GEMINI_API_KEY` in `.env.local` — verify `grep -c GEMINI_API_KEY .env.local` prints 1
- [x] 4.2 Create `lib/bot/parser.eval.mjs` (design D13): loads `parser-cases.json`, runs the 15 cases sequentially with the file's categories, `recurringNames: []` and locale `es`, compares expected fields as a subset with `categoria` case-insensitive, prints `ok` / `FAIL` per case with the parsed object on failure, exits 1 on any failure — verify `npm run test:parser` runs end to end
- [x] 4.3 Iterate on the prompt until `npm run test:parser` passes 15/15 twice in a row (the cases are the truth; only the prompt changes) — record the final run's output here
  - Done 2026-09-28 with the paid key (Tier 1; `.env.local` had an older free-tier key, replaced by Brian). The prompt needed no change: two runs in a row, both 18/18 (15 recorded cases + the 3 extra of 4.4). Pacing removed from the eval (the free tier's 5 per minute no longer applies). Final run:
    ```
    ok    cafe 3,5.
    ok    date 80
    ok    30 super
    ok    nafta 45 ayer
    ok    cobré 2100
    ok    propina 500
    ok    ahorré 200
    ok    saqué 100 del ahorro
    ok    gasté 50
    ok    no, era 40
    ok    borrá eso
    ok    crea categoria Musica
    ok    libre
    ok    ¿cómo vengo?
    ok    asdasda
    ok    netflix 13
    ok    cobré 2100
    ok    comida
    18/18 passed
    ```
- [x] 4.4 Add two recurring cases to the eval's own extra list (not to `parser-cases.json`): "netflix 13" with `recurringNames: ['Netflix']` → `recurrente` "Netflix"; "cobré 2100" with a recurring income name present → `recurrente` null; plus one pending-question case ("comida" after a pending `gasto` 50 → `cargar` 50 Comida) — verify `npm run test:parser` passes them
  - The three extra cases live in `parser.eval.mjs` and pass in both runs of 4.3.

## 5. Local end-to-end without WhatsApp

- [x] 5.1 With `npm run dev` and the real database, run `processMessage` for Brian's account through a throwaway script (as the 8.x checks of `add-supabase-data-layer-and-login` did) for "nafta 45 ayer", "propina 500", "ahorré 200", "gasté 50" then "comida", and "asdasda", each with a fresh fake message id, after 👤 Brian agrees to these five test rows — verify on `/dashboard` the rows appear with the right type, amount, category and date, that the pending question was written and cleared on `canales`, and that a second call with the same message id is discarded before the model; then delete the test rows from the web (soft delete) and record it here
  - 2026-09-28, confirmed by Brian. No `WHATSAPP_APP_SECRET` in `.env.local`, so instead of the webhook the script imported the real `handleMessages` (adapter → `processMessage`) through `jiti` with `server-only` stubbed, and caught the POST to Meta to print the reply. Gemini was also counted through `fetch`. Ids `e2e-1790597823619-1…6`, one model call per message:
    - "nafta 45 ayer" → `gasto` 45 Transporte "Nafta" on 2026-09-27, `canal=whatsapp`, `confirmada`; reply "Anotado: 45 € en Transporte, ayer."
    - "propina 500" → `ingreso` 500 "Propina" today; "Anotado: ingreso de 500 €, hoy."
    - "ahorré 200" → `ahorro` 200 "Depósito" today; "Anotado: 200 € al ahorro, hoy."
    - "gasté 50" → no row; category question sent; `canales.pregunta_pendiente` = `{"tipo":"gasto","monto":50,"diasAtras":0}` with a 30 min expiry.
    - "comida" → `gasto` 50 Comida today; "Anotado: 50 € en Comida, hoy."; pending question cleared.
    - "asdasda" → no row; `noEntendi`; pending still null.
    - Resending id `-1` → `retry discarded`, 0 model calls, no reply, still one row.
    - Brian saw the four rows on `/dashboard` and deletes them himself. The ahorro row has no delete in the web yet (`add-savings-sheet`).
- [x] 5.2 Same script for one pending October charge at its expected amount and one at a different amount (👤 Brian picks which, after the cron generated October) — verify the pending row is confirmed, no second row exists, `canal` and `mensaje_id_externo` are set, the reply carries the discrepancy on the second one, and a repeat gets `yaCargado`
  - 2026-09-28, cycle `2026-09-28` (Brian's cycle now starts on the 28th; generated by hand, see `add-cycle-projection-and-recurring-cron` 2.7). Brian picked Alquiler (1000) and Gimnasio (50), both pending on 1/10. Same adapter path as 5.1, ids `e2e52-1790599596265-1…3`:
    - "alquiler 1000" → "Anotado: 1.000 € en Vivienda, hoy."; the pending row `ea3d1672…` became `confirmada` 1000 on 28/9 with `canal=whatsapp` and the message id; still one Alquiler row in the cycle.
    - "gimnasio 55" → "Anotado: 55 € en Salud, hoy." plus the log `recurring discrepancy for …8917: Gimnasio expected 50, loaded 55`; row `ac830e01…` `confirmada` 55, origin set; still one row.
    - "alquiler 1000" again with a new id → "Alquiler ya está anotado en este ciclo. Si fue otro pago, cárgalo desde la web."; nothing written (2 rows carry `e2e52-%`).
    - Then, as agreed with Brian, both rows were restored through the MCP to `pendiente`, 1/10, 1000 and 50, no `canal` or message id.
  - Before the run, the parser alone with Brian's real categories and recurring names (no writes): "alquilr 1000", "alkiler 1000", "el alqui 1000", "gym 55" and "gimnacio 55" → `recurrente` set; "renta 1000" → `recurrente` null (a synonym would duplicate the pending charge: the accepted risk); "pagué el alquiler" (no amount) → `no_entendido`.

## 6. Deploy

- [x] 6.1 👤 `GEMINI_API_KEY` in Vercel Production; redeploy — verify the Vercel log of a webhook call shows no `Missing GEMINI_API_KEY`
  - 2026-09-28, Brian: "cafe 3,5." from WhatsApp got "Anotado: 3,50 € en Ocio, hoy."; the Vercel log of `POST /api/whatsapp` (production, `dpl_7dCaLhGTK8gJNcxYuRcKj195kATu`) is a 200 with 5.24 s of execution and no `Missing GEMINI_API_KEY`.
- [x] 6.2 👤 Test round from Brian's WhatsApp with the 15 messages of `parser-cases.json` and two fixed charges; check each reply and each row on `/dashboard` — record the failures in `ROADMAP.md` block 5 as the list for `add-bot-conversation`
  - 2026-09-28, Brian, from WhatsApp in production. Every case of the 15 answered as expected. For case 9 he typed "gate 50" by mistake: the category question came, "Otros" loaded 50 in Otros. Both fixed charges did what they should: Obra social and Psicóloga, 51 each, completed their pending rows with the origin set and no second row.
  - One failure: after the "Otros" load, "osea lo que gaste esos 50 eran comida" got **no reply** and wrote nothing. Locally the parser returns `corregir` → Comida for that text (3 of 3 runs), which should reply `todaviaNo`, Cause, from the Vercel log Brian passed (`POST /api/whatsapp` 14:01:50, request `9h6sm-1790600510476-…`): execution 1 min (the `maxDuration` cap), six Supabase `GET`s and one `POST` to Gemini, nothing after — the model call hung and the function was killed before a second attempt, a write or a send. Fixed by 3.7 (20 s timeout per call). Recorded in `ROADMAP.md` block 5.
  - Afterwards, at Brian's request, the 9 test rows of the round and the 3 left from 5.1 were soft-deleted through the MCP (`borrado_en = now()`, 12 ids); 0 non-recurring WhatsApp rows remain active. The two fixed charges were tests too: restored to `pendiente` on 1/10 with their expected amounts (Obra social 51, Psicóloga 50), no `canal` or message id.

## 7. Documentation

- [x] 7.1 Tick block 5's parser, load, types and missing-datum items in `ROADMAP.md`; add the pending-question (30 min on `canales`), the recurring branch and the `already-confirmed` reply to ARCHITECTURE.md §3 as implemented notes; update `CLAUDE.md` status (bot section, migrations 0023, tests) and *Deuda técnica* (no reply for a discarded retry after a lost send; duplicates when the parser misses a recurring name) — verify the three files mention 0023 and `test:parser`
