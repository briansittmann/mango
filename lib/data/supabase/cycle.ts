import type { SupabaseClient } from '@supabase/supabase-js'
import type { LocalDate } from '@/lib/data/expenses'

/** `[inicio, fin)` of a billing cycle, as instants (`rango_ciclo`, migration 0010). */
export type CycleRange = { inicio: Date; fin: Date }

export async function cycleRange(
  client: SupabaseClient,
  { diaInicio, timezone, ref }: { diaInicio: number; timezone: string; ref: Date },
): Promise<CycleRange> {
  const { data, error } = await client
    .rpc('rango_ciclo', { p_dia_inicio: diaInicio, p_timezone: timezone, p_fecha_ref: ref.toISOString() })
    .single<{ inicio: string; fin: string }>()

  if (error) throw error
  return { inicio: new Date(data.inicio), fin: new Date(data.fin) }
}

/**
 * The instant whose cycle is the one named `month` (D9). Local day 1 is before every start day
 * above 1, so it falls in the cycle that ends in `month`; with start day 1 it is `month` itself.
 */
export function refInstantForMonth(month: string): Date {
  return new Date(`${month}-01T12:00:00Z`)
}

export function shiftMonth(month: string, n: number): string {
  const [year, m] = month.split('-').map(Number)
  const date = new Date(Date.UTC(year, m - 1 + n, 1))
  return date.toISOString().slice(0, 7)
}

/**
 * `?mes=` → the month to show. Anything that is not `YYYY-MM`, or a month after the cycle in
 * progress, becomes the cycle in progress: no URL shows a future cycle or asks for its budgets.
 */
export function parseMonthParam(value: string | string[] | undefined, current: string): string {
  if (typeof value !== 'string' || !/^\d{4}-(0[1-9]|1[0-2])$/.test(value)) return current
  return value > current ? current : value
}

/** The same formatter `DashboardTemplate` uses to place rows on a calendar day. */
export function localDateOf(instant: string | Date, timeZone: string): LocalDate {
  return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(
    new Date(instant),
  )
}

/** A cycle is named after the local calendar month of its last day. */
export function cycleMonthOf(range: CycleRange, timeZone: string): string {
  return localDateOf(new Date(range.fin.getTime() - 1), timeZone).slice(0, 7)
}
