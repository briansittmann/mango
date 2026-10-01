/**
 * How the bot writes amounts and days in its replies (design D8, D10). Relative imports only, so
 * `format.test.mjs` loads it from plain Node.
 */

import { currencyFormatOptions } from '../../i18n/formats.ts'
import { normalizeName } from '../data/supabase/bot.ts'

/** A translator of the `bot` namespace, as `createTranslator` builds it. */
export type BotTranslate = (key: string, values?: Record<string, string | number>) => string

export type BotFormat = { locale: string; currency: string; today: string; t: BotTranslate }

/** The dashboard bar's levels (`getBudgetStatus`), as the confirmation's light (design D10). */
const LIGHTS = { ok: '🟢', warning: '🟡', exceeded: '🔴' } as const

/** A category's budget bar: the fields of `BudgetStatus` the confirmation shows. */
export type LoadBudget = { amount: number; spent: number; level: keyof typeof LIGHTS }

/** What a load wrote, as its confirmation names it. `amount` is signed for savings (negative = withdrawal). */
export type LoadSummary = { amount: number; date: string } & (
  | {
      tipo: 'gasto'
      name: string | null
      category: string
      /** The category's budget in the cycle in progress after the write; null for none or another cycle. */
      budget: LoadBudget | null
    }
  | { tipo: 'ingreso'; name: string | null }
  | { tipo: 'ahorro' }
)

/** The icon a confirmation carries after "Anotado", and the reaction that replaces it. */
export function loadIcon(load: Pick<LoadSummary, 'tipo' | 'amount'>): string {
  if (load.tipo === 'ingreso') return '💰'
  if (load.tipo === 'ahorro') return load.amount < 0 ? '🏦' : '🐷'
  return '✅'
}

/**
 * `Anotado <icon> <name> · <amount>` (design D10): an expense adds ` en <categoría>` when its
 * name is not the category, and the budget line when `budget` is set; the day shows only when it
 * is not today.
 */
export function confirmationText({ locale, currency, today, t }: BotFormat, load: LoadSummary): string {
  const monto = formatBotAmount(locale, currency, Math.abs(load.amount))
  const when = { cuando: load.date === today ? 'hoy' : 'otro', dia: formatBotDay(locale, today, load.date, t) }

  if (load.tipo === 'ingreso') return t('confirmacionIngreso', { nombre: load.name ?? t('ingreso'), monto, ...when })
  if (load.tipo === 'ahorro') return t(load.amount < 0 ? 'confirmacionRetiro' : 'confirmacionAhorro', { monto, ...when })

  const nombre = load.name ?? load.category
  const conCategoria = normalizeName(nombre) === normalizeName(load.category) ? 'no' : 'si'
  const text = t('confirmacionGasto', { nombre, monto, conCategoria, categoria: load.category, ...when })
  if (!load.budget) return text

  return `${text} ${t('lineaPresupuesto', {
    gastado: formatBotAmount(locale, currency, load.budget.spent),
    presupuesto: formatBotAmount(locale, currency, load.budget.amount),
    luz: LIGHTS[load.budget.level],
  })}`
}

/**
 * The month query's categories (design D7): spent > 0, largest first, at most `limit` in `top`;
 * `rest` counts and sums the spent categories left out, so the lines add up to the total.
 */
export function topCategories<T extends { total: number }>(
  groups: T[],
  limit = 5,
): { top: T[]; rest: { count: number; total: number } } {
  const spent = groups.filter((group) => group.total > 0).sort((a, b) => b.total - a.total)
  const left = spent.slice(limit)
  return { top: spent.slice(0, limit), rest: { count: left.length, total: left.reduce((sum, group) => sum + group.total, 0) } }
}

/** An amount as the web shows it: "45 €" in `es`, "€45.50" in `en`. */
export function formatBotAmount(locale: string, currency: string, amount: number): string {
  return new Intl.NumberFormat(locale, { ...currencyFormatOptions, currency }).format(amount)
}

/**
 * `date` relative to `today` (both `YYYY-MM-DD`): the translated "today" / "yesterday", or a
 * short calendar date ("27 sept").
 */
export function formatBotDay(
  locale: string,
  today: string,
  date: string,
  t: (key: 'hoy' | 'ayer') => string,
): string {
  if (date === today) return t('hoy')
  if (date === daysBefore(today, 1)) return t('ayer')
  return new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short', timeZone: 'UTC' }).format(
    new Date(`${date}T12:00:00Z`),
  )
}

/** `YYYY-MM-DD` minus `days`, on UTC calendar arithmetic (no DST drift). */
export function daysBefore(date: string, days: number): string {
  const [year, month, day] = date.split('-').map(Number)
  return new Date(Date.UTC(year, month - 1, day - days)).toISOString().slice(0, 10)
}
