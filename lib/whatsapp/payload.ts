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

function extractMessage(message: unknown): WhatsAppMessage | null {
  if (!isObject(message)) return null

  // Text only for now. Incoming images, audio and reactions are discarded
  // until there's something to do with them.
  if (message.type !== 'text') return null

  const { id, from } = message
  const text = isObject(message.text) ? message.text.body : undefined

  if (typeof id !== 'string' || typeof from !== 'string' || typeof text !== 'string') {
    return null
  }

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
