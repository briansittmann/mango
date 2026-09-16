import type { LocalDate, ExpenseMutations } from './expenses'

// = check in supabase/migrations/0004_categorias.sql
export type CategoryColor =
  | 'naranja_calido'
  | 'verde_profundo'
  | 'azul_apagado'
  | 'gris_calido'
  | 'violeta_metalico'
  | 'gris_oscuro'
  | 'blanco'
  | 'granate'

export type BudgetStatus = {
  amount: number
  spent: number
  usage: number
  level: 'ok' | 'warning' | 'exceeded'
  remaining: number
  daysLeft: number
  weeklyAllowance: number | null
}

export type Expense = { id: string; name: string; amount: number; date: string }

export type ExpenseGroup = {
  /** For `kind: 'category'`, the category id that `ExpenseMutations.create` receives. */
  id: string
  kind: 'fixed' | 'category'
  name: string | null
  color: CategoryColor
  total: number
  budget: BudgetStatus | null
  expenses: Expense[]
}

export type DashboardData = {
  user: { name: string; phone: string; photoUrl: string | null; currency: string; timezone: string }
  cycle: { start: string; end: string; today: LocalDate; month: string; inProgress: boolean }
  freeMargin: number
  income: { total: number; sources: { id: string; name: string; estimated: number; actual: number }[] }
  savings: { cycle: number; accumulated: number; movements: { id: string; name: string; date: string; amount: number }[] }
  expenses: { total: number; groups: ExpenseGroup[] }
  history: { month: string; total: number }[]
}

export type DashboardActions = Partial<{
  previousCycle(): void
  nextCycle(): void
  selectCycle(month: string): void
  expenses: ExpenseMutations
  addIncome(): void
  addSavingsMovement(): void
  signOut(): void
  changeLanguage(l: 'es' | 'en'): Promise<void>
}>
