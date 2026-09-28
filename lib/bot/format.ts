/**
 * How the bot writes amounts and days in its replies (design D8, D10). Relative imports only, so
 * `format.test.mjs` loads it from plain Node.
 */

import { currencyFormatOptions } from '../../i18n/formats.ts'

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
