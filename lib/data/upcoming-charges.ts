import type { CategoryColor, ExpenseGroup } from '@/lib/data/dashboard'
import type { RecurringDefinition } from '@/lib/data/recurring'

export type UpcomingCharge = {
  id: string
  name: string
  day: number
  amount: number
  color: CategoryColor
  charged: boolean
  definitionId: string
  /** The definition's amount, carried on the charge so an "esperado" caption is a comparison of two fields on one object. */
  expectedAmount: number
  progress: { done: number; total: number } | null
}

export function selectUpcomingCharges(groups: ExpenseGroup[], definitions: RecurringDefinition[]): UpcomingCharge[] {
  const definitionById = new Map(definitions.map((definition) => [definition.id, definition]))

  const charges = groups.flatMap((group) =>
    group.expenses
      .filter((expense) => expense.fixed != null)
      .map((expense) => {
        const fixed = expense.fixed!
        // A definition can be missing (deleted out from under a stale reference, or not yet
        // supplied) — the charge still lists, just with nothing to compare it against.
        const definition = definitionById.get(fixed.definitionId)
        return {
          id: expense.id,
          name: expense.name,
          day: fixed.day,
          amount: expense.amount,
          color: group.color,
          charged: fixed.charged,
          definitionId: fixed.definitionId,
          expectedAmount: definition?.expectedAmount ?? expense.amount,
          progress: definition?.repetitions ? { ...definition.repetitions } : null,
        }
      }),
  )

  return charges.sort((a, b) => {
    if (a.charged !== b.charged) return a.charged ? -1 : 1
    return a.day - b.day
  })
}
