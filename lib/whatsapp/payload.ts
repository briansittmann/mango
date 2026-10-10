/**
 * Translates Meta's payload into our own format. This file and the
 * adapter are the only ones that know WhatsApp's shape; nobody else
 * sees it from here inward (ARCHITECTURE.md §3).
 */

export type WhatsAppMessage = {
  /** E.164 with `+`. Meta sends it without one. */
  phone: string
  text: string
  messageId: string
  /** A reply button's id (`interactive.button_reply.id`); `text` is empty then (design D2). */
  buttonId?: string
  /** A voice note recorded in the chat (`add-voice-messages` D1); `text` is empty then. The adapter downloads it by `id`. */
  audio?: { id: string; mimeType: string; voice: boolean }
  /** Meta's `type` of a message the bot does not handle (image, document, an attached audio file…): answered with one fixed text. */
  unsupported?: string
}

/** Meta message types the bot answers with the fixed "text and voice notes only" reply (`bot-voice-messages`). */
const UNSUPPORTED_TYPES = new Set(['image', 'video', 'document', 'sticker', 'location', 'contacts'])

export function extractMessages(payload: unknown): WhatsAppMessage[] {
  const messages: WhatsAppMessage[] = []
  if (!isObject(payload)) return messages

  for (const entry of asArray(payload.entry)) {
    if (!isObject(entry)) continue

    for (const change of asArray(entry.changes)) {
      if (!isObject(change) || !isObject(change.value)) continue

      // Status notifications (sent, delivered, read) come in `statuses`,
      // not `messages`: reading only `messages` skips them.
      for (const message of asArray(change.value.messages)) {
        const extracted = extractMessage(message)
        if (extracted) messages.push(extracted)
      }
    }
  }

  return messages
}

/** What a message is, for the logs: `text`, `button`, `voice` or `unsupported:<type>`. */
export function messageKind(message: WhatsAppMessage): string {
  if (message.buttonId !== undefined) return 'button'
  if (message.audio) return 'voice'
  if (message.unsupported) return `unsupported:${message.unsupported}`
  return 'text'
}

/**
 * Event types in a payload that carries no message we handle (`status:read`,
 * `message:reaction`…), for the logs. Never reads contents, only types.
 */
export function describeEvents(payload: unknown): string[] {
  const events: string[] = []
  if (!isObject(payload)) return events

  for (const entry of asArray(payload.entry)) {
    if (!isObject(entry)) continue

    for (const change of asArray(entry.changes)) {
      if (!isObject(change) || !isObject(change.value)) continue

      for (const status of asArray(change.value.statuses)) {
        if (isObject(status)) events.push(`status:${String(status.status)}`)
      }
      for (const message of asArray(change.value.messages)) {
        if (isObject(message)) events.push(`message:${String(message.type)}`)
      }
      if (events.length === 0) events.push(`field:${String(change.field)}`)
    }
  }

  return events
}

/**
 * One of three shapes: a text or a reply-button press, a voice note (an `audio` with `voice: true`),
 * or an unsupported media type. Reactions and other interactive types are dropped: no reply is owed.
 */
function extractMessage(message: unknown): WhatsAppMessage | null {
  if (!isObject(message)) return null

  const { id, from, type } = message
  if (typeof id !== 'string' || typeof from !== 'string' || typeof type !== 'string') return null
  const base = { phone: toE164(from), text: '', messageId: id }

  if (type === 'interactive') {
    const reply = isObject(message.interactive) && message.interactive.type === 'button_reply' ? message.interactive.button_reply : undefined
    const buttonId = isObject(reply) ? reply.id : undefined
    return typeof buttonId === 'string' ? { ...base, buttonId } : null
  }

  if (type === 'text') {
    const text = isObject(message.text) ? message.text.body : undefined
    return typeof text === 'string' ? { ...base, text } : null
  }

  if (type === 'audio') {
    const audio = isObject(message.audio) ? message.audio : undefined
    if (!audio || typeof audio.id !== 'string') return null
    // An attached or forwarded audio file is not a voice note: its duration cannot be read the same way (design, Non-Goals).
    if (audio.voice !== true) return { ...base, unsupported: 'audio' }
    return { ...base, audio: { id: audio.id, mimeType: typeof audio.mime_type === 'string' ? audio.mime_type : 'audio/ogg', voice: true } }
  }

  return UNSUPPORTED_TYPES.has(type) ? { ...base, unsupported: type } : null
}

/**
 * Meta sends the number without `+` (`353871234567`); in `usuarios` it
 * lives in E.164 with `+`, which is how the table's constraint validates it.
 *
 * TODO: watch out for Argentina — Meta's `wa_id` sometimes comes without the
 * mobile 9 (`54...` instead of `549...`), so a number stored with the 9
 * wouldn't match. Resolve when the first Argentine user signs up.
 */
function toE164(rawNumber: string): string {
  return `+${rawNumber.replace(/\D/g, '')}`
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : []
}
