import { CATEGORY_COLORS } from '../data/categories.ts'
import type { CategoryColor } from '../data/dashboard.ts'
import type { ExpenseDraft, LocalDate } from '../data/expenses.ts'
import type { PaymentMethod, TransferDraft } from '../data/payment-method.ts'
import type { SavingsMovementDraft } from '../data/savings.ts'
import { McpToolError } from './errors.ts'

// Tool inputs (snake_case English) to the drafts the contracts take (add-mcp-server D5). Pure.

export type Scope = 'only_this_month' | 'from_this_month'
export type MovementKind = 'expense' | 'income' | 'savings' | 'transfer'

export function toScope(scope: Scope): 'only' | 'onward' {
  return scope === 'only_this_month' ? 'only' : 'onward'
}

/** Whether an amount has at most two decimals (12.5 and 0.29 pass, 1.005 does not). */
export function hasCents(n: number): boolean {
  return Math.abs(Math.round(n * 100) - n * 100) < 1e-6
}

/** The fields a movement tool accepts; which ones apply depends on the kind. */
export type MovementFields = {
  amount?: number
  description?: string
  date?: LocalDate
  category_id?: string
  payment_method?: PaymentMethod | null
  direction?: 'deposit' | 'withdrawal'
  already_saved?: boolean
  into?: PaymentMethod
}

export type MovementPlan =
  | { kind: 'expense'; categoryId: string; draft: ExpenseDraft }
  | { kind: 'income'; draft: ExpenseDraft }
  | { kind: 'savings'; draft: SavingsMovementDraft }
  | { kind: 'transfer'; draft: TransferDraft }

const APPLIES: Record<MovementKind, (keyof MovementFields)[]> = {
  expense: ['amount', 'description', 'date', 'category_id', 'payment_method'],
  income: ['amount', 'description', 'date', 'payment_method'],
  savings: ['amount', 'description', 'date', 'direction', 'already_saved'],
  transfer: ['amount', 'date', 'into'],
}

function invalid(message: string): never {
  throw new McpToolError('invalid-input', message)
}

function onlyApplicable(kind: MovementKind, fields: MovementFields) {
  for (const key of Object.keys(fields) as (keyof MovementFields)[]) {
    if (fields[key] !== undefined && !APPLIES[kind].includes(key)) invalid(`${key} does not apply to a ${kind}.`)
  }
}

/**
 * The payment-method gate (`payment-method` → *The feature is offered by country*): an account
 * not offered the feature can name no method and make no transfer.
 */
export function checkPaymentMethods(offered: boolean, kind: MovementKind, fields: MovementFields) {
  if (offered) return
  if (kind === 'transfer' || fields.payment_method != null || fields.into != null) {
    throw new McpToolError('payment-methods-not-offered', 'This account does not use cash/card payment methods, so it takes neither a payment_method nor transfers.')
  }
}

function build(kind: MovementKind, f: Required<Pick<MovementFields, 'amount' | 'date'>> & MovementFields): MovementPlan {
  if (!(f.amount > 0) || !hasCents(f.amount)) invalid('amount must be greater than 0, with at most two decimals.')
  const description = (f.description ?? '').trim()
  switch (kind) {
    case 'expense':
      if (!f.category_id) invalid('An expense needs category_id.')
      return { kind, categoryId: f.category_id, draft: { amount: f.amount, description, date: f.date, paymentMethod: f.payment_method ?? null } }
    case 'income':
      return { kind, draft: { amount: f.amount, description, date: f.date, paymentMethod: f.payment_method ?? null } }
    case 'savings': {
      if (!description) invalid('A savings movement needs a description.')
      if (!f.direction) invalid('A savings movement needs direction: deposit or withdrawal.')
      if (f.direction === 'withdrawal' && f.already_saved) invalid('already_saved only applies to a deposit.')
      return {
        kind,
        draft: { kind: f.direction, name: description, amount: f.amount, date: f.date, alreadySaved: f.direction === 'deposit' && f.already_saved === true },
      }
    }
    case 'transfer':
      if (!f.into) invalid('A transfer needs into: efectivo (card to cash) or tarjeta (cash to card).')
      return { kind, draft: { amount: f.amount, into: f.into, date: f.date } }
  }
}

/** `add_movement`'s input to the contract call it makes; the date defaults to the local today. */
export function newMovement(kind: MovementKind, fields: MovementFields, today: LocalDate): MovementPlan {
  onlyApplicable(kind, fields)
  if (fields.amount == null) invalid('amount is required.')
  return build(kind, { ...fields, amount: fields.amount, date: fields.date ?? today })
}

/** A stored one-off row, as `update_movement` reads it before merging (`date` already local). */
export type StoredMovement = {
  kind: MovementKind
  amount: number
  description: string
  date: LocalDate
  categoryId: string | null
  paymentMethod: PaymentMethod | null
  alreadySaved: boolean
}

/**
 * `update_movement`'s partial input over the stored row: the contracts take whole drafts, so
 * every field not given keeps what was there (a savings row's sign is its direction).
 */
export function mergeMovement(stored: StoredMovement, patch: MovementFields): MovementPlan {
  onlyApplicable(stored.kind, patch)
  const given = Object.values(patch).some((value) => value !== undefined)
  if (!given) invalid('Give at least one field to change.')
  const direction = patch.direction ?? (stored.amount < 0 ? 'withdrawal' : 'deposit')
  return build(stored.kind, {
    amount: patch.amount ?? Math.abs(stored.amount),
    description: patch.description ?? stored.description,
    date: patch.date ?? stored.date,
    category_id: patch.category_id ?? stored.categoryId ?? undefined,
    payment_method: patch.payment_method === undefined ? stored.paymentMethod : patch.payment_method,
    direction,
    // Turning a deposit into a withdrawal drops the mark, as the sheet does.
    already_saved: direction === 'withdrawal' ? undefined : (patch.already_saved ?? stored.alreadySaved),
    into: patch.into ?? stored.paymentMethod ?? undefined,
  })
}

/** The first palette colour no category of the account uses, never the rainbow (as the onboarding). */
export function defaultColor(used: readonly CategoryColor[]): CategoryColor {
  const pickable = CATEGORY_COLORS.filter((color) => color !== 'arcoiris')
  return pickable.find((color) => !used.includes(color)) ?? pickable[used.length % pickable.length]
}

/**
 * The full order `reorder` takes: the categories `given` names (the ones shown in the cycle in
 * progress) fill the positions they held, in the new order; every other category keeps its own
 * position, so the same list writes the same order.
 */
export function reorderedIds(stored: readonly string[], given: readonly string[]): string[] {
  const moving = new Set(given)
  const next = [...given]
  return stored.map((id) => (moving.has(id) ? next.shift()! : id))
}
