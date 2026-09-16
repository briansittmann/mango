import type { CategoryColor } from './dashboard'

export type CategoryDraft = {
  name: string // trimmed, non-empty
  color: CategoryColor
  budget: number | null // > 0 with at most two decimals, or null for no budget
}

/**
 * Two operations, injected by the page, that every data source implements with the same
 * inputs and outcomes:
 * - each operation resolves once the change is durable, and rejects with nothing changed
 * - `update` writes the category's name, colour and budget; `budget: null` removes the
 *   budget. It never touches expenses or another category.
 * - `delete` moves every expense in every cycle to `reassignTo` and takes the category's
 *   budget row with it. `reassignTo` is `null` only when the category has no expenses.
 */
export type CategoryMutations = {
  update(categoryId: string, draft: CategoryDraft): Promise<void>
  delete(categoryId: string, reassignTo: string | null): Promise<void>
}

/** `update` rejects with an Error carrying this message when the name is taken. */
export const DUPLICATE_CATEGORY_NAME = 'duplicate-category-name'
