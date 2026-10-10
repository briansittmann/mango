/**
 * The adapter's decisions, with every side effect injected (`add-whatsapp-linking` D5): what
 * `lib/whatsapp/adapter.ts` does with one message, written so `adapter.test.mjs` can run it with
 * the data functions and the sends faked. Only relative imports to pure modules, so Node loads it.
 */
import { parseLinkMessage } from './link.ts'

import type { MediaResult } from './media.ts'
import type { WhatsAppMessage } from './payload.ts'

export type Channel = 'whatsapp' | 'telegram'
export type Locale = 'es' | 'en'

/** The strings the adapter sends on its own, per locale (`bot.*` in `messages/*.json`). */
export type AdapterTexts = Record<
  Locale,
  { vinculado: string; yaVinculado: string; codigoInvalido: string; numeroEnOtraCuenta: string; cuentaYaVinculada: string; soloTextoYAudio: string }
>

export type LinkResult = { ok: true; userId: string } | { ok: false; error: 'codigo-invalido' | 'cuenta-ya-vinculada' | 'numero-en-otra-cuenta' }

export type UnknownReply = { kind: 'text'; text: string } | { kind: 'none' }

export type HandlerDeps = {
  findUserIdByPhone(phone: string): Promise<string | null>
  linkChannel(channel: Channel, code: string, externalId: string): Promise<LinkResult>
  registerUnknownContact(channel: Channel, externalId: string): Promise<boolean>
  /** The account's language, for the reply to a linked or linking chat. */
  localeOf(userId: string): Promise<Locale>
  processUnknownNumber(input: { channel: Channel; externalId: string; text: string; answered: boolean }): Promise<UnknownReply>
  /** Idempotency by channel and message id: a retry of a message that wrote a movement is discarded. */
  messageAlreadyProcessed(userId: string, messageId: string): Promise<boolean>
  /** Fetches a voice note's bytes from the platform (`add-voice-messages` D2). Never throws. */
  downloadMedia(id: string): Promise<MediaResult>
  /** The known flow after the checks above: channel state, logic, confirmation. `audio` is set for a voice note. */
  handleKnown(userId: string, message: WhatsAppMessage, audio?: MediaResult): Promise<void>
  sendText(phone: string, text: string): Promise<void>
  texts: AdapterTexts
}

/** The Spanish line, a blank line and the English line: a stranger's language is unknown (D5). */
export function bilingual(texts: AdapterTexts, key: keyof AdapterTexts['es']): string {
  return `${texts.es[key]}\n\n${texts.en[key]}`
}

/**
 * In order: (1) resolve the sender; (2) a linking message is resolved here for known and unknown
 * senders alike and never reaches the parser; (3) any other message from an unknown number is
 * remembered and answered once, a button press ignored; (4) the known flow: a retry is discarded,
 * an unsupported media type gets its fixed reply without touching the channel, a voice note is
 * downloaded, and the rest goes to `handleKnown`.
 */
export async function handleIncoming(message: WhatsAppMessage, deps: HandlerDeps): Promise<void> {
  const userId = await deps.findUserIdByPhone(message.phone)
  const code = message.buttonId === undefined ? parseLinkMessage(message.text) : null

  if (code !== null) {
    if (userId) {
      await deps.sendText(message.phone, deps.texts[await deps.localeOf(userId)].yaVinculado)
      return
    }
    const result = await deps.linkChannel('whatsapp', code, message.phone)
    if (result.ok) {
      await deps.sendText(message.phone, deps.texts[await deps.localeOf(result.userId)].vinculado)
      return
    }
    const key = result.error === 'codigo-invalido' ? 'codigoInvalido' : result.error === 'cuenta-ya-vinculada' ? 'cuentaYaVinculada' : 'numeroEnOtraCuenta'
    await deps.sendText(message.phone, bilingual(deps.texts, key))
    return
  }

  if (!userId) {
    // A button press from a stranger names nothing of theirs: dropped without a reply.
    if (message.buttonId !== undefined) return
    const answered = !(await deps.registerUnknownContact('whatsapp', message.phone))
    const reply = await deps.processUnknownNumber({ channel: 'whatsapp', externalId: message.phone, text: message.text, answered })
    if (reply.kind === 'text') await deps.sendText(message.phone, reply.text)
    return
  }

  if (await deps.messageAlreadyProcessed(userId, message.messageId)) {
    console.info(`[whatsapp] retry discarded: ${message.messageId}`)
    return
  }

  // Other media never reach the logic (D7): one fixed reply, the channel's question and last load untouched.
  if (message.unsupported) {
    await deps.sendText(message.phone, deps.texts[await deps.localeOf(userId)].soloTextoYAudio)
    return
  }

  // A voice note is downloaded here, after the idempotency check, so a retry never downloads (D2).
  const audio = message.audio ? await deps.downloadMedia(message.audio.id) : undefined
  await deps.handleKnown(userId, message, audio)
}
