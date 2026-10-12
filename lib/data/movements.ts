import type { DashboardData, Expense, ExpenseGroup } from './dashboard.ts'
import type { LocalDate } from './expenses.ts'
import type { IncomeEntry } from './income.ts'
import { addDays, localDayOf } from './weekly-spend.ts'

/**
 * What the "Movimientos" card lists (`transaction-list`): the movements the user entered in the
 * shown cycle, newest first. Pure, shared by the demo and the real dashboard through the template.
 */

export type MovementKind = 'expense' | 'income' | 'savings'

export type SavingsMovement = DashboardData['savings']['movements'][number]

type MovementBase = {
  /** `${kind}:${id}`: the card mixes three tables, so the id alone is not a safe key. */
  key: string
  id: string
  name: string
  amount: number
  date: string
  /** The local day in the user's timezone. */
  day: LocalDate
}

export type Movement =
  | (MovementBase & { kind: 'expense'; group: ExpenseGroup; expense: Expense })
  | (MovementBase & { kind: 'income'; entry: IncomeEntry })
  | (MovementBase & { kind: 'savings'; movement: SavingsMovement })

export type MovementDay = {
  day: LocalDate
  label: 'today' | 'yesterday' | null
  items: Movement[]
}

/**
 * Every row the user entered (design D2): expenses and income entries not linked to a recurring
 * definition and not projected, and every savings movement. Newest instant first; ties keep input
 * order (expenses by group, then income, then savings).
 */
export function userMovements(data: Pick<DashboardData, 'expenses' | 'income' | 'savings'>, timeZone: string): Movement[] {
  const movements: Movement[] = []
  const base = (kind: MovementKind, row: { id: string; name: string; amount: number; date: string }) => ({
    key: `${kind}:${row.id}`,
    id: row.id,
    name: row.name,
    amount: row.amount,
    date: row.date,
    day: localDayOf(row.date, timeZone),
  })
  for (const group of data.expenses.groups) {
    for (const expense of group.expenses) {
      if (expense.fixed || expense.projected) continue
      movements.push({ ...base('expense', expense), kind: 'expense', group, expense })
    }
  }
  for (const entry of data.income.entries) {
    if (entry.recurring || entry.projected) continue
    movements.push({ ...base('income', entry), kind: 'income', entry })
  }
  for (const movement of data.savings.movements) {
    movements.push({ ...base('savings', movement), kind: 'savings', movement })
  }
  return movements.sort((a, b) => Date.parse(b.date) - Date.parse(a.date))
}

/** A slice of movements under one heading per local day, in the slice's order. */
export function groupByDay(movements: Movement[], today: LocalDate): MovementDay[] {
  const yesterday = addDays(today, -1)
  const days: MovementDay[] = []
  for (const movement of movements) {
    const last = days[days.length - 1]
    if (last && last.day === movement.day) {
      last.items.push(movement)
      continue
    }
    days.push({
      day: movement.day,
      label: movement.day === today ? 'today' : movement.day === yesterday ? 'yesterday' : null,
      items: [movement],
    })
  }
  return days
}
