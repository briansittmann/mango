import type { CategoryColor } from './dashboard'
import type { LocalDate } from './expenses'

/** The palette, in picker order. The sheet and the bot take the first one no category uses. */
export const CATEGORY_COLORS: CategoryColor[] = [
  'granate',
  'rojo',
  'coral',
  'rosa',
  'naranja_calido',
  'violeta_metalico',
  'azul_electrico',
  'azul_apagado',
  'celeste',
  'turquesa',
  'verde_menta',
  'verde_profundo',
  'gris_calido',
  'gris_oscuro',
  'blanco',
]

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
 * Where `delete` reaches: `cycle` is the displayed cycle's first day. `'only'` hides the category
 * in that cycle alone; `'onward'` ends it at the cycle before, or removes it entirely when `cycle`
 * is its first cycle. No scope reaches an earlier cycle (`category-editing` → *Deleting a category*).
 */
export type CategoryDeleteTarget = { cycle: LocalDate; scope: 'only' | 'onward' }

/**
 * Five operations, injected by the page, that every data source implements with the same
 * inputs and outcomes:
 * - each operation resolves once the change is durable, and rejects with nothing changed
 * - `create` adds a category with no expenses, a total of 0, and a stored order placing it
 *   after every existing category, alive from `cycle` on (the displayed cycle; a past one means
 *   the cycle in progress). It resolves with the new category's id, so the caller can tell the
 *   new card apart from the others. A budget writes `cycle`'s `BudgetRow` as an "onward" edit
 *   does; no budget writes no row. With `'only'` the category also ends in `cycle`: it lives in
 *   that one cycle, as one deleted "onward" from the next would.
 * - `update` writes the category's name, colour and budget. In the current cycle (or from a
 *   past one) the budget goes to the current cycle's `BudgetRow` only. In a projected cycle it
 *   first writes every row that cycle inherits when it holds none, then that cycle's row; with
 *   `'only'` the following cycle, when it holds no row, keeps what it inherited before the edit
 *   (`category-editing` → *Budgets belong to one cycle*). `budget: null` writes a "no budget"
 *   marker instead of deleting; earlier cycles never change. It never touches expenses or
 *   another category.
 * - `delete` with `'only'` moves the category's rows of `cycle` to `reassignTo` (its definitions'
 *   charges of that cycle as that cycle's slot) and hides it there; with `'onward'` it moves the
 *   rows of `cycle` and later, and every definition, to `reassignTo`, removes its `BudgetRow`s of
 *   those cycles and ends it at the cycle before. `reassignTo` is `null` only when the scope
 *   reaches no row (and, for `'onward'`, no definition).
 * - `setProgressVisible` stores whether the category's card shows its budget bar, the same in
 *   every cycle. It changes no budget and no figure.
 * - `reorder` writes the stored order of every category at once. See below.
 *
 * `create` and `update` reject with `DUPLICATE_CATEGORY_NAME` on a name already used by
 * another of the user's categories, comparing trimmed and case-insensitively.
 */
export type CategoryMutations = {
  create(draft: CategoryDraft, cycle: LocalDate, scope: 'only' | 'onward'): Promise<string>
  update(categoryId: string, draft: CategoryDraft, target: CategoryUpdateTarget): Promise<void>
  delete(categoryId: string, reassignTo: string | null, target: CategoryDeleteTarget): Promise<void>
  setProgressVisible(categoryId: string, visible: boolean): Promise<void>
  /**
   * The complete list of the user's category ids in their new order — never a single moved
   * id and never a pair of positions. Sending the same list twice has the same result as
   * sending it once. Resolves once the order is durable; rejects with the stored order
   * unchanged, and rejects a list that omits an id, repeats one, or names one the user does
   * not own, applying no part of it.
   */
  reorder(categoryIds: string[]): Promise<void>
}

/**
 * A category's lifetime (`category-editing` → *A category lives from its first cycle to its
 * last*): first and last cycle start, `null` for "since always" and "not ended", and the cycles
 * a delete "only this month" hid it in. `categorias.desde_ciclo`, `hasta_ciclo` and
 * `categorias_ocultas` in Supabase (0024).
 */
export type CategoryLifetime = { from: LocalDate | null; until: LocalDate | null; hidden: LocalDate[] }

/** Whether a category is shown, and can hold rows, in the cycle starting on `cycle`. */
export function categoriaViva({ from, until, hidden }: CategoryLifetime, cycle: LocalDate): boolean {
  return (from == null || from <= cycle) && (until == null || cycle <= until) && !hidden.includes(cycle)
}

/** `update` rejects with an Error carrying this message when the name is taken. */
export const DUPLICATE_CATEGORY_NAME = 'duplicate-category-name'
