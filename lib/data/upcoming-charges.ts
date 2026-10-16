import type { CategoryColor, ExpenseGroup } from '@/lib/data/dashboard'
import type { Card } from '@/lib/data/cards'
import type { RecurringDefinition } from '@/lib/data/recurring'

export type UpcomingCharge = {
  id: string
  name: string
  /** The category's name, for the row's muted line. */
  category: string
  day: number
  amount: number
  color: CategoryColor
  charged: boolean
  definitionId: string
  /** The definition's amount, carried on the charge so an "esperado" caption is a comparison of two fields on one object. */
  expectedAmount: number
  progress: { done: number; total: number } | null
  /** The card the definition is charged to (`card-wallet`), resolved here so the row does no lookups. */
  card: { name: string; color: CategoryColor } | null
}

export function selectUpcomingCharges(groups: ExpenseGroup[], definitions: RecurringDefinition[], cards: Card[] = []): UpcomingCharge[] {
  const definitionById = new Map(definitions.map((definition) => [definition.id, definition]))
  const cardById = new Map(cards.map((card) => [card.id, card]))

  const charges = groups.flatMap((group) =>
    group.expenses
      .filter((expense) => expense.fixed != null)
      .map((expense) => {
        const fixed = expense.fixed!
        // A definition can be missing (deleted out from under a stale reference, or not yet
        // supplied) — the charge still lists, just with nothing to compare it against.
        const definition = definitionById.get(fixed.definitionId)
        const card = definition?.cardId ? cardById.get(definition.cardId) : undefined
        return {
          id: expense.id,
          name: expense.name,
          category: group.name,
          day: fixed.day,
          amount: expense.amount,
          color: group.color,
          charged: fixed.charged,
          definitionId: fixed.definitionId,
          expectedAmount: definition?.expectedAmount ?? expense.amount,
          progress: definition?.repetitions ? { ...definition.repetitions } : null,
          card: card ? { name: card.name, color: card.color } : null,
        }
      }),
  )

  // The card splits pending from taken itself; here only the day orders them (stable on ties).
  return charges.sort((a, b) => a.day - b.day)
}
