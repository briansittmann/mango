import type { CategoryColor, ExpenseGroup } from './dashboard'
import type { RecurringDefinition } from './recurring'

/** A card the user pays fixed charges with (`card-wallet`): a name and a colour, nothing sensitive. */
export type Card = { id: string; name: string; color: CategoryColor }

export type CardDraft = {
  name: string // trimmed, 1-30 characters
  color: CategoryColor
}

/**
 * Four operations, injected by the page, that every data source implements with the same inputs
 * and outcomes:
 * - each operation resolves once the change is durable, and rejects with nothing changed
 * - `create` resolves with the new card's id, so the card sheet can save its checklist in the
 *   same "Guardar" (design D7; the one contract whose `create` returns something besides
 *   categories')
 * - `delete` removes the card; every fixed charge that carried it is left with no card
 * - `setFixedCharges` takes the full list of expense definitions the card carries: afterwards
 *   exactly those carry it, each listed one moved from whatever card it had, each unlisted one
 *   that carried it left with none — all or nothing
 *
 * `create` and `update` reject with `DUPLICATE_CARD_NAME` on a name already used by another of
 * the user's cards, comparing trimmed and case-insensitively.
 */
export type CardMutations = {
  create(draft: CardDraft): Promise<string>
  update(cardId: string, draft: CardDraft): Promise<void>
  delete(cardId: string): Promise<void>
  setFixedCharges(cardId: string, definitionIds: string[]): Promise<void>
}

/** `create` and `update` reject with an Error carrying this message when the name is taken. */
export const DUPLICATE_CARD_NAME = 'duplicate-card-name'

/**
 * Each card's committed total in the shown cycle (design D4): the amounts of the shown fixed
 * expense rows whose definition carries the card, and how many there are. Reading the shown rows
 * is what makes projected charges, a "solo este mes" amount and a deleted slot come out right;
 * income is never in `groups`. A card with no rows is absent from the map.
 */
export function committedByCard(
  groups: ExpenseGroup[],
  definitions: Pick<RecurringDefinition, 'id' | 'cardId'>[],
): Map<string, { total: number; count: number }> {
  const cardOf = new Map(definitions.map((d) => [d.id, d.cardId]))
  const totals = new Map<string, { total: number; count: number }>()
  for (const group of groups) {
    for (const expense of group.expenses) {
      const cardId = expense.fixed && cardOf.get(expense.fixed.definitionId)
      if (!cardId) continue
      const current = totals.get(cardId) ?? { total: 0, count: 0 }
      totals.set(cardId, { total: Math.round((current.total + expense.amount) * 100) / 100, count: current.count + 1 })
    }
  }
  return totals
}
