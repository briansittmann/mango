## 1. Decisions to confirm before coding

- [ ] 1.1 👤 Brian confirms the Gemini key stays on Tier 1 (paid) or decides otherwise (design, Open Questions); the answer is written into design.md Context and, if it changes, the proposal is revised before any code
  > 2026-10-08: not answered yet; the code below assumes Tier 1 (noted in design.md Context).
- [ ] 1.2 👤 Brian records the voice fixtures on WhatsApp and exports them as Ogg/Opus into `lib/bot/voice-cases/`: a plain load ("café tres cincuenta"), a decimal in words ("farmacia doce con cuarenta"), an income ("cobré dos mil cien"), a query ("¿cómo vengo?"), a correction ("no, eran cuarenta"), "borrá eso", a note with only noise, a 25–29 s note and one over 30 s; verified by listing the files with `afinfo` durations in the task notes
  > File names expected by `voice-cases/voice-cases.json`: `cafe-tres-cincuenta.ogg`, `farmacia-doce-con-cuarenta.ogg`, `cobre-dos-mil-cien.ogg`, `como-vengo.ogg`, `no-eran-cuarenta.ogg`, `borra-eso.ogg`, `ruido.ogg`, `nota-29s.ogg`. The over-30 note is not an eval case (the gate refuses it before the model); `sintetico-38s.ogg` covers that in the unit test. Record `ruido.ogg` as real background noise (street, room), not silence: see design Risks.

## 2. Payload and media download (adapter side)

- [x] 2.1 `lib/whatsapp/payload.ts`: extract `audio` messages with `voice: true` as `{ phone, text: '', messageId, audio: { id, mimeType, voice } }`, map `audio` with `voice: false`, `image`, `video`, `document`, `sticker`, `location` and `contacts` to `{ ..., unsupported: <type> }`, keep `reaction` as null; verify with new cases in `lib/whatsapp/payload.test.mjs` (`npm run test:unit`)
- [x] 2.2 New `lib/whatsapp/media.ts` with `downloadMedia(id)` (design D2): media URL request, `MAX_AUDIO_BYTES` check before the file request, bearer download, 10 s timeout per request, never throws, logs without the URL; verify with a unit test that fakes `fetch` for success, too-large, non-2xx and timeout
- [x] 2.3 `lib/whatsapp/handle-message.ts` and `adapter.ts`: inject `downloadMedia`; in `handleKnown` answer `unsupported` with `bot.soloTextoYAudio` after the idempotency check without touching the channel; for a voice note download after the idempotency check and before `readChannelState`, pass `{ audio: { data, mimeType } }` to the logic, or the download failure as the logic expects (D8); a stranger's voice note or media goes through `processUnknownNumber` with `text: ''`; verify in `lib/whatsapp/adapter.test.mjs` (voice reaches the logic as bytes, retry never downloads, unsupported never calls the logic, stranger answered once)
  > The idempotency check moved from `adapter.ts` into `handleIncoming` (injected as `messageAlreadyProcessed`) so the order is testable from Node; `handleKnown(userId, message, audio?)` keeps channel state, logic and confirmation. The failure travels as `{ error: 'download' | 'too-large' }` in `IncomingMessage.audio`.
- [x] 2.4 `app/api/whatsapp/route.ts`: rename `extractTextMessages` to the new shape's name and keep the log line (message id, masked phone, kind); verify `npm run build` passes and the GET handshake test still passes
  > `extractMessages` + `messageKind`. `npm run build` passed; there is no automated handshake test, so it was checked by hand against `next start` (200 with the challenge echoed, 403 with a wrong token).

## 3. Duration

- [x] 3.1 New pure `lib/bot/audio.ts`: `oggOpusDurationSeconds(data)` from the last page's granule position minus pre-skip, null when not Ogg/Opus, `MAX_AUDIO_SECONDS = 30`; verify with `lib/bot/audio.test.mjs` against the 3 s fixture (±0.1 s), random bytes (null) and the over-30 fixture
  > Fixtures are synthetic (`sintetico-3s.ogg` 2.62 s, `sintetico-38s.ogg` 38.66 s, both confirmed by `afinfo`), so the test runs before Brian records. Also `refuseVoiceNote` (the gate the logic calls, task 5.1).
- [x] 3.2 Check the fixtures' sizes against `MAX_AUDIO_BYTES` (the 29 s note must be well under 1 MB) and adjust the constant if not; verify by printing the sizes in the test output
  > Printed by `audio.test.mjs`: 7 841 B for 2.6 s and 120 523 B for 38.7 s at 24 kbps, an eighth of the cap. Re-read the line when Brian's `nota-29s.ogg` lands; WhatsApp encodes at a lower bitrate, so it should be smaller.

## 4. Parser

- [x] 4.1 `lib/bot/parser.ts`: `ParseInput.audio`, `Model` takes `{ prompt, audio? }`, `VoiceActionSchema` built from the same variants plus `transcripcion: z.string()`, `parseMessage` validates with it when audio is set, result type carries `transcripcion?`; verify the text path is byte-identical in the existing tests of `parser.test.mjs`
- [x] 4.2 Prompt for audio (D4): the `MENSAJE` section for a voice note, `transcripcion` in every action of the list, the spoken-amount rules, "solo el primero" for several movements; verify with new `parser.test.mjs` cases (voice section present only with audio; fake model receives the audio; a voice `cargar` without `transcripcion` triggers the retry)
- [x] 4.3 `lib/bot/gemini.ts`: build the two-part content with `inlineData` (base64) when audio is present, same model, JSON mode, temperature 0, 20 s timeout; verify by running one fixture through it with `audio/ogg; codecs=opus` as the MIME type and, if Gemini rejects the parameter, strip it to `audio/ogg` and note it in design D4
  > Accepted as is (design D4). Four synthetic notes parsed right on every run; silence and noise were hallucinated into loads (design Context and Risks).
- [ ] 4.4 `lib/bot/parser.eval.mjs` and `lib/bot/voice-cases/voice-cases.json`: run each recorded note through `parseMessage` with `audio`, compare expected fields and the loose transcription; verify `npm run test:parser` passes twice in a row with every voice case and the 22 text cases
  > Harness and cases written; the eval prints ms per case and fails for each missing file. Passing waits on 1.2.

## 5. Logic and replies

- [x] 5.1 `lib/bot/logic.ts`: `IncomingMessage.audio`; before parsing, measure the duration (D3) and return `kind: 'unavailable'` with `bot.audioLargo` or `bot.audioNoDescargado`; pass `audio` to `parseMessage`; verify with a unit-level check that a 45 s fixture produces no model call (fake model) and keeps the pending question
  > `logic.ts` cannot load in Node (Next and Supabase imports), so the gate is the pure `refuseVoiceNote` in `audio.ts`, tested with the 38 s fixture, the two download failures and random bytes; `answer()` returns before `parseMessage` when it refuses, and `unavailable` is what the adapter already keeps the question for.
- [x] 5.2 `lib/bot/logic.ts` `answer()`: prefix every reply to a voice note with `bot.escuche`, set `alwaysText: true` on `loaded`, use `bot.audioSinVoz` for `no_entendido` with an empty transcription; verify the adapter's `confirmLoad` sends text with Undo and raises the count in `adapter.test.mjs` with a fake voice reply
  > `confirmLoad` lives in `adapter.ts` (Next imports) and already sends text with Undo and raises the count on `alwaysText` (`add-bot-conversation`); no adapter change was needed, so no new test there. The round (8.1) checks Undo and `cargas_confirmadas`.
- [x] 5.3 `remember()`: store the transcription as the incoming text for VIP, `'🎤'` alone when there is none, never the bytes; verify by reading `mensajes` after a VIP voice load in the manual round (8.1)
  > Written; the read of `mensajes` is part of 8.1.
- [x] 5.4 `messages/es.json` and `en.json`: `bot.escuche`, `bot.audioLargo`, `bot.audioNoDescargado`, `bot.audioSinVoz`, `bot.soloTextoYAudio` (voseo, leading icon); verify `npm run lint` and the i18n key check pass
  > `npm run lint` clean; the keys type-check through `createTranslator<typeof es, 'bot'>` (`tsc --noEmit` clean).

## 6. Verification

- [x] 6.1 `npm run test:unit` passes offline (parser, audio, payload, adapter, media)
  > 162/162 on 2026-10-08.
- [ ] 6.2 `npm run test:parser` passes with the voice cases (needs `GEMINI_API_KEY`), twice in a row
  > Waits on 1.2.
- [ ] 6.3 Local end to end without WhatsApp, as in `add-bot-parser-and-logging` 5.1: call `handleIncoming` with a fake `downloadMedia` that returns a fixture against the real database for Brian's account, check the row, the `mensajes` rows and the reply text, then delete the test rows (confirm before writing)
  > Not run: it writes to the real database and needs Brian's confirmation first.
- [ ] 6.4 Timing: log the download and model durations in the local run and confirm the typical total is under 15 s and the worst case under 60 s (design D9); write the numbers into design.md
  > Model durations measured and written into design D9 (3.2–7.3 s per call); the download needs a live media id, so it waits on 6.3 or the round.

## 7. Docs

- [x] 7.1 ARCHITECTURE.md §3 (adapter downloads voice notes; parser takes audio inline with `transcripcion`; voice loads are the third always-text exception; nothing of the audio is stored) and §11 (voice as sensitive data and the free-tier risk); verify by rereading the sections
  > §11 also gained the hallucination-on-silence row.
- [x] 7.2 ROADMAP.md and CLAUDE.md state (bot block: voice notes done, texts added, eval with voice cases, Deuda técnica: several movements per note, attached audio files, quote on queries)

## 8. Deploy and manual round

- [ ] 8.1 👤 Brian: deploy, then the round from his chat: a load, a decimal in words, an income, a query, a correction, "borrá eso", a note over 30 s, a noise-only note, a photo, a forwarded MP3, and a voice note while a category question is pending; each reply matches design D8 and the spec, the loads carry Undo and the count rises; verified by reading `usuarios.cargas_confirmadas` and `mensajes`
  > The noise-only note is the one that matters most: it decides whether the hallucination seen on synthetic silence happens with real background noise (design Risks).
- [ ] 8.2 Copy the round's exchanges verbatim, emojis included, into `docs/bot-conversacion-ejemplo.md`; verify the file has a "Notas de voz" section
