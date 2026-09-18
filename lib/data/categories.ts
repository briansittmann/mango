import type { CategoryColor } from './dashboard'

export type CategoryDraft = {
  name: string // trimmed, non-empty
  color: CategoryColor
  budget: number | null // > 0 with at most two decimals, or null for no budget
}

/**
 * Three operations, injected by the page, that every data source implements with the same
 * inputs and outcomes:
 * - each operation resolves once the change is durable, and rejects with nothing changed
 * - `update` writes the category's name, colour and budget; `budget: null` removes the
 *   budget. It never touches expenses or another category.
 * - `delete` moves every expense in every cycle to `reassignTo` and takes the category's
 *   budget row with it. `reassignTo` is `null` only when the category has no expenses.
 * - `reorder` writes the stored order of every category at once. See below.
 */
export type CategoryMutations = {
  update(categoryId: string, draft: CategoryDraft): Promise<void>
  delete(categoryId: string, reassignTo: string | null): Promise<void>
  /**
   * The complete list of the user's category ids in their new order — never a single moved
   * id and never a pair of positions. Sending the same list twice has the same result as
   * sending it once. Resolves once the order is durable; rejects with the stored order
   * unchanged, and rejects a list that omits an id, repeats one, or names one the user does
   * not own, applying no part of it.
   */
  reorder(categoryIds: string[]): Promise<void>
}

/** `update` rejects with an Error carrying this message when the name is taken. */
export const DUPLICATE_CATEGORY_NAME = 'duplicate-category-name'
