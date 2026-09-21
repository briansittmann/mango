import type { ExpenseDraft } from './expenses'

export type IncomeEntry = {
  id: string
  name: string
  amount: number
  date: string
  /** Present only on an entry generated from a recurring definition (§7): `movimientos_recurrentes.id` and `.dia_del_mes`. */
  recurring?: { definitionId: string; day: number }
}

/** Same three fields as an expense — amount, description, date — validated identically. */
export type IncomeDraft = ExpenseDraft

/**
 * Four operations, injected by the page, that every data source implements with the same
 * inputs and outcomes:
 * - each operation resolves once the change is durable, and rejects with nothing changed
 * - `update` writes only `amount`, `description` and `date` — never the recurring definition
 *   an entry came from, or any other entry
 * - `softDelete` and `restore` only set or clear the deletion mark; neither ever removes a row
 * - no operation takes a category: an income entry has none
 */
export type IncomeMutations = {
  create(draft: IncomeDraft): Promise<void>
  update(entryId: string, draft: IncomeDraft): Promise<void>
  softDelete(entryId: string): Promise<void>
  restore(entryId: string): Promise<void>
}
