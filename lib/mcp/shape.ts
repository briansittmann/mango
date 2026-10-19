import type { CategoryColor, DashboardData } from '../data/dashboard.ts'
import type { PaymentMethod } from '../data/payment-method.ts'
import type { RecurringDefinition } from '../data/recurring.ts'
import { committedByCard } from '../data/cards.ts'
import { localDayOf } from '../data/weekly-spend.ts'

// `DashboardData` as the read tools return it (`mcp-server` → *Reading the account*, add-mcp-server
// D5): the dashboard's own figures, renamed to snake_case English, amounts to two decimals and
// dates to the account's local day. Pure.

export type MovementKind = 'expense' | 'income' | 'savings' | 'transfer'

export type MovementOut = {
  id: string
  kind: MovementKind
  description: string
  amount: number
  date: string
  cycle_month: string
  category?: { id: string; name: string }
  payment_method?: PaymentMethod | null
  direction?: 'deposit' | 'withdrawal'
  already_saved?: boolean
  into?: PaymentMethod
  fixed?: { definition_id: string; charged: boolean; projected: boolean }
}

export const round2 = (n: number) => Math.round(n * 100) / 100

function cycleOf(data: DashboardData) {
  return { month: data.cycle.month, start: data.cycle.start, end: data.cycle.end, in_progress: data.cycle.inProgress, projected: data.cycle.projected }
}

export function summaryOf(data: DashboardData, definitions: RecurringDefinition[]) {
  const committed = committedByCard(data.expenses.groups, definitions)
  return {
    currency: data.user.currency,
    cycle: cycleOf(data),
    income_total: round2(data.income.total),
    expenses_total: round2(data.expenses.total),
    savings: { cycle: round2(data.savings.cycle), accumulated: round2(data.savings.accumulated) },
    free_margin: round2(data.freeMargin),
    categories: data.expenses.groups.map((group) => ({
      id: group.id,
      name: group.name,
      color: group.color,
      total: round2(group.total),
      budget: group.budget
        ? { amount: round2(group.budget.amount), spent: round2(group.budget.spent), remaining: round2(group.budget.remaining) }
        : null,
      show_progress: group.showProgress,
    })),
    cards: data.cards.map((card) => ({
      id: card.id,
      name: card.name,
      color: card.color,
      committed_total: round2(committed.get(card.id)?.total ?? 0),
      fixed_charges: definitions.filter((d) => d.cardId === card.id && d.active).length,
    })),
    ...(data.pockets
      ? {
          pockets: Object.fromEntries(
            (['efectivo', 'tarjeta'] as const).map((method) => {
              const pocket = data.pockets![method]
              return [method, { balance: round2(pocket.balance), came_in: round2(pocket.cameIn), went_out: round2(pocket.wentOut) }]
            }),
          ),
        }
      : {}),
  }
}

/** Every row the cycle shows, newest first; `kind` keeps only one kind. */
export function movementsOf(data: DashboardData, kind?: MovementKind) {
  const tz = data.user.timezone
  const month = data.cycle.month
  const rows: MovementOut[] = []
  for (const group of data.expenses.groups) {
    for (const expense of group.expenses) {
      rows.push({
        id: expense.id,
        kind: 'expense',
        description: expense.name,
        amount: round2(expense.amount),
        date: localDayOf(expense.date, tz),
        cycle_month: month,
        category: { id: group.id, name: group.name },
        payment_method: expense.paymentMethod,
        ...(expense.fixed
          ? { fixed: { definition_id: expense.fixed.definitionId, charged: expense.fixed.charged, projected: expense.projected === true } }
          : {}),
      })
    }
  }
  for (const entry of data.income.entries) {
    rows.push({
      id: entry.id,
      kind: 'income',
      description: entry.name,
      amount: round2(entry.amount),
      date: localDayOf(entry.date, tz),
      cycle_month: month,
      payment_method: entry.paymentMethod,
      ...(entry.recurring
        ? { fixed: { definition_id: entry.recurring.definitionId, charged: entry.recurring.charged, projected: entry.projected === true } }
        : {}),
    })
  }
  for (const movement of data.savings.movements) {
    rows.push({
      id: movement.id,
      kind: 'savings',
      description: movement.name,
      amount: round2(Math.abs(movement.amount)),
      date: localDayOf(movement.date, tz),
      cycle_month: month,
      direction: movement.amount < 0 ? 'withdrawal' : 'deposit',
      ...(movement.amount > 0 ? { already_saved: movement.alreadySaved === true } : {}),
    })
  }
  for (const transfer of data.pockets?.transfers ?? []) {
    rows.push({
      id: transfer.id,
      kind: 'transfer',
      description: transfer.into === 'efectivo' ? 'Card to cash' : 'Cash to card',
      amount: round2(transfer.amount),
      date: localDayOf(transfer.date, tz),
      cycle_month: month,
      into: transfer.into,
    })
  }
  const shown = kind ? rows.filter((row) => row.kind === kind) : rows
  // Newest first; a stable order within a day, so two calls list the same way.
  shown.sort((a, b) => (a.date === b.date ? a.id.localeCompare(b.id) : a.date < b.date ? 1 : -1))
  return { currency: data.user.currency, cycle: cycleOf(data), movements: shown }
}

/**
 * Every definition, active and stopped, with its row in the shown cycle: the row the dashboard
 * shows, `deleted` when that month's slot was deleted ("solo este mes"), or null when it has none.
 */
export function fixedChargesOf(data: DashboardData, definitions: RecurringDefinition[], deletedThisMonth: ReadonlySet<string>) {
  const tz = data.user.timezone
  const categoryName = new Map(data.expenses.groups.map((g) => [g.id, g.name]))
  const cardOf = new Map(data.cards.map((c) => [c.id, c]))
  type Row = { id: string; name: string; amount: number; date: string; categoryId: string | null; paymentMethod: PaymentMethod | null; charged: boolean; projected: boolean }
  const rowOf = new Map<string, Row>()
  for (const group of data.expenses.groups) {
    for (const e of group.expenses) {
      if (e.fixed) {
        rowOf.set(e.fixed.definitionId, { id: e.id, name: e.name, amount: e.amount, date: e.date, categoryId: group.id, paymentMethod: e.paymentMethod, charged: e.fixed.charged, projected: e.projected === true })
      }
    }
  }
  for (const e of data.income.entries) {
    if (e.recurring) {
      rowOf.set(e.recurring.definitionId, { id: e.id, name: e.name, amount: e.amount, date: e.date, categoryId: null, paymentMethod: e.paymentMethod, charged: e.recurring.charged, projected: e.projected === true })
    }
  }
  return {
    currency: data.user.currency,
    cycle: cycleOf(data),
    fixed_charges: definitions.map((d) => {
      const row = rowOf.get(d.id)
      const card = d.cardId ? cardOf.get(d.cardId) : undefined
      return {
        id: d.id,
        kind: d.tipo === 'gasto' ? ('expense' as const) : ('income' as const),
        name: d.name,
        expected_amount: round2(d.expectedAmount),
        day: d.day,
        category: d.categoryId ? { id: d.categoryId, name: categoryName.get(d.categoryId) ?? null } : null,
        card: card ? { id: card.id, name: card.name, color: card.color as CategoryColor } : null,
        payment_method: d.paymentMethod,
        reminder_days_before: d.tipo === 'gasto' && d.reminder.active ? d.reminder.daysBefore : null,
        repetitions: d.repetitions,
        active: d.active,
        this_month: row
          ? {
              id: row.id,
              name: row.name,
              amount: round2(row.amount),
              date: localDayOf(row.date, tz),
              category_id: row.categoryId,
              payment_method: row.paymentMethod,
              charged: row.charged,
              projected: row.projected,
              deleted: false,
            }
          : deletedThisMonth.has(d.id)
            ? { deleted: true }
            : null,
      }
    }),
  }
}
