/**
 * The linking message and its `wa.me` link (`whatsapp-linking`, `add-whatsapp-linking` D5, D6).
 * Pure and relative-import free: the adapter, the pages and the unit test share it, and nothing
 * here reads `process.env` — the number people write to is passed in by the page.
 */

/** What the person sends: `vincular K7M2PX`. */
export function linkMessage(code: string): string {
  return `vincular ${code}`
}

/** The link that opens WhatsApp against `number` (digits only) with the message written. */
export function whatsAppLink(number: string, code: string): string {
  return `https://wa.me/${number}?text=${encodeURIComponent(linkMessage(code))}`
}

const LINK_MESSAGE = /^\s*vincular\s+([a-z0-9]{6})\s*$/i

/** The code of a linking message, uppercased; null for any other text (case and spacing ignored). */
export function parseLinkMessage(text: string): string | null {
  const match = LINK_MESSAGE.exec(text)
  return match ? match[1].toUpperCase() : null
}
