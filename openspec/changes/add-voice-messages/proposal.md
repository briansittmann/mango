## Why

Loading an expense is the one thing Mango needs people to do every day, and on a phone a voice note ("café tres cincuenta") is faster than typing, especially walking or driving. Today the webhook discards every `audio` message without a word (`extractMessage` keeps only `text` and button presses), so a person who speaks to the bot gets silence. The parser already runs on a model that understands audio natively, so the cost of accepting voice notes is one adapter branch and one parser input, not a transcription service.

## What Changes

- **A voice note loads like a text.** When a WhatsApp message of type `audio` arrives from a linked chat, the adapter fetches the file from Meta with the existing `WHATSAPP_TOKEN` (one GET for the media URL, one GET for the bytes) and hands the bot logic the audio instead of the text: bytes plus MIME type, in the internal format, so the logic keeps knowing nothing about WhatsApp. The parser sends that audio inline to Gemini in the one call it already makes, with the same action contract plus a new `transcripcion` field. Everything after the parse is unchanged: the seven actions, Otros as the fallback, the category question, corrections on the chat's last load, idempotency by channel and message id.
- **Voice replies are always text and show what was heard.** Every reply to a voice note starts with the transcription ("🎤 Escuché: «café tres cincuenta»"). A load from a voice note is confirmed in text with Undo whatever the account's count or mode, and the count still rises (decision 1).
- **At most 30 seconds.** The duration is measured from the audio itself (Meta's payload carries none). A longer note is not sent to the model and the bot asks for a shorter one or a text (decision 2).
- **The transcription is stored only for VIP accounts**, as the incoming text of the turn, exactly like typed messages today. The audio bytes are never stored anywhere, for anyone: they live in memory for the request and are dropped (decision 3).
- **Other media get one fixed answer.** An image, video, document, sticker, location or contact card from a linked chat gets "solo entiendo texto y notas de voz de hasta 30 segundos", with no model call and no change to the channel's state. Today they are dropped silently.
- **Error paths are explicit**: a failed download or an undecodable file answers "no pude escuchar tu audio ahora" without writing anything and keeps any pending question, like `no_disponible`; an audio the model cannot turn into an action answers the not-understood text with the transcription in front, so the person sees what went wrong.
- **The parser evaluation gains recorded voice notes**: a handful of real Ogg/Opus notes with their expected actions, run by `npm run test:parser` against the real model.

## Capabilities

### New Capabilities

- `bot-voice-messages`: what the bot does with a voice note (same actions as text, the 30 s limit, text replies carrying the transcription, the failure answers, the audio never being stored) and with any other media type.

### Modified Capabilities

- `bot-message-parsing`: *A message becomes exactly one action from the seven* — the message may arrive as audio; the action then carries `transcripcion` and spoken amounts are understood; *The parser is evaluated against the recorded cases* — recorded voice notes join the evaluation.
- `bot-progressive-confirmation`: *Some replies are always text* — a load from a voice note is always confirmed in text with Undo.
- `bot-conversation-history`: *Only VIP accounts have their messages stored* — for a voice note the stored incoming text is the transcription; the audio itself is never stored.
- `messaging-channels`: *The bot logic does not know the channel's mechanics* — the logic receives the message as text or as audio (bytes and MIME type), never a media id or URL. Written over the wording `add-whatsapp-linking` leaves, so this change archives after it.

## Impact

- **Bot**: `lib/whatsapp/payload.ts` (extract `audio` and the unsupported types), new `lib/whatsapp/media.ts` (Graph API media URL + download, size cap, timeouts), `lib/whatsapp/adapter.ts` and `handle-message.ts` (download before the logic; fixed reply for other media; unknown numbers unchanged), `lib/bot/logic.ts` (`IncomingMessage.audio`, transcription line, `alwaysText` for voice loads, transcription into `mensajes`), `lib/bot/parser.ts` (`ParseInput.audio`, `transcripcion` on every action when the input is audio, prompt rules for spoken amounts, the retry re-sends the audio), `lib/bot/gemini.ts` (`Model` takes a prompt and optional inline audio), new pure `lib/bot/audio.ts` (Ogg/Opus duration, `MAX_AUDIO_SECONDS = 30`), `messages/*.json` (`bot.escuche`, `bot.audioLargo`, `bot.audioNoDescargado`, `bot.audioSinVoz`, `bot.soloTextoYAudio`).
- **Tests**: `lib/whatsapp/payload.test.mjs`, `adapter.test.mjs`, `lib/bot/parser.test.mjs` (fake model receives the audio), new `lib/bot/audio.test.mjs` (duration from a fixture), `lib/bot/parser.eval.mjs` plus `lib/bot/voice-cases/` (recorded notes and `voice-cases.json`).
- **Database**: nothing. `mensajes.texto` holds the transcription; `transacciones.mensaje_id_externo` holds the audio message's `wamid` as it holds a text's.
- **Environment**: nothing new. `WHATSAPP_TOKEN` already authorises the Graph API; `GEMINI_API_KEY` is the same key. `maxDuration` of the webhook stays at 60 s (measured budget in design D9).
- **Cost**: a 30 s note is about 960 audio tokens on input (32 per second, measured 1136 for 34 s), well under a cent per note on the paid tier; one more text message per voice load on WhatsApp, because voice loads never confirm with a reaction.
- **Docs**: ARCHITECTURE.md §3 (adapter: media download; parser: audio input; confirmation: voice exception) and §11 (voice as more sensitive data), ROADMAP.md, CLAUDE.md, `docs/bot-conversacion-ejemplo.md` after the manual round.
- **Not touched**: Telegram. No Telegram adapter exists in the code (only `app/api/whatsapp`); when it is written, its voice notes reuse the same internal format (design, Non-Goals).
