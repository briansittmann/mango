import type { BudgetStatus } from './dashboard'
import type { LocalDate } from './expenses'

/**
 * A `presupuestos` row. `cycle` is the cycle's first day (`periodo`), computed from
 * `dia_inicio_ciclo`, not the calendar month. `amount: null` is an explicit "no budget in this
 * cycle" marker (`monto` null). A category has at most one row per cycle.
 *
 * Every data source applies these rules (`category-editing` → *Budgets belong to one cycle*):
 * - when a cycle becomes current and holds no row at all, markers included, every row of the
 *   most recent earlier cycle that holds any is copied into it, markers included, before any
 *   figure is computed. A cycle that already holds a row never receives a copy.
 * - no row is ever written for a cycle after the current one, by the copy or by any edit
 * - setting or changing a budget, and creating a category with one, write the current cycle's
 *   row only. Clearing writes a marker for the current cycle instead of deleting the row.
 *   Earlier cycles never change.
 * - deleting a category removes its rows in every cycle
 * - a marker, or no row after the copy, means the category has no budget in that cycle
 */
export type BudgetRow = { categoryId: string; cycle: LocalDate; amount: number | null }

export function getBudgetStatus({
  amount,
  spent,
  currentDay,
  cycleDays,
}: {
  amount: number
  spent: number
  currentDay: number
  cycleDays: number
}): BudgetStatus {
  const usage = spent / amount
  const remaining = Math.max(0, amount - spent)
  const daysLeft = cycleDays - currentDay + 1
  const weeklyAllowance = daysLeft >= 7 ? Math.floor((remaining / daysLeft) * 7) : null
  const level = usage >= 1 ? 'exceeded' : usage >= 0.8 ? 'warning' : 'ok'

  return { amount, spent, usage, level, remaining, daysLeft, weeklyAllowance }
}

/**
 * The free margin, derived on every read and never stored (`category-editing` → *A budget
 * reserves its amount in the free margin*). `fixed` is every recurring charge of the cycle;
 * each category's `spent` leaves recurring charges out, so every expense counts once.
 */
export function getFreeMargin({
  income,
  savings,
  fixed,
  categories,
}: {
  income: number
  savings: number
  fixed: number
  categories: { budget: number | null; spent: number }[]
}): number {
  const reserved = categories.reduce(
    (sum, { budget, spent }) => sum + (budget == null ? spent : Math.max(budget, spent)),
    0,
  )
  return income - savings - fixed - reserved
}
