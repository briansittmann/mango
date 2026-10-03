/**
 * The typed phone as E.164 (`whatsapp-linking` → *The typed number is optional, converted by the
 * account's country, and never links*, `add-whatsapp-linking` D8), over `libphonenumber-js/min`:
 * the trunk zero of Ireland, the UK, Germany or Italy is dropped, and an Argentine mobile gets its
 * `9` after the country code — every WhatsApp number is a mobile, and it is how Meta reports
 * Argentine `wa_id`s. Only the phone field and the server actions load this module.
 */
import { parsePhoneNumberFromString } from 'libphonenumber-js/min'

/** The `usuarios.telefono` check (migration 0002): E.164 with a leading `+`. */
export const PHONE_PATTERN = /^\+[1-9]\d{6,14}$/

/**
 * `local` as typed (with or without a `+` prefix), interpreted for `countryCode` (ISO alpha-2).
 * Null when the number is not valid for that country or the country is unknown.
 */
export function toE164(local: string, countryCode: string): string | null {
  const trimmed = local.trim()
  if (!trimmed || !/^[A-Z]{2}$/.test(countryCode)) return null

  const parsed = parsePhoneNumberFromString(trimmed, countryCode as Parameters<typeof parsePhoneNumberFromString>[1])
  if (!parsed || !parsed.isValid()) return null

  let number = parsed.number as string
  // Argentina: the mobile `9` goes right after +54; a number typed without it (and without a
  // leading 15, which libphonenumber already strips) is a mobile for WhatsApp's purposes.
  if (parsed.country === 'AR' && number.startsWith('+54') && !number.startsWith('+549')) {
    number = `+549${number.slice(3)}`
  }
  return PHONE_PATTERN.test(number) ? number : null
}

/** An E.164 number formatted for people (`+54 9 11 5555 1234`); the input itself when it cannot be parsed. */
export function formatPhone(e164: string): string {
  return parsePhoneNumberFromString(e164)?.formatInternational() ?? e164
}
