/**
 * The countries an account can choose (`onboarding` → *Basics*, `add-web-onboarding` D4): a
 * constant list, no data access, relative-import free so Node loads it (`countries.test.mjs`).
 * Names come from `Intl.DisplayNames`, so there is no catalog entry per country. Adding a country
 * is one line; every zone must be a valid IANA name and every currency an ISO 4217 code `Intl` knows.
 */

export type Country = {
  /** ISO 3166-1 alpha-2, what `usuarios.pais` stores (`'AR'`, `'IE'`). */
  code: string
  /** ISO 4217, what `usuarios.moneda_default` stores. */
  currency: string
  /** The international dialling prefix a local number takes (`'+54'`). */
  callingCode: string
  /** IANA zones, the main one first. */
  timezones: string[]
}

export const COUNTRIES: Country[] = [
  {
    code: 'AR',
    currency: 'ARS',
    callingCode: '+54',
    timezones: [
      'America/Argentina/Buenos_Aires',
      'America/Argentina/Cordoba',
      'America/Argentina/Catamarca',
      'America/Argentina/Jujuy',
      'America/Argentina/La_Rioja',
      'America/Argentina/Mendoza',
      'America/Argentina/Rio_Gallegos',
      'America/Argentina/Salta',
      'America/Argentina/San_Juan',
      'America/Argentina/San_Luis',
      'America/Argentina/Tucuman',
      'America/Argentina/Ushuaia',
    ],
  },
  { code: 'UY', currency: 'UYU', callingCode: '+598', timezones: ['America/Montevideo'] },
  { code: 'CL', currency: 'CLP', callingCode: '+56', timezones: ['America/Santiago', 'America/Punta_Arenas', 'Pacific/Easter'] },
  { code: 'PY', currency: 'PYG', callingCode: '+595', timezones: ['America/Asuncion'] },
  { code: 'BO', currency: 'BOB', callingCode: '+591', timezones: ['America/La_Paz'] },
  { code: 'PE', currency: 'PEN', callingCode: '+51', timezones: ['America/Lima'] },
  { code: 'EC', currency: 'USD', callingCode: '+593', timezones: ['America/Guayaquil', 'Pacific/Galapagos'] },
  { code: 'CO', currency: 'COP', callingCode: '+57', timezones: ['America/Bogota'] },
  { code: 'VE', currency: 'VES', callingCode: '+58', timezones: ['America/Caracas'] },
  {
    code: 'MX',
    currency: 'MXN',
    callingCode: '+52',
    timezones: [
      'America/Mexico_City',
      'America/Cancun',
      'America/Merida',
      'America/Monterrey',
      'America/Matamoros',
      'America/Chihuahua',
      'America/Ojinaga',
      'America/Mazatlan',
      'America/Bahia_Banderas',
      'America/Hermosillo',
      'America/Tijuana',
    ],
  },
  { code: 'GT', currency: 'GTQ', callingCode: '+502', timezones: ['America/Guatemala'] },
  { code: 'CR', currency: 'CRC', callingCode: '+506', timezones: ['America/Costa_Rica'] },
  { code: 'PA', currency: 'PAB', callingCode: '+507', timezones: ['America/Panama'] },
  { code: 'DO', currency: 'DOP', callingCode: '+1', timezones: ['America/Santo_Domingo'] },
  { code: 'ES', currency: 'EUR', callingCode: '+34', timezones: ['Europe/Madrid', 'Atlantic/Canary'] },
  { code: 'PT', currency: 'EUR', callingCode: '+351', timezones: ['Europe/Lisbon', 'Atlantic/Madeira', 'Atlantic/Azores'] },
  { code: 'IE', currency: 'EUR', callingCode: '+353', timezones: ['Europe/Dublin'] },
  { code: 'GB', currency: 'GBP', callingCode: '+44', timezones: ['Europe/London'] },
  { code: 'FR', currency: 'EUR', callingCode: '+33', timezones: ['Europe/Paris'] },
  { code: 'DE', currency: 'EUR', callingCode: '+49', timezones: ['Europe/Berlin'] },
  { code: 'IT', currency: 'EUR', callingCode: '+39', timezones: ['Europe/Rome'] },
  { code: 'NL', currency: 'EUR', callingCode: '+31', timezones: ['Europe/Amsterdam'] },
  { code: 'BE', currency: 'EUR', callingCode: '+32', timezones: ['Europe/Brussels'] },
  { code: 'CH', currency: 'CHF', callingCode: '+41', timezones: ['Europe/Zurich'] },
  {
    code: 'US',
    currency: 'USD',
    callingCode: '+1',
    timezones: ['America/New_York', 'America/Chicago', 'America/Denver', 'America/Phoenix', 'America/Los_Angeles', 'America/Anchorage', 'Pacific/Honolulu'],
  },
  {
    code: 'CA',
    currency: 'CAD',
    callingCode: '+1',
    timezones: ['America/Toronto', 'America/Vancouver', 'America/Edmonton', 'America/Winnipeg', 'America/Regina', 'America/Halifax', 'America/St_Johns'],
  },
  {
    code: 'BR',
    currency: 'BRL',
    callingCode: '+55',
    timezones: [
      'America/Sao_Paulo',
      'America/Manaus',
      'America/Belem',
      'America/Fortaleza',
      'America/Recife',
      'America/Bahia',
      'America/Cuiaba',
      'America/Campo_Grande',
      'America/Rio_Branco',
      'America/Noronha',
    ],
  },
  {
    code: 'AU',
    currency: 'AUD',
    callingCode: '+61',
    timezones: ['Australia/Sydney', 'Australia/Melbourne', 'Australia/Brisbane', 'Australia/Perth', 'Australia/Adelaide', 'Australia/Darwin', 'Australia/Hobart'],
  },
]

/** The currencies the selects offer: every country's, plus `EUR` and `USD`, each once. */
export const CURRENCIES: string[] = [...new Set([...COUNTRIES.map((country) => country.currency), 'EUR', 'USD'])].sort()

export function countryOf(code: string | null | undefined): Country | null {
  return COUNTRIES.find((country) => country.code === code) ?? null
}

/**
 * A zone as the runtime canonicalises it: browsers report `America/Cordoba` for
 * `America/Argentina/Cordoba` (an ICU alias), so two names of one zone compare equal here.
 * An unknown name comes back as it is.
 */
function canonicalZone(timezone: string): string {
  try {
    return new Intl.DateTimeFormat('en', { timeZone: timezone }).resolvedOptions().timeZone
  } catch {
    return timezone
  }
}

function sameZone(a: string, b: string): boolean {
  return a === b || canonicalZone(a) === canonicalZone(b)
}

/** The country whose zones include `timezone` (the first match), or null when none holds it. */
export function countryForTimezone(timezone: string | null | undefined): string | null {
  if (!timezone) return null
  return COUNTRIES.find((country) => country.timezones.some((zone) => sameZone(zone, timezone)))?.code ?? null
}

/**
 * The timezone an account keeps after choosing `code`: the stored one when it belongs to that
 * country, otherwise the country's main zone. Null for a code outside the table.
 */
export function timezoneForCountry(code: string, stored: string | null | undefined): string | null {
  const country = countryOf(code)
  if (!country) return null
  return stored && country.timezones.some((zone) => sameZone(zone, stored)) ? stored : country.timezones[0]
}

/** The `usuarios.telefono` check (migration 0002): E.164 with a leading `+`. */
export const PHONE_PATTERN = /^\+[1-9]\d{6,14}$/

/**
 * A typed phone as E.164 (`onboarding` → *Closing step*, D11): digits only, a leading `00` becomes
 * `+`, a number typed without a prefix takes the country's calling code. Null when the result is
 * not a valid international number or the country is unknown.
 */
export function normalizePhone(input: string, countryCode: string): string | null {
  const trimmed = input.trim()
  const digits = trimmed.replace(/\D/g, '')
  if (!digits) return null

  let phone: string
  if (trimmed.startsWith('+')) phone = `+${digits}`
  else if (digits.startsWith('00')) phone = `+${digits.slice(2)}`
  else {
    const country = countryOf(countryCode)
    if (!country) return null
    phone = `${country.callingCode}${digits}`
  }

  return PHONE_PATTERN.test(phone) ? phone : null
}
