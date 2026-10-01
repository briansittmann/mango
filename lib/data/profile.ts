import type { AmountFormat } from './amount-format.ts'
import { CURRENCIES, countryOf } from './countries.ts'

/**
 * The `usuarios` fields the onboarding's basics step and the "Cuenta" sheet set
 * (`add-web-onboarding` D3). `country` is the ISO code (`'AR'`); `timezone` one of that country's
 * zones; `cycleDay` 1–28; `amountFormat` abbreviated only for Argentina.
 */
export type ProfileBasics = {
  name: string
  country: string
  currency: string
  timezone: string
  cycleDay: number
  amountFormat: AmountFormat
}

/**
 * The profile operations, injected by the page (D3). Each resolves once the change is durable and
 * rejects with nothing changed:
 * - `updateBasics` writes the six basics at once; it rejects `CYCLE_LOCKED` when `cycleDay`
 *   differs from the stored day and the account holds any category, definition, budget row or
 *   movement (D6), and `INVALID_COUNTRY` / `INVALID_CURRENCY` / `INVALID_TIMEZONE` / `INVALID_NAME`
 *   / `INVALID_CYCLE_DAY` on a value outside `validateBasics`
 * - `setSavingsTarget` writes `meta_ahorro_mensual`, null to clear it
 * - `requestWhatsApp` stores the phone (E.164), the code uppercased and the time of the request;
 *   rejects `PHONE_TAKEN` when another account holds the phone and `INVALID_PHONE` otherwise
 * - `setStep` stores the pending onboarding step (1–7)
 * - `complete` marks the onboarding complete
 */
export type ProfileMutations = {
  updateBasics(basics: ProfileBasics): Promise<void>
  setSavingsTarget(amount: number | null): Promise<void>
  requestWhatsApp(phone: string, inviteCode: string | null): Promise<void>
  setStep(step: number): Promise<void>
  complete(): Promise<void>
}

export const CYCLE_LOCKED = 'cycle-locked'
export const INVALID_NAME = 'invalid-name'
export const INVALID_COUNTRY = 'invalid-country'
export const INVALID_CURRENCY = 'invalid-currency'
export const INVALID_TIMEZONE = 'invalid-timezone'
export const INVALID_CYCLE_DAY = 'invalid-cycle-day'
export const PHONE_TAKEN = 'phone-taken'
export const INVALID_PHONE = 'invalid-phone'

/** Every rejection message a profile operation can carry, so a server action can pass it as a value. */
export const PROFILE_ERRORS = [
  CYCLE_LOCKED,
  INVALID_NAME,
  INVALID_COUNTRY,
  INVALID_CURRENCY,
  INVALID_TIMEZONE,
  INVALID_CYCLE_DAY,
  PHONE_TAKEN,
  INVALID_PHONE,
] as const

export const MAX_NAME_LENGTH = 80

/**
 * The basics as the server stores them (D3): the name trimmed and 1–80 characters, the country in
 * the table, the currency one the table knows, the timezone one of the country's, the day 1–28, and
 * the abbreviated format only for Argentina (complete is stored for any other country whatever was
 * chosen). Throws the matching `INVALID_*` message.
 */
export function validateBasics(input: ProfileBasics): ProfileBasics {
  const name = input.name.trim()
  if (name.length === 0 || name.length > MAX_NAME_LENGTH) throw new Error(INVALID_NAME)

  const country = countryOf(input.country)
  if (!country) throw new Error(INVALID_COUNTRY)

  if (!CURRENCIES.includes(input.currency)) throw new Error(INVALID_CURRENCY)
  if (!country.timezones.includes(input.timezone)) throw new Error(INVALID_TIMEZONE)
  if (!Number.isInteger(input.cycleDay) || input.cycleDay < 1 || input.cycleDay > 28) throw new Error(INVALID_CYCLE_DAY)

  return {
    name,
    country: country.code,
    currency: input.currency,
    timezone: input.timezone,
    cycleDay: input.cycleDay,
    amountFormat: country.code === 'AR' && input.amountFormat === 'abreviado' ? 'abreviado' : 'completo',
  }
}
