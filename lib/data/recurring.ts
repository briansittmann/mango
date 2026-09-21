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
 *   definition is still pending, it reconciles too — a new expected amount rewrites the
 *   pending charge; a charge already confirmed is what was really paid and is left alone.
 * - `stop` only sets `active` to false. It never touches an amount, this cycle's charge, or
 *   any other field, and asks no confirmation because it is reversible in effect (a stopped
 *   definition simply produces no more charges).
 * - `delete` removes the definition and the charges it produced, in every cycle.
 */
export type RecurringMutations = {
  create(target: RecurringTarget, draft: RecurringDraft): Promise<void>
  update(definitionId: string, draft: RecurringDraft): Promise<void>
  stop(definitionId: string): Promise<void>
  delete(definitionId: string): Promise<void>
}
