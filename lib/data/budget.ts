import type { BudgetStatus } from './dashboard'

export function getBudgetStatus({
  amount,
  spent,
  currentDay,
  cycleDays,
}: {
  amount: number
  spent: number
  currentDay: number
  cycleDays: number
}): BudgetStatus {
  const usage = spent / amount
  const remaining = Math.max(0, amount - spent)
  const daysLeft = cycleDays - currentDay + 1
  const weeklyAllowance = daysLeft >= 7 ? Math.floor((remaining / daysLeft) * 7) : null
  const level = usage >= 1 ? 'exceeded' : usage >= 0.8 ? 'warning' : 'ok'

  return { amount, spent, usage, level, remaining, daysLeft, weeklyAllowance }
}
