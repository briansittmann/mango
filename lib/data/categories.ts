import type { CategoryColor } from './dashboard'

export type CategoryDraft = {
  name: string // trimmed, non-empty
  color: CategoryColor
  budget: number | null // > 0 with at most two decimals, or null for no budget
}

/**
 * Four operations, injected by the page, that every data source implements with the same
 * inputs and outcomes:
 * - each operation resolves once the change is durable, and rejects with nothing changed
 * - `create` adds a category with no expenses, a total of 0, and a stored order placing it
 *   after every existing category. It resolves with the new category's id, so the caller can
 *   tell the new card apart from the others.
 * - `update` writes the category's name, colour and budget; `budget: null` removes the
 *   budget. It never touches expenses or another category.
 * - `delete` moves every expense in every cycle to `reassignTo` and takes the category's
 *   budget row with it. `reassignTo` is `null` only when the category has no expenses.
 * - `reorder` writes the stored order of every category at once. See below.
 *
 * `create` and `update` reject with `DUPLICATE_CATEGORY_NAME` on a name already used by
 * another of the user's categories, comparing trimmed and case-insensitively.
 */
export type CategoryMutations = {
  create(draft: CategoryDraft): Promise<string>
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
