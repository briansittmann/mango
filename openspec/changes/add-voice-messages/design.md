## Context

See proposal.md for motivation. What shapes the approach:

- **The adapter is thin and the logic is channel-blind** (ARCHITECTURE.md §3). `app/api/whatsapp/route.ts` answers Meta with 200 and runs `handleMessages` inside `after()`, under `maxDuration = 60`. `lib/whatsapp/payload.ts` is the only file that knows Meta's shape; today `extractMessage` returns null for anything but `text` and a `button_reply`, so audio and media are logged as `message:audio` and dropped. `handle-message.ts` orders the decisions with injected effects; `adapter.ts` owns the channel state and decides text vs reaction (`confirmLoad`, honouring `reply.alwaysText`).
- **The parser is one Gemini call with a Zod gate.** `parseMessage` builds one prompt string, calls `Model = (prompt) => Promise<string>` at most twice (the retry carries the previous output and the Zod issues) and returns `no_entendido` or `no_disponible`. `createGeminiModel` pins `gemini-3.8-flash`, JSON mode, temperature 0, `AbortSignal.timeout(20_000)` per call. The schema is a `discriminatedUnion` of seven `strictObject`s.
- **Gemini is paid (Tier 1) since 2026-09-28**, documented in ARCHITECTURE.md §1 and ROADMAP.md: the free tier gave 20 requests a day and lets Google use the content. **This contradicts decision 4 of the request ("se sigue en la capa gratuita")**; the design assumes the key stays on Tier 1 because that is what the code and the docs say today, and records the free-tier risk as asked (Risks, Open Questions).
- **Meta's audio payload has no duration.** The webhook `audio` object carries `id`, `mime_type` (`audio/ogg; codecs=opus` for a voice note), `sha256`, `voice` (true for a recorded note, false for an attached file) and nothing else; the media endpoint (`GET graph.facebook.com/v21.0/{id}`) returns `url`, `mime_type`, `sha256`, `file_size`; the URL lives 5 minutes and the download needs the same bearer token. Audio is capped at 16 MB by Meta.
- **Gemini audio facts.** Inline audio goes as a base64 `inlineData` part next to the text part; Ogg/Opus is accepted; 32 tokens per second of audio; 20 MB per request. Paid Services: prompts and files are not used to improve Google's products.
- **Measured (2026-10-08, `gemini-3.8-flash`, from this laptop, synthetic Spanish speech, three runs each):**

  | Clip | File | Latency | Input tokens | Thinking tokens |
  |---|---|---|---|---|
  | 2 s | AIFF 89 KB | 3.4–4.7 s | 334 | 127–233 |
  | 13 s | AIFF 582 KB | 4.6–6.9 s | 613 | 181–464 |
  | 34 s | AIFF 1.5 MB | 6.4–7.4 s | 1136 | 342–538 |
  | 34 s | AAC 165 KB | 3.9–6.0 s | 1136 | 164–484 |

  The model transcribed and returned a valid action every time, including "tres cincuenta" → 3.5. It also turned "doce con cuarenta" into 2,40 twice on the low-quality synthetic voice: spoken amounts need a rule in the prompt and real recordings in the eval. The Meta download was not measured (it needs a live media id); two Graph API round trips for a file under 100 KB are budgeted at 0.5–2 s.
- **No Telegram adapter exists**: only `app/api/whatsapp`. `Channel` already admits `'telegram'`.
- **Task 1.1 (2026-10-08): not yet answered by Brian.** The code was written on the Tier 1 assumption above; if the key goes back to the free tier, the proposal has to be revised (Open Questions) before the deploy.
- **Measured again (2026-10-08, synthetic Spanish speech from macOS `say`, encoded to Ogg/Opus at 24 kbps and muxed by hand, through `parseMessage` with audio, `audio/ogg; codecs=opus` passed as is):** "café tres cincuenta, hoy a la mañana" (2.6 s, 7.8 KB) → `cargar` 3.5 in Ocio, 3.7–5.7 s per call; "farmacia doce con cuarenta" (1.8 s) → 12.4 in Salud, 4.4–4.9 s; "cobré dos mil cien" (1 s) → income 2100, 4.5–5.0 s; "¿cómo vengo este mes?" (1 s) → `consultar` `mes`, 3.6–3.7 s. Every speech run returned a valid action on the first attempt. **Pure digital silence and white noise (3 s each) were transcribed as plausible loads on nine of nine runs** ("mandarina tres con cincuenta", "guardé mil quinientos", "cuatro mil quinientos en compras de súper ayer"), with the "no inventes" rule, with an explicit silence example in the prompt, with the closing instruction to return `no_entendido` on silence, and with the audio part before the text part. A plain-text "is there a voice?" question on the same files also answered "sí" for silence ("Hola", "Acepto"). See Risks.

## Goals / Non-Goals

**Goals:**
- A voice note reaches the logic as `{ data, mimeType }` in the internal format; the logic and the parser stay free of WhatsApp.
- One model request per attempt, audio inline; the same seven actions plus `transcripcion`.
- The 30 s rule enforced from the bytes, before paying for the model.
- Every failure path has a reply and writes nothing; retries stay safe.
- No audio persisted anywhere; transcription stored only for VIP.

**Non-Goals:**
- Telegram voice notes: there is no Telegram adapter to extend. When it is written, it fills the same `audio` field of `IncomingMessage` and nothing downstream changes.
- Attached audio files (`voice: false`, MP3/M4A/AAC/AMR): the duration cannot be read from those containers with a few lines, and nobody loads an expense by forwarding an MP3. They get the "other media" reply (spec). Revisit if asked.
- Images of receipts: same fixed reply; OCR of tickets is a different change.
- Several movements in one note: like a text, one message is one action (Open Questions).
- Any UI or setting to turn voice on or off per account.

## Decisions

### D1. The audio travels in the internal format as bytes plus MIME type

`IncomingMessage` gains `audio?: { data: Uint8Array; mimeType: string }`; `text` stays and is `''` for a voice note, as it already is for a button press. `WhatsAppMessage` (payload.ts) gains `audio?: { id: string; mimeType: string; voice: boolean }` and `unsupported?: string` (the Meta `type` for image, video, document, sticker, location, contacts, and for an `audio` with `voice: false`). `extractMessage` returns one of three shapes: text/button as today, voice note, or unsupported. `reaction` keeps returning null (no reply is ever owed to a reaction).

*Why bytes, not a URL or an id*: the logic and the parser must not know Meta exists (ARCHITECTURE.md §3), and the URL carries Meta's token requirement and a 5-minute life. Bytes are channel-neutral: a Telegram adapter would fetch its own file and fill the same field.

*Alternative rejected*: a `content: { kind: 'text' } | { kind: 'audio' }` union. Cleaner on paper, but it forces every reader of `message.text` (history, linking, unknown-number reply) to switch on the kind for no gain.

### D2. The adapter downloads, with a size cap before the second request

New `lib/whatsapp/media.ts`, `downloadMedia(id): Promise<{ data: Uint8Array; mimeType: string } | { error: 'download' | 'too-large' }>`: GET `https://graph.facebook.com/v21.0/${id}` with the bearer `WHATSAPP_TOKEN`, read `url`, `mime_type`, `file_size`; refuse with `too-large` when `file_size` exceeds `MAX_AUDIO_BYTES` (1 MB: a WhatsApp voice note is ~2 KB per second, so 30 s is about 60 KB and 1 MB is minutes of speech) without fetching the file; else GET `url` with the same bearer and return the bytes. Each request has its own `AbortSignal.timeout(10_000)`. Nothing is written to disk. The function never throws: a network error, a non-2xx or a timeout is `{ error: 'download' }`, logged with the message id, never the URL (it embeds nothing secret, but it is noise).

The download happens in `handleKnown` (adapter.ts), after the idempotency check and before `readChannelState`, so a retry never downloads and a long note never pays for a model call. `handle-message.ts` gets the `downloadMedia` dependency injected like the others, so `adapter.test.mjs` can fake it.

*Why the adapter and not the logic*: the download is Meta's mechanics (token, URL expiry); `messaging-channels` says the logic receives no media ids or URLs.

### D3. Duration is read from the Ogg container, in a pure module

New `lib/bot/audio.ts`: `oggOpusDurationSeconds(data): number | null`, which finds the last `OggS` page, reads its 64-bit granule position (Opus granules are always at 48 kHz) and subtracts the pre-skip from the `OpusHead` of the first page; null when the data is not an Ogg/Opus stream. `MAX_AUDIO_SECONDS = 30` lives next to it. About thirty lines, no dependency, tested against a real voice-note fixture. The logic calls it before `parseMessage`: longer → `audioLargo` reply; null → the same reply as a failed download (`audioNoDescargado`), because the bytes are not a note we can process.

*Why not trust Meta*: it sends no duration. *Why not ask Gemini*: that is a paid call to decide whether to pay for a call, and the model can be wrong about length. *Why not `file_size` alone*: bitrate varies with silence; the cap in D2 is only an abuse guard, the second is the real rule.

*Why in `lib/bot` and not `lib/whatsapp`*: the 30 s is a product rule of the bot (same for every channel); the Ogg parsing is format-specific, not platform-specific. Telegram voice notes are Ogg/Opus too.

### D4. The parser sends the audio inline, in the same call, and asks for `transcripcion`

`ParseInput` gains `audio?: { data: Uint8Array; mimeType: string }` (then `text` is ignored). `Model` becomes `(request: { prompt: string; audio?: { data: Uint8Array; mimeType: string } }) => Promise<string>`; `createGeminiModel` builds `contents: [{ role: 'user', parts: [{ text }, { inlineData: { mimeType, data: base64 } }] }]` when audio is present and keeps the single text content otherwise. The retry re-sends the audio with the feedback appended to the prompt, as today for text. Timeout stays at 20 s per call: the measured worst case is 7.4 s at 34 s of audio.

Prompt changes when audio is present: the `MENSAJE` section becomes "El mensaje es la nota de voz adjunta. Primero transcribila literalmente en `transcripcion` (vacía si no se entiende nada) y después devolvé la acción para esa transcripción"; the action list shows `transcripcion` on every object; a rule block for spoken amounts ("tres cincuenta" → 3.5, "doce con cuarenta" → 12.4, "tres con veinte" → 3.2, "dos mil cien" → 2100, "cuarenta y cinco" → 45, "y medio" → .5) and "si la nota tiene varios movimientos, devolvé solo el primero" (Open Questions). The `MIME type` is `audio/ogg` (Meta's `audio/ogg; codecs=opus` is passed as is; Gemini accepts it; if it refuses the parameter, strip to `audio/ogg`, checked in 4.3). **Checked (4.3, 2026-10-08):** `gemini-3.8-flash` accepts `audio/ogg; codecs=opus` as is on every run; nothing is stripped. The prompt also ends with "Si no se oye ninguna palabra, devolvé exactamente {"accion":"no_entendido","transcripcion":""}" and the examples gain one silence case; neither stopped the hallucination on synthetic silence (Context, Risks), but they cost nothing and are kept.

Schema: `VoiceActionSchema` is the same seven variants each extended with `transcripcion: z.string()` (empty allowed), built from the existing variant list so the two never drift; `parseMessage` validates with it when `input.audio` is set and with `ActionSchema` otherwise. The parse result type gains `transcripcion?: string`. A `Cargar` that comes back without `transcripcion` on a voice input is a schema error and triggers the retry, as any other.

*Alternative rejected*: a separate "transcribe" call followed by the text parser. Two calls double the latency and the failure surface, and the model understands "tres cincuenta" better with the audio than from a transcript that already turned it into "3:50".

### D5. Every reply to a voice note is text and starts with what was heard

In `logic.ts`, `answer()` runs the parse as today and, when the input was audio, wraps the reply: `text` becomes `t('escuche', { texto: transcripcion }) + '\n' + text` for every kind (`loaded`, `ask`, `text`), and a `loaded` reply gets `alwaysText: true`. `confirmLoad` in the adapter already sends text with Undo on `alwaysText` and still raises the count: no adapter change for decision 1. When the action is `no_entendido` with an empty `transcripcion`, the reply is `audioSinVoz` without the quote line. `unavailable` (model never answered) keeps its text as today and gets the quote only if there is one (there is not: no answer, no transcription).

Why the quote on every reply and not only on loads: a wrong hearing matters as much on "borrá eso" as on a load, and one rule is easier to trust than a list of exceptions. The query replies carry it too (Open Questions).

### D6. Transcription into `mensajes` for VIP, audio nowhere

`remember()` stores the transcription as the incoming text (`storeExchange({ incoming: transcripcion })`), plain, with no marker: the history block of the prompt reads naturally. When the parse returned no transcription (model down, too long, download failed), the incoming text stored is `'🎤'` alone, so the turn still exists in the history and nothing invented goes in. The `Uint8Array` is dropped with the request; nothing of it reaches `console.*` (logs name `messageId` and the duration). Non-VIP: unchanged, nothing stored.

### D7. Other media are answered by the adapter, not the logic

`handleKnown` sends `soloTextoYAudio` for `unsupported` messages right after the idempotency check (which is a no-op for them: they never write a movement, so a Meta retry answers again, same as a retried query today, accepted in `add-bot-conversation` D4) and returns without touching `canales`. For an unknown number, `handleIncoming` already routes any non-button message to `processUnknownNumber`; a voice note or a photo from a stranger goes the same way with `text: ''` and gets the once-only reply. The texts are bilingual there as today.

*Why the adapter*: the reply has no account logic in it and the message carries nothing the parser could use.

### D8. Failure replies and the channel's state

| Case | Model call | Written | Pending question | Reply |
|---|---|---|---|---|
| Download error, timeout, undecodable | no | nothing | kept | `audioNoDescargado` ("⏳ No pude escuchar tu audio ahora. Volvé a mandarlo en un rato, o escribímelo.") |
| `file_size` over cap, or duration > 30 s | no | nothing | kept | `audioLargo` ("🎤 Ese audio es muy largo. Mandame uno de hasta 30 segundos, o escribímelo.") |
| Model down twice | 2 | nothing | kept | `noDisponible`, as text today |
| `no_entendido` with transcription | ≤ 2 | nothing | cleared | `escuche` + `noEntendi` |
| `no_entendido` without transcription | ≤ 2 | nothing | cleared | `audioSinVoz` ("🎤 No escuché nada en ese audio. Probá de nuevo o escribímelo.") |
| Other media | no | nothing | kept | `soloTextoYAudio` ("🤷 Solo entiendo texto y notas de voz de hasta 30 segundos.") |

The first two are returned by the logic as `kind: 'unavailable'` so the adapter keeps the pending question with the code it already has. English equivalents in `en.json`.

### D9. Time budget: `maxDuration` stays at 60 s

Worst case for one voice note inside `after()`: idempotency read (~0.1 s) + two Graph GETs (≤ 2 s, each with a 10 s cap) + channel state (~0.1 s) + two model attempts at the 20 s cap each (40 s; measured typical 4–8 s) + write and summary read (~0.5 s) + send (~0.5 s) ≈ 45 s capped, ~10 s typical. That fits the 60 s already declared, with no change to Vercel settings. If the account moves to Fluid compute the ceiling becomes 300 s on Hobby, but nothing here needs it. A batch of several messages in one webhook call is processed sequentially today; two voice notes in one call would be ~20 s typical, still inside. Not changed.

**Measured (6.4, 2026-10-08, from this laptop):** model call with audio, first attempt, 3.2–7.3 s over 30 runs on notes of 1–3 s (median ~4.8 s); the design's earlier run gave 6.4–7.4 s for 34 s of audio. The Meta download could not be measured without a live media id (budgeted 0.5–2 s, 10 s cap per request); the end-to-end run against the real database (6.3) is pending Brian's confirmation. Typical total stays under 15 s and the worst case (two model attempts at the 20 s cap plus two downloads at the 10 s cap) under 60 s.

### D10. Eval and tests

- `lib/bot/voice-cases/`: six to eight real voice notes recorded by Brian on WhatsApp and exported (Ogg/Opus, under 30 s), plus `voice-cases.json` (`archivo`, `esperado`, optional `transcripcion` compared with case, accents and punctuation ignored). `parser.eval.mjs` runs them after the text cases through the same `parseMessage` with `audio` set. Cases: a plain load, a decimal in words, an income, a query, a correction, "borrá eso", a note with only noise, and one at 25–29 s.
- `parser.test.mjs`: the fake model receives `{ prompt, audio }`; the prompt has the voice section only when `audio` is set; a voice input validated against a `cargar` without `transcripcion` retries; the text path is unchanged.
- `audio.test.mjs`: the duration of one committed fixture (a 3 s note) within ±0.1 s; null on random bytes; the long fixture over 30. **As built (2026-10-08):** the two fixtures are synthetic (`sintetico-3s.ogg`, 2.62 s, 7.8 KB; `sintetico-38s.ogg`, 38.66 s, 120 KB: macOS `say` → Opus WASM → Ogg muxed by hand), so the duration test does not wait for Brian's recordings; they are not eval cases. The eval's eight cases (`voice-cases.json`) name Brian's files and fail while a file is missing.
- `payload.test.mjs`: an `audio` message with `voice: true` becomes a voice note; `voice: false`, `image`, `document`, `sticker` become `unsupported`; `reaction` is null.
- `adapter.test.mjs`: with `downloadMedia` faked, a voice note reaches `handleKnown` with bytes and no id; a retry never calls the download; unsupported gets the fixed text and no logic call; a stranger's voice note is answered once.
- Manual round (Brian, in production after the deploy): each row of the D8 table plus the happy paths, logged into `docs/bot-conversacion-ejemplo.md`.

### D11. Texts

`bot.escuche`, `bot.audioLargo`, `bot.audioNoDescargado`, `bot.audioSinVoz`, `bot.soloTextoYAudio` in `es.json` and `en.json`, voseo in Spanish, each with its leading icon like the rest of the namespace.

## Risks / Trade-offs

- [Voice is more sensitive than text, and the free tier would let Google train on it] → Today the key is on Tier 1 (paid), where Google states prompts and files are not used to improve its products; the spec forbids storing the audio anywhere. If the key ever falls back to unpaid quota (billing removed, budget cap hit with the project switched to free), every voice note becomes training material and a voice is a biometric trait, not just a sentence. Mitigation: keep Tier 1 (Open Questions asks Brian to confirm), add a line to ARCHITECTURE.md §11, and never log or persist the bytes.
- [**The model invents a transcription on a note with no speech**] → Measured on 2026-10-08 (Context): synthetic silence and white noise became plausible loads on every run, whatever the prompt said. The *Nothing heard* scenario of `bot-voice-messages` is therefore **not met on synthetic input**; whether it is met on real background noise (a phone recording in a street or a room, which is never digital silence) is decided by the recording of task 1.2 and the manual round. Today's net: every reply quotes what was heard and the load carries Undo, so an invented load is visible and reversible in one tap, like a misheard amount. If real noise also hallucinates, the follow-up is a signal gate before the model (decode the Opus frames and refuse a note whose energy never reaches speech level), which needs an Opus decoder the current design avoids; a self-assessed "is there a voice" field in the JSON was tried in plain text and answered yes on silence, so it is not the fix.
- [Spoken amounts misheard] → Measured twice on synthetic speech: "doce con cuarenta" → 2,40. The transcription is quoted in every reply and the load carries Undo, so a wrong hearing is visible and reversible in one tap; the prompt gets explicit spoken-amount rules and the eval gets real recordings. Residual: an unnoticed wrong amount, same as a typo today.
- [One more WhatsApp message per voice load] → A voice load never confirms with a reaction, so on the test number each one costs two messages against the 1000 monthly cap, like the first 15 loads do. Accepted by decision 1; with an owned number it is cents.
- [`after()` is not a queue] → If the function dies between the download and the write, nothing is written and Meta's retry processes the note again (nothing recorded the id). If it dies after the write and before the send, the row stays and the retry is discarded: same as text today (Deuda técnica, "Reintento sin respuesta").
- [Meta's media URL expires in 5 minutes] → The download runs inside the same `after()` as the webhook, seconds after the event; a retry gets a fresh URL from the same media id (valid 7 days).
- [Ogg parsing edge cases] → A note whose last page has no granule (truncated upload) returns null and gets `audioNoDescargado`; nothing is sent to the model on a guess.
- [Cost per note] → ~1000 input tokens per 30 s plus thinking tokens (measured up to ~540); at Tier 1 Flash prices this is a fraction of a cent per note. The 5 USD budget alert of ARCHITECTURE.md §1 stays the guard.
- [Several movements in one note] → Only the first is loaded and the quote line shows the whole transcription, so the person sees what was left out. Revisable (Open Questions).
- [`messaging-channels` delta over an unarchived change] → This delta copies the requirement as `add-whatsapp-linking` rewrites it; archiving in the wrong order would drop its linking sentences. The proposal states the order.

## Migration Plan

1. No database change, no new environment variable. Deploy is one step.
2. Before the deploy: the eval passes with the voice cases (`npm run test:parser`), the unit tests pass offline, Brian has recorded the fixtures.
3. Deploy. Until then, voice notes keep being dropped silently, so there is no transitional state.
4. Manual round from Brian's chat (D10), then the conversation log and the docs.
5. Rollback: revert the deploy. Nothing persisted depends on the change (the `mensajes` rows hold plain text either way).

## Open Questions

- **Gemini tier.** The request says "se sigue en la capa gratuita"; the project pays Tier 1 since 2026-09-28 and ARCHITECTURE.md §1 explains why (20 requests a day, content used for training). The design assumes Tier 1 stays. If the intention is really to go back to the free tier, the privacy risk above becomes real and the daily quota alone (20 requests) would not cover one person's loads: that would change the proposal, not just this note.
- **Several movements in one note.** v1 loads only the first and quotes everything. Loading all of them means a list action, a multi-row confirmation and a last-load pointer per row: a later change if real notes turn out to be lists.
- **The quote line on query replies.** v1 puts "🎤 Escuché: «…»" on every reply, queries included, for one rule. If it reads as noise on "¿cómo vengo?", dropping it there is a one-line condition in `answer()`.
- **Attached audio files** (`voice: false`). Left as "other media". If someone forwards notes recorded elsewhere, the duration would need a container-agnostic reading (or trusting the model), a small follow-up.
- **The 1 MB cap.** Chosen from WhatsApp's voice bitrate (~2 KB/s); if a real 30 s note turns out larger on some phones, the cap moves. Checked against Brian's recordings in task 3.2.
