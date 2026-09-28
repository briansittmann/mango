import type { BudgetRow } from './budget'
import type { LocalDate } from './expenses'
import type { RecurringDefinition } from './recurring'

// What a cycle holds before (or instead of) its rows existing — `cycle-projection` → *A future
// cycle is computed, not stored*. `/dashboard`, `/demo` and the cron (`generar_ciclo`) all call
// it, so a projected cycle and the same cycle once generated never disagree (ARCHITECTURE §3).
// Only type imports, so Node's test runner can load this file directly.

export type ProjectedCharge = {
  definitionId: string
  tipo: 'gasto' | 'ingreso'
  categoryId: string | null
  name: string
  amount: number
  date: LocalDate
}

export type CycleProjection = {
  charges: ProjectedCharge[]
  /** Category → budget amount; `null` is a "no budget in this cycle" marker. */
  budgets: Map<string, number | null>
  savings: number
}

function lastDayOfMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate()
}

/**
 * The date a definition's `day` falls on inside the cycle that starts on `start` (`cycle-projection`
 * → *A recurring charge falls on its day inside the cycle*): a day at or after the cycle's start
 * day is in the start's month, an earlier one in the following month, and a day the month lacks
 * becomes that month's last day (Q3).
 */
export function fechaEnCiclo(start: LocalDate, day: number): LocalDate {
  const [year, month, startDay] = start.split('-').map(Number)
  const first = new Date(Date.UTC(year, month - 1 + (day >= startDay ? 0 : 1), 1))
  const y = first.getUTCFullYear()
  const m = first.getUTCMonth() + 1
  const d = Math.min(day, lastDayOfMonth(y, m))
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

/**
 * The projection of the cycle starting on `start`. `cyclesAfterGenerated` is n: 1 for the cycle
 * right after the last generated one. A definition is included while it is active and its
 * charges produced so far plus n do not exceed its total. Budgets are the cycle's own rows when
 * it has any, otherwise the most recent earlier cycle's (the copy's selection, without writing).
 * The free margin is left to `getFreeMargin`, so there is one margin formula.
 */
export function proyectarCiclo({
  start,
  cyclesAfterGenerated,
  definitions,
  budgetRows,
  savingsTarget,
}: {
  start: LocalDate
  cyclesAfterGenerated: number
  definitions: RecurringDefinition[]
  budgetRows: BudgetRow[]
  savingsTarget: number | null
}): CycleProjection {
  const charges = definitions
    .filter(
      (d) =>
        d.active && (d.repetitions == null || d.repetitions.done + cyclesAfterGenerated <= d.repetitions.total),
    )
    .map((d) => ({
      definitionId: d.id,
      tipo: d.tipo,
      categoryId: d.categoryId,
      name: d.name,
      amount: d.expectedAmount,
      date: fechaEnCiclo(start, d.day),
    }))
    .sort((a, b) => a.date.localeCompare(b.date))

  const source = budgetRows.reduce<LocalDate | null>(
    (latest, row) => (row.cycle <= start && (latest == null || row.cycle > latest) ? row.cycle : latest),
    null,
  )
  const budgets = new Map(
    budgetRows.filter((row) => row.cycle === source).map((row) => [row.categoryId, row.amount] as const),
  )

  return { charges, budgets, savings: savingsTarget ?? 0 }
}

/**
 * The projected charges still to list beside a projected cycle's real rows (`cycle-projection` →
 * *A future cycle is computed, not stored*, D1): a row linked to a definition for the cycle
 * starting on `start` holds that definition's slot — the `(movimiento_recurrente_id, ciclo_mes)`
 * key `generar_ciclo` respects — and replaces its charge. Callers pass soft-deleted linked rows
 * too: a deleted slot is still held, so its charge is not listed (`add-forward-scoped-edits` D1).
 * A row with no definition replaces nothing.
 */
export function mezclarProyeccion({
  charges,
  rows,
  start,
}: {
  charges: ProjectedCharge[]
  rows: { definitionId: string | null; cycle: LocalDate | null }[]
  start: LocalDate
}): ProjectedCharge[] {
  const held = new Set(rows.filter((row) => row.definitionId != null && row.cycle === start).map((row) => row.definitionId))
  return charges.filter((charge) => !held.has(charge.definitionId))
}

/**
 * What a definition shows in each of `cycles` before a change "from this month on" rewrites it
 * (`add-forward-scoped-edits` D2, D3): the cycles strictly between the one in progress and the
 * one the change is made from, each with its count after the last generated cycle. A cycle where
 * the projection does not list the definition (inactive, or its plan already over) freezes
 * nothing. Both data sources write these as that cycle's slot, only where no slot exists yet.
 */
export function congelarCiclos({
  definition,
  cycles,
}: {
  definition: RecurringDefinition
  cycles: { start: LocalDate; cyclesAfterGenerated: number }[]
}): { cycle: LocalDate; charge: ProjectedCharge }[] {
  return cycles.flatMap(({ start, cyclesAfterGenerated }) => {
    const [charge] = proyectarCiclo({ start, cyclesAfterGenerated, definitions: [definition], budgetRows: [], savingsTarget: null }).charges
    return charge ? [{ cycle: start, charge }] : []
  })
}
