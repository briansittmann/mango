import type { ExpenseDraft } from './expenses'
import type { PaymentMethod } from './payment-method'

export type IncomeEntry = {
  id: string
  name: string
  amount: number
  date: string
  /** How it was received (`payment-method`); a projected entry carries its definition's. */
  paymentMethod: PaymentMethod | null
  /**
   * Present only on an entry generated from a recurring definition (§7): `movimientos_recurrentes.id`,
   * `.dia_del_mes`, and whether it shows as received (the same rule as an expense's `fixed.charged`).
   */
  recurring?: { definitionId: string; day: number; charged: boolean }
  /** An entry computed by `proyectarCiclo` for a projected cycle (id `proj:<definitionId>`), not a stored row: read-only (D3). */
  projected?: true
}

/** Same fields as an expense — amount, description, date, payment method — validated identically. */
export type IncomeDraft = ExpenseDraft

/**
 * Four operations, injected by the page, that every data source implements with the same
 * inputs and outcomes:
 * - each operation resolves once the change is durable, and rejects with nothing changed
 * - `update` writes only `amount`, `description`, `date` and the payment method — never the recurring definition
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
