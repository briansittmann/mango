import type { Expense, ExpenseGroup } from './dashboard.ts'
import type { LocalDate } from './expenses.ts'
import type { IncomeEntry } from './income.ts'
import { localDayOf } from './weekly-spend.ts'

// How a movement was paid, the two pockets it moves and the transfers between them
// (`payment-method`, design D3, D4). Pure, shared by the demo and the real dashboard.

/** = check in supabase/migrations/0041_medio_de_pago.sql; `null` everywhere means "sin decir". */
export type PaymentMethod = 'efectivo' | 'tarjeta'

export const PAYMENT_METHODS: readonly PaymentMethod[] = ['efectivo', 'tarjeta']

/** Where cash is used every day: the feature is offered there unless the admin says otherwise (D14). */
export const PAYMENT_METHOD_COUNTRIES: readonly string[] = ['AR', 'UY', 'MX', 'CO']

/**
 * Whether an account is offered the feature (`payment-method` → *The feature is offered by
 * country*): the admin's switch (`usuarios.medio_pago_habilitado`, 0042) when set, else its country.
 */
export function paymentMethodsOffered(country: string | null | undefined, adminSwitch: boolean | null | undefined): boolean {
  if (adminSwitch != null) return adminSwitch
  return country != null && PAYMENT_METHOD_COUNTRIES.includes(country)
}

/** `into` is the pocket the money enters; the other one is where it leaves from. */
export type TransferDraft = { amount: number; into: PaymentMethod; date: LocalDate }

/**
 * Four operations, injected by the page, that every data source implements with the same inputs
 * and outcomes: each resolves once the change is durable and rejects with nothing changed; an id
 * of another account's row, or of a row that is not a transfer, rejects.
 */
export type TransferMutations = {
  create(draft: TransferDraft): Promise<void>
  update(transferId: string, draft: TransferDraft): Promise<void>
  softDelete(transferId: string): Promise<void>
  restore(transferId: string): Promise<void>
}

export type Pocket = { balance: number; cameIn: number; wentOut: number }

/** `date` is the stored instant, like an expense's. */
export type Transfer = { id: string; amount: number; into: PaymentMethod; date: string }

export type Pockets = Record<PaymentMethod, Pocket> & { transfers: Transfer[] }

/**
 * An expense or income row as the balance counts it. `charged` is present only on a recurring
 * charge: the dashboard's own rule (confirmed, or its day passed and not marked `no_cobrado`).
 */
export type CountedRow = {
  kind: 'expense' | 'income'
  amount: number
  date: string
  paymentMethod: PaymentMethod | null
  charged?: boolean
  projected?: true
  deleted?: true
}

export function otherPocket(method: PaymentMethod): PaymentMethod {
  return method === 'efectivo' ? 'tarjeta' : 'efectivo'
}

/** Whether a row has happened as of `today` (`payment-method` → *A pocket's balance*). */
function happened(row: { date: string; charged?: boolean }, today: LocalDate, timeZone: string): boolean {
  return row.charged ?? localDayOf(row.date, timeZone) <= today
}

function counts(row: CountedRow, today: LocalDate, timeZone: string): boolean {
  return row.paymentMethod != null && !row.projected && !row.deleted && happened(row, today, timeZone)
}

/**
 * Each pocket's balance over every row it is given (the caller passes every marked row up to the
 * shown cycle's end) and, for the shown cycle only, what came in and what went out. Income adds,
 * an expense subtracts, a transfer adds to `into` and subtracts from the other. No opening
 * balance: a pocket starts at 0 and may go negative (D5). `cycle.today` is clamped into the cycle.
 */
export function pocketBalances({
  rows,
  transfers,
  cycle,
  timeZone,
}: {
  rows: CountedRow[]
  transfers: Transfer[]
  cycle: { start: LocalDate; end: LocalDate; today: LocalDate }
  timeZone: string
}): Record<PaymentMethod, Pocket> {
  const pockets: Record<PaymentMethod, Pocket> = {
    efectivo: { balance: 0, cameIn: 0, wentOut: 0 },
    tarjeta: { balance: 0, cameIn: 0, wentOut: 0 },
  }
  const inCycle = (date: string) => {
    const day = localDayOf(date, timeZone)
    return day >= cycle.start && day <= cycle.end
  }
  const move = (method: PaymentMethod, amount: number, date: string) => {
    const pocket = pockets[method]
    pocket.balance += amount
    if (!inCycle(date)) return
    if (amount > 0) pocket.cameIn += amount
    else pocket.wentOut -= amount
  }
  for (const row of rows) {
    if (!counts(row, cycle.today, timeZone)) continue
    move(row.paymentMethod!, row.kind === 'income' ? row.amount : -row.amount, row.date)
  }
  for (const transfer of transfers) {
    if (!happened(transfer, cycle.today, timeZone)) continue
    move(transfer.into, transfer.amount, transfer.date)
    move(otherPocket(transfer.into), -transfer.amount, transfer.date)
  }
  return pockets
}

/** The shown cycle's expense and income rows as `pocketBalances` counts them. */
export function countedRows(groups: ExpenseGroup[], entries: IncomeEntry[]): CountedRow[] {
  return [
    ...groups.flatMap((group) =>
      group.expenses.map(
        (expense): CountedRow => ({
          kind: 'expense',
          amount: expense.amount,
          date: expense.date,
          paymentMethod: expense.paymentMethod,
          ...(expense.fixed ? { charged: expense.fixed.charged } : {}),
          ...(expense.projected ? { projected: true as const } : {}),
        }),
      ),
    ),
    ...entries.map(
      (entry): CountedRow => ({
        kind: 'income',
        amount: entry.amount,
        date: entry.date,
        paymentMethod: entry.paymentMethod,
        ...(entry.recurring ? { charged: entry.recurring.charged } : {}),
        ...(entry.projected ? { projected: true as const } : {}),
      }),
    ),
  ]
}

export type PocketRow =
  | { key: string; kind: 'expense'; date: string; group: ExpenseGroup; expense: Expense }
  | { key: string; kind: 'income'; date: string; entry: IncomeEntry }
  | { key: string; kind: 'transfer'; date: string; transfer: Transfer }

/**
 * The pocket list (`payment-method` → *The pocket list*, D8): the shown cycle's rows that count
 * for `method` — its expenses and income, and every transfer — newest first.
 */
export function pocketRows({
  method,
  groups,
  entries,
  transfers,
  today,
  timeZone,
}: {
  method: PaymentMethod
  groups: ExpenseGroup[]
  entries: IncomeEntry[]
  transfers: Transfer[]
  today: LocalDate
  timeZone: string
}): PocketRow[] {
  const rows: PocketRow[] = []
  for (const group of groups) {
    for (const expense of group.expenses) {
      const [counted] = countedRows([{ ...group, expenses: [expense] }], [])
      if (expense.paymentMethod === method && counts(counted, today, timeZone)) {
        rows.push({ key: `expense:${expense.id}`, kind: 'expense', date: expense.date, group, expense })
      }
    }
  }
  for (const entry of entries) {
    const [counted] = countedRows([], [entry])
    if (entry.paymentMethod === method && counts(counted, today, timeZone)) {
      rows.push({ key: `income:${entry.id}`, kind: 'income', date: entry.date, entry })
    }
  }
  for (const transfer of transfers) {
    if (happened(transfer, today, timeZone)) rows.push({ key: `transfer:${transfer.id}`, kind: 'transfer', date: transfer.date, transfer })
  }
  return rows.sort((a, b) => Date.parse(b.date) - Date.parse(a.date))
}
