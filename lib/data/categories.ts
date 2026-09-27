import type { CategoryColor } from './dashboard'
import type { LocalDate } from './expenses'

export type CategoryDraft = {
  name: string // trimmed, non-empty
  color: CategoryColor
  budget: number | null // > 0 with at most two decimals, or null for no budget
}

/**
 * Where `update` writes the budget: `cycle` is the displayed cycle's first day; `scope` is the
 * sheet's choice for a projected cycle ("solo este mes" → `'only'`, "desde este mes en
 * adelante" → `'onward'`), and `null` everywhere else. A projected cycle with `scope: null` (only
 * the name or colour changed) leaves every budget as it is.
 */
export type CategoryUpdateTarget = { cycle: LocalDate; scope: 'only' | 'onward' | null }

/**
 * Four operations, injected by the page, that every data source implements with the same
 * inputs and outcomes:
 * - each operation resolves once the change is durable, and rejects with nothing changed
 * - `create` adds a category with no expenses, a total of 0, and a stored order placing it
 *   after every existing category. It resolves with the new category's id, so the caller can
 *   tell the new card apart from the others. A budget writes the current cycle's `BudgetRow`
 *   only; no budget writes no row.
 * - `update` writes the category's name, colour and budget. In the current cycle (or from a
 *   past one) the budget goes to the current cycle's `BudgetRow` only. In a projected cycle it
 *   first writes every row that cycle inherits when it holds none, then that cycle's row; with
 *   `'only'` the following cycle, when it holds no row, keeps what it inherited before the edit
 *   (`category-editing` → *Budgets belong to one cycle*). `budget: null` writes a "no budget"
 *   marker instead of deleting; earlier cycles never change. It never touches expenses or
 *   another category.
 * - `delete` moves every expense in every cycle to `reassignTo` and removes the category's
 *   `BudgetRow`s in every cycle. `reassignTo` is `null` only when the category has no expenses.
 * - `reorder` writes the stored order of every category at once. See below.
 *
 * `create` and `update` reject with `DUPLICATE_CATEGORY_NAME` on a name already used by
 * another of the user's categories, comparing trimmed and case-insensitively.
 */
export type CategoryMutations = {
  create(draft: CategoryDraft): Promise<string>
  update(categoryId: string, draft: CategoryDraft, target: CategoryUpdateTarget): Promise<void>
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
