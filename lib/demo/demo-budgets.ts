import type { BudgetRow } from '@/lib/data/budget'
import type { LocalDate } from '@/lib/data/expenses'

// The demo's in-memory `presupuestos`, following the rules on `BudgetRow`. Only type imports
// from `@/`, so Node's test runner can load this file directly.

// When `current` holds no row (markers count), copy every row of the most recent earlier cycle
// that holds any. Rows after `current` are never read and never written.
export function copyForward(rows: BudgetRow[], current: LocalDate): BudgetRow[] {
  if (rows.some((row) => row.cycle === current)) return rows
  const source = rows.reduce<LocalDate | null>(
    (latest, row) => (row.cycle < current && (latest == null || row.cycle > latest) ? row.cycle : latest),
    null,
  )
  if (source == null) return rows
  return [...rows, ...rows.filter((row) => row.cycle === source).map((row) => ({ ...row, cycle: current }))]
}

// Writes only the `(categoryId, current)` row; `null` writes a "no budget" marker.
export function setBudget(rows: BudgetRow[], categoryId: string, amount: number | null, current: LocalDate): BudgetRow[] {
  const others = rows.filter((row) => !(row.categoryId === categoryId && row.cycle === current))
  return [...others, { categoryId, cycle: current, amount }]
}

export function dropCategory(rows: BudgetRow[], categoryId: string): BudgetRow[] {
  return rows.filter((row) => row.categoryId !== categoryId)
}

// `null` for a marker and for a missing row alike.
export function budgetFor(rows: BudgetRow[], categoryId: string, cycle: LocalDate): number | null {
  return rows.find((row) => row.categoryId === categoryId && row.cycle === cycle)?.amount ?? null
}
