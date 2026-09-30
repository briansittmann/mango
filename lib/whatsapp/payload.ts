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
}

export function extractTextMessages(payload: unknown): WhatsAppMessage[] {
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

/**
 * Event types in a payload that carries no text message (`status:read`,
 * `message:image`…), for the logs. Never reads contents, only types.
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

function extractMessage(message: unknown): WhatsAppMessage | null {
  if (!isObject(message)) return null

  // Text and reply-button presses only. Incoming images, audio, reactions and other
  // interactive types are discarded until there's something to do with them.
  const { id, from } = message
  if (typeof id !== 'string' || typeof from !== 'string') return null

  if (message.type === 'interactive') {
    const reply = isObject(message.interactive) && message.interactive.type === 'button_reply' ? message.interactive.button_reply : undefined
    const buttonId = isObject(reply) ? reply.id : undefined
    return typeof buttonId === 'string' ? { phone: toE164(from), text: '', messageId: id, buttonId } : null
  }

  if (message.type !== 'text') return null
  const text = isObject(message.text) ? message.text.body : undefined
  if (typeof text !== 'string') return null

  return { phone: toE164(from), text, messageId: id }
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
