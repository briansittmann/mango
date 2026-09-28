import type { LocalDate, ExpenseMutations } from './expenses'
import type { CategoryMutations } from './categories'
import type { RecurringMutations } from './recurring'
import type { IncomeEntry, IncomeMutations } from './income'
import type { SavingsMutations } from './savings'

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
  | 'rojo'
  | 'coral'
  | 'rosa'
  | 'azul_electrico'
  | 'celeste'
  | 'turquesa'
  | 'verde_menta'

export type BudgetStatus = {
  amount: number
  spent: number
  usage: number
  level: 'ok' | 'warning' | 'exceeded'
  remaining: number
  daysLeft: number
  weeklyAllowance: number | null
}

export type Expense = {
  id: string
  name: string
  amount: number
  date: string
  /**
   * Present only on a charge linked to a recurring definition (§7): `movimientos_recurrentes.id`
   * and its `dia_del_mes`. `charged` is true when `transacciones.estado` is `confirmada` or the
   * charge's local day is not after today (Q4): a pending charge whose day passed shows as taken.
   */
  fixed?: { definitionId: string; day: number; charged: boolean }
  /**
   * A charge computed by `proyectarCiclo` for a projected cycle (id `proj:<definitionId>`), not a
   * stored row: it stays read-only, and a category holding only these keeps its empty bar (D3).
   */
  projected?: true
}

export type ExpenseGroup = {
  /** The category id that `ExpenseMutations.create` receives. */
  id: string
  kind: 'category'
  name: string
  color: CategoryColor
  total: number
  budget: BudgetStatus | null
  expenses: Expense[]
  /**
   * Rows the category holds in cycles after the displayed one (real, not deleted): what a delete
   * "from this month on" reaches beyond this cycle (`category-editing` → *Deleting a category*).
   */
  rowsLater: number
}

export type DashboardData = {
  user: { name: string; phone: string | null; photoUrl: string | null; currency: string; timezone: string }
  cycle: {
    start: string
    end: string
    today: LocalDate
    month: string
    inProgress: boolean
    /** A cycle after the one in progress, computed by `proyectarCiclo` (`cycle-projection`). */
    projected: boolean
    /** The month of the cycle in progress, marked in the month picker. */
    currentMonth: string
    /** The last month the controls may reach: the sixth cycle after the one in progress. */
    maxMonth: string
  }
  freeMargin: number
  income: { total: number; entries: IncomeEntry[] }
  savings: {
    cycle: number
    accumulated: number
    /** `usuarios.meta_ahorro_mensual` (0016) — null means the user never set one. */
    target: number | null
    /** Accumulated balance per cycle, most recent last, same shape as `history` above. */
    history: { month: string; accumulated: number }[]
    movements: { id: string; name: string; date: string; amount: number }[]
  }
  expenses: { total: number; groups: ExpenseGroup[] }
  history: { month: string; total: number }[]
}

export type DashboardActions = Partial<{
  previousCycle(): void
  nextCycle(): void
  selectCycle(month: string): void
  openSavingsHistory(): void
  expenses: ExpenseMutations
  categories: CategoryMutations
  recurring: RecurringMutations
  income: IncomeMutations
  savings: SavingsMutations
  signOut(): void
  changeLanguage(l: 'es' | 'en'): Promise<void>
}>
