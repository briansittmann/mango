/**
 * Which recurring expenses get their reminder today, and the three values of the Meta template
 * that carries it (ARCHITECTURE.md §14.1). Pure, relative imports only, so `reminders.test.mjs`
 * loads it from plain Node; the cron (`app/api/cron/recordatorios`) does the reads and the sends.
 */

import type { AmountFormat } from '../data/amount-format.ts'
import type { LocalDate } from '../data/expenses.ts'
import { proyectarCiclo } from '../data/projection.ts'
import type { RecurringDefinition } from '../data/recurring.ts'
import { formatBotAmount } from './format.ts'

/**
 * The approved templates per account language, sent with that language as its code. `plain`:
 * `📅 Recordatorio: {{1}} se te cobra {{2}}, por {{3}}.` — name, when, amount. `card`, for a fixed
 * expense charged to a card (`card-wallet`), is longer — Meta rejects four values in a short text:
 * `📅 Recordatorio de Mango: {{1}} se te cobra {{2}}, por un monto de {{3}}.` then
 * `💳 Se va a debitar de tu tarjeta {{4}}, …`. Meta takes no empty value, so the card cannot be an
 * optional `{{4}}` of one template.
 */
export const REMINDER_TEMPLATES = {
  es: { plain: 'recordatorio_cobro_es', card: 'recordatorio_cobro_tarjeta_es' },
  en: { plain: 'recordatorio_cobro_en', card: 'recordatorio_cobro_tarjeta_en' },
} as const

/** A definition with its reminder marker (the date of the last charge already reminded) and its card's name. */
export type ReminderDefinition = RecurringDefinition & { remindedFor: LocalDate | null; card: string | null }

/** A definition's row in a cycle; it holds the slot, so it replaces the projected charge. */
export type SlotRow = { definitionId: string; cycle: LocalDate; pending: boolean; amount: number; date: LocalDate }

export type DueReminder = {
  definitionId: string
  name: string
  amount: number
  date: LocalDate
  card: string | null
  remindedFor: LocalDate | null
}

/** Whole days from `from` to `to` (both `YYYY-MM-DD`), on UTC calendar arithmetic. */
function daysFrom(from: LocalDate, to: LocalDate): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000)
}

/**
 * The reminders to send today: per active expense definition with its reminder on, the earliest
 * charge still to come within `daysBefore` days (today included) that is later than its marker.
 * A charge is the definition's row in that cycle when it has one — only while pending: a paid or
 * deleted slot is not reminded — otherwise the projected charge (`proyectarCiclo`), the same rule
 * "Próximos cobros" and `mezclarProyeccion` follow. A window instead of an exact day means a
 * missed run or a reminder turned on late still warns before the charge, and the marker keeps it
 * to one reminder per charge.
 */
export function dueReminders({
  today,
  definitions,
  cycles,
  rows,
}: {
  today: LocalDate
  definitions: ReminderDefinition[]
  /** The cycle in progress and the ones after it, each with its count after the last generated. */
  cycles: { start: LocalDate; cyclesAfterGenerated: number }[]
  rows: SlotRow[]
}): DueReminder[] {
  const reminded = definitions.filter((d) => d.active && d.tipo === 'gasto' && d.reminder.active)

  const charges = cycles.flatMap(({ start, cyclesAfterGenerated }) => {
    const projected = proyectarCiclo({ start, cyclesAfterGenerated, definitions: reminded, budgetRows: [], savingsTarget: null }).charges
    return reminded.flatMap((d) => {
      const row = rows.find((r) => r.definitionId === d.id && r.cycle === start)
      if (row) return row.pending ? [{ definitionId: d.id, amount: row.amount, date: row.date }] : []
      const charge = projected.find((c) => c.definitionId === d.id)
      return charge ? [{ definitionId: d.id, amount: charge.amount, date: charge.date }] : []
    })
  })

  return reminded.flatMap((d) => {
    const [next] = charges
      .filter((c) => {
        const days = daysFrom(today, c.date)
        return c.definitionId === d.id && days >= 0 && days <= d.reminder.daysBefore && (d.remindedFor == null || c.date > d.remindedFor)
      })
      .sort((a, b) => a.date.localeCompare(b.date))
    return next
      ? [{ definitionId: d.id, name: d.name, amount: next.amount, date: next.date, card: d.card, remindedFor: d.remindedFor }]
      : []
  })
}

/**
 * `{{1}}`, `{{2}}`, `{{3}}`: the name, "hoy" / "mañana" / "dentro de 3 días", and the amount as
 * the bot writes it; `{{4}}`, the card's name, only when there is one (the `card` template).
 */
export function reminderParams(
  { locale, currency, amountFormat, today }: { locale: string; currency: string; amountFormat: AmountFormat; today: LocalDate },
  reminder: Pick<DueReminder, 'name' | 'amount' | 'date' | 'card'>,
): string[] {
  return [
    reminder.name,
    new Intl.RelativeTimeFormat(locale, { numeric: 'auto' }).format(daysFrom(today, reminder.date), 'day'),
    formatBotAmount(locale, currency, reminder.amount, amountFormat),
    ...(reminder.card == null ? [] : [reminder.card]),
  ]
}
