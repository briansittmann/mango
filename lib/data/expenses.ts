/** A calendar day in the user's time zone: 'YYYY-MM-DD'. */
export type LocalDate = string

export type ExpenseDraft = {
  amount: number // > 0, at most two decimals
  description: string // trimmed; '' means none
  date: LocalDate
}

/**
 * Four operations, injected by the page, that every data source implements with the same
 * inputs and outcomes:
 * - each operation resolves once the change is durable, and rejects with nothing changed
 * - `update` writes only `amount`, `description` and `date` — never the category, type,
 *   fixed flag or the recurring fixed-expense definition
 * - `softDelete` and `restore` only set or clear the deletion mark; neither ever removes a row
 */
export type ExpenseMutations = {
  create(categoryId: string, draft: ExpenseDraft): Promise<void>
  update(expenseId: string, draft: ExpenseDraft): Promise<void>
  softDelete(expenseId: string): Promise<void>
  restore(expenseId: string): Promise<void>
}
