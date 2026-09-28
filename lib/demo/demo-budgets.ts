import type { BudgetRow } from '@/lib/data/budget'
import type { LocalDate } from '@/lib/data/expenses'

// The demo's in-memory `presupuestos`, following the rules on `BudgetRow`. Only type imports
// from `@/`, so Node's test runner can load this file directly.

// When `current` holds no row (markers count), copy every row of the most recent earlier cycle
// that holds any. Called with a projected cycle, this is its materialisation before an edit.
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

// A budget edit from the displayed `cycle`, as `actualizar_categoria` (0022) does it. From the
// current cycle or a past one it writes the current cycle only. From a projected one it first
// materialises that cycle; with `'only'` it also materialises `following` (the next cycle's
// start) when it holds no row, with a marker for this category if it had nothing to inherit,
// so the edit does not carry over. A projected cycle without a scope (a rename) changes nothing.
export function setBudgetInCycle(
  rows: BudgetRow[],
  categoryId: string,
  amount: number | null,
  {
    current,
    cycle,
    following,
    scope,
  }: { current: LocalDate; cycle: LocalDate; following: LocalDate; scope: 'only' | 'onward' | null },
): BudgetRow[] {
  const withCurrent = copyForward(rows, current)
  if (cycle <= current) return setBudget(withCurrent, categoryId, amount, current)
  if (scope == null) return withCurrent

  let next = copyForward(withCurrent, cycle)
  if (scope === 'only' && !next.some((row) => row.cycle === following)) {
    const inherited = next.filter((row) => row.cycle === cycle).map((row) => ({ ...row, cycle: following }))
    next = [...next, ...inherited]
    if (!inherited.some((row) => row.categoryId === categoryId)) next.push({ categoryId, cycle: following, amount: null })
  }
  return setBudget(next, categoryId, amount, cycle)
}

export function dropCategory(rows: BudgetRow[], categoryId: string): BudgetRow[] {
  return rows.filter((row) => row.categoryId !== categoryId)
}

// A delete "from this month on" (0024): the category's rows of `cycle` and later go, earlier
// cycles keep theirs.
export function dropCategoryFrom(rows: BudgetRow[], categoryId: string, cycle: LocalDate): BudgetRow[] {
  return rows.filter((row) => !(row.categoryId === categoryId && row.cycle >= cycle))
}

// `null` for a marker and for a missing row alike.
export function budgetFor(rows: BudgetRow[], categoryId: string, cycle: LocalDate): number | null {
  return rows.find((row) => row.categoryId === categoryId && row.cycle === cycle)?.amount ?? null
}
