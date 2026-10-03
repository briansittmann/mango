import type { AmountFormat } from './amount-format'
import type { CategoryMutations } from './categories'
import type { CategoryColor } from './dashboard'
import type { LocalDate } from './expenses'
import type { ProfileMutations, WhatsAppState } from './profile'
import type { RecurringDefinition, RecurringMutations } from './recurring'

/** The seven steps of `/onboarding`, in order (`onboarding` capability). */
export const ONBOARDING_STEPS = 7

export type OnboardingProfile = {
  name: string
  /** ISO code, or null while the account has no country. */
  country: string | null
  currency: string
  timezone: string
  cycleDay: number
  /** The stored format (`usuarios.formato_montos`), not the one in effect. */
  amountFormat: AmountFormat
  savingsTarget: number | null
  phone: string | null
}

/**
 * What the onboarding template renders from (`add-web-onboarding` D2), loaded by the page the way
 * `DashboardData` is: the pending step, the profile, the cycle in progress, the categories alive in
 * it, the definitions, the cycle's budget rows as a map (null = "no budget" marker), and whether
 * anything is keyed to the cycle yet (D6).
 */
export type OnboardingData = {
  step: number
  profile: OnboardingProfile
  cycle: { start: LocalDate; today: LocalDate }
  categories: { id: string; name: string; color: CategoryColor }[]
  definitions: RecurringDefinition[]
  budgets: Record<string, number | null>
  hasData: boolean
  /** The channel's state for the closing step (`whatsapp-linking` → *The web shows the channel's state*). */
  whatsapp: WhatsAppState
}

/**
 * The operations the onboarding writes through (D2): the dashboard's own category and definition
 * contracts, the profile contract, the pending charges of the cycle in progress (D9) and the close.
 */
export type OnboardingActions = {
  profile: ProfileMutations
  categories: Pick<CategoryMutations, 'create' | 'update' | 'delete' | 'reorder'>
  recurring: Pick<RecurringMutations, 'create' | 'update' | 'stop' | 'delete'>
  materializeCurrentCycle(): Promise<void>
  /** Stores the pending charges, marks the onboarding complete and leads to the dashboard. */
  finish(): Promise<void>
  /** Re-reads the account, so a link made in the chat shows while the closing step waits (D7). */
  refresh(): Promise<void>
}
