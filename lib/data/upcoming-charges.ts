import type { CategoryColor, ExpenseGroup } from '@/lib/data/dashboard'

export type UpcomingCharge = {
  id: string
  name: string
  day: number
  amount: number
  color: CategoryColor
  charged: boolean
}

export function selectUpcomingCharges(groups: ExpenseGroup[]): UpcomingCharge[] {
  const charges = groups.flatMap((group) =>
    group.expenses
      .filter((expense) => expense.fixed != null)
      .map((expense) => ({
        id: expense.id,
        name: expense.name,
        day: expense.fixed!.day,
        amount: expense.amount,
        color: group.color,
        charged: expense.fixed!.charged,
      })),
  )

  return charges.sort((a, b) => {
    if (a.charged !== b.charged) return a.charged ? -1 : 1
    return a.day - b.day
  })
}
