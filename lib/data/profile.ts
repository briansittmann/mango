import type { AmountFormat } from './amount-format.ts'
import type { WidgetId } from './dashboard.ts'
import type { PaymentMethod } from './payment-method.ts'
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
 * - `requestWhatsAppLink` returns the account's linking code (`whatsapp-linking` → *Each account
 *   can hold one live linking code*): the stored one while it is live (7 days from its request
 *   time, `LINK_CODE_TTL_MS`), otherwise a new code with a new request time. Sends nothing.
 * - `unlinkWhatsApp` removes the account's WhatsApp channel and its phone (`desvincular_canal`,
 *   0036), so another number can be linked with a new code; the dashboard's page supplies it
 * - `setStep` stores the pending onboarding step (1–7)
 * - `complete` marks the onboarding complete
 * - `setWidgetOrder` writes the whole desktop widget order (`orden_widgets`, 0032); the dashboard's
 *   page supplies it, the onboarding's does not
 */
export type ProfileMutations = {
  updateBasics(basics: ProfileBasics): Promise<void>
  setSavingsTarget(amount: number | null): Promise<void>
  requestWhatsAppLink(): Promise<{ code: string }>
  unlinkWhatsApp?(): Promise<void>
  setStep(step: number): Promise<void>
  complete(): Promise<void>
  setWidgetOrder?(order: WidgetId[]): Promise<void>
  /** Writes only `usuarios.medio_pago_default` (`payment-method` → *An account default payment method*); null = "Ninguno". */
  setDefaultPaymentMethod?(method: PaymentMethod | null): Promise<void>
}

/** How long a linking code is live from its request time (`whatsapp-linking`). */
export const LINK_CODE_TTL_MS = 7 * 24 * 60 * 60_000

/**
 * The WhatsApp channel as the web shows it (`add-whatsapp-linking` D6): the number people write
 * to (digits only, null when the deployment has none), the account's live code (null when none
 * or expired) and the linked identifier (null while no channel exists).
 */
export type WhatsAppState = {
  number: string | null
  code: string | null
  linked: string | null
}

export const CYCLE_LOCKED = 'cycle-locked'
export const INVALID_NAME = 'invalid-name'
export const INVALID_COUNTRY = 'invalid-country'
export const INVALID_CURRENCY = 'invalid-currency'
export const INVALID_TIMEZONE = 'invalid-timezone'
export const INVALID_CYCLE_DAY = 'invalid-cycle-day'

/** Every rejection message a profile operation can carry, so a server action can pass it as a value. */
export const PROFILE_ERRORS = [
  CYCLE_LOCKED,
  INVALID_NAME,
  INVALID_COUNTRY,
  INVALID_CURRENCY,
  INVALID_TIMEZONE,
  INVALID_CYCLE_DAY,
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
