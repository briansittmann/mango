import type { LocalDate } from './expenses'

export type RecurringDefinition = {
  id: string
  name: string
  expectedAmount: number
  tipo: 'gasto' | 'ingreso'
  /** Non-null iff `tipo` is `'gasto'` — an income definition has no category. */
  categoryId: string | null
  day: number
  active: boolean
  reminder: { active: boolean; daysBefore: number }
  /** `null` means "sin final". Non-null is an instalment plan: `done` out of `total`. */
  repetitions: { total: number; done: number } | null
}

/** What `RecurringMutations.create` moves: an expense with its category, or income with none. */
export type RecurringTarget = { tipo: 'gasto'; categoryId: string } | { tipo: 'ingreso' }

/**
 * What the recurrence toggle (create, via the entry sheet) and the definition sheet (update)
 * submit. `repetitions` is only chosen at creation — the definition sheet has no control for
 * it, so `update` receives the definition's current value unchanged.
 */
export type RecurringDraft = {
  name: string // trimmed, non-empty
  expectedAmount: number // > 0, at most two decimals
  day: number // 1-31
  reminder: { active: boolean; daysBefore: number } // daysBefore >= 0, meaningful only while active
  repetitions: number | null // total repetitions; null = "sin final"
}

/**
 * Four operations, injected by the page, typed like `ExpenseMutations`:
 * - each operation resolves once the change is durable, and rejects with nothing changed
 * - `create` takes a `RecurringTarget`, so a `'gasto'` definition always carries a category and
 *   an `'ingreso'` definition never can — the type carries the same rule the database's check
 *   constraint does (§7, migration 0015)
 * - `update` writes the definition's fields. While this cycle's charge produced by this
 *   definition is shown as pending — `estado` pending and its day not yet reached — a new
 *   expected amount rewrites it too; a charge confirmed, or whose day has passed, is what was
 *   really paid and is left alone. Pending charges of later cycles (written ahead by the slot
 *   operations) take the new amount as well.
 * - `stop` only sets `active` to false. It never touches an amount, this cycle's charge, or
 *   any other field, and asks no confirmation because it is reversible in effect (a stopped
 *   definition simply produces no more charges).
 * - `delete` removes the definition and the charges it produced, in every cycle.
 *
 * Three more act on the slot a definition holds in one cycle — `(movimiento_recurrente_id,
 * ciclo_mes)`, a soft-deleted row included — from a row of the entry sheet (`recurring-expenses`
 * → *A definition's slot in a cycle can be changed on its own*, `add-forward-scoped-edits` D1–D3).
 * `cycle` is the first day of the cycle the row is shown in, the one in progress or later:
 * - `editInCycle` with `'only'` writes that slot (the linked row, or a new pending one). With
 *   `'onward'` it first writes, for every cycle between the one in progress and `cycle` holding
 *   no slot, a pending row with what that cycle showed (`congelarCiclos`); then the definition's
 *   amount, day, name and category from `entry`; then every pending slot of `cycle` and later.
 * - `deleteInCycle` with `'only'` soft-deletes that slot (writing it soft-deleted when there is
 *   none), so nothing re-inserts it. With `'onward'` it freezes the cycles in between as above,
 *   soft-deletes the slots of `cycle` and later, and stops the definition.
 * - `restoreInCycle` clears the deletion mark of that slot: the undo of a swipe.
 * Rows of earlier cycles never change.
 */
export type RecurringMutations = {
  create(target: RecurringTarget, draft: RecurringDraft): Promise<void>
  update(definitionId: string, draft: RecurringDraft): Promise<void>
  stop(definitionId: string): Promise<void>
  delete(definitionId: string): Promise<void>
  editInCycle(definitionId: string, cycle: LocalDate, entry: SlotEntry, scope: 'only' | 'onward'): Promise<void>
  deleteInCycle(definitionId: string, cycle: LocalDate, scope: 'only' | 'onward'): Promise<void>
  restoreInCycle(definitionId: string, cycle: LocalDate): Promise<void>
}

/** A row of a definition as the entry sheet saves it; `categoryId` is `null` for income. */
export type SlotEntry = { amount: number; description: string; date: LocalDate; categoryId: string | null }
