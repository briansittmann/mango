import type { Dispatch, SetStateAction } from 'react'
import { getBudgetStatus } from '@/lib/data/budget'
import type { DashboardData, Expense, ExpenseGroup } from '@/lib/data/dashboard'
import type { ExpenseDraft, ExpenseMutations } from '@/lib/data/expenses'
import type { DemoCategoryEdits } from '@/lib/demo/demo-categories'

export type DemoExpenseEdits = {
  created: { id: string; categoryId: string; draft: ExpenseDraft }[]
  updated: Record<string, ExpenseDraft>
  deletedIds: string[] // the demo's borrado_en: rows stay, flagged
}

export const noDemoEdits: DemoExpenseEdits = { created: [], updated: {}, deletedIds: [] }

function toExpense(id: string, draft: ExpenseDraft, fixed?: Expense['fixed']): Expense {
  return { id, name: draft.description, amount: draft.amount, date: `${draft.date}T12:00:00Z`, ...(fixed ? { fixed } : {}) }
}

function resolveExpenses(group: ExpenseGroup, edits: DemoExpenseEdits): Expense[] {
  const created = edits.created.filter((c) => c.categoryId === group.id).map((c) => toExpense(c.id, c.draft))

  return [...group.expenses, ...created]
    .filter((expense) => !edits.deletedIds.includes(expense.id))
    .map((expense) => {
      const update = edits.updated[expense.id]
      return update ? toExpense(expense.id, update, expense.fixed) : expense
    })
}

function finalizeGroup(
  group: ExpenseGroup,
  expenses: Expense[],
  budgetAmount: number | null,
  currentDay: number,
  cycleDays: number,
): ExpenseGroup {
  const total = expenses.reduce((sum, expense) => sum + expense.amount, 0)

  return {
    ...group,
    total,
    budget: budgetAmount != null ? getBudgetStatus({ amount: budgetAmount, spent: total, currentDay, cycleDays }) : null,
    expenses,
  }
}

export function deriveDemoData(base: DashboardData, expenseEdits: DemoExpenseEdits, categoryEdits: DemoCategoryEdits): DashboardData {
  const today = Number(base.cycle.today.slice(8, 10))
  const start = Number(base.cycle.start.slice(8, 10))
  const end = Number(base.cycle.end.slice(8, 10))
  const currentDay = today - start + 1
  const cycleDays = end - start + 1

  // 1. Expense edits resolve each group's rows.
  const resolved = base.expenses.groups.map((group) => ({ group, expenses: resolveExpenses(group, expenseEdits) }))

  // 2. Category updates override name, colour and budget amount.
  const updated = resolved.map(({ group, expenses }) => {
    const draft = categoryEdits.updated[group.id]
    if (!draft) return { group, expenses, budgetAmount: group.budget?.amount ?? null }
    return { group: { ...group, name: draft.name, color: draft.color }, expenses, budgetAmount: draft.budget }
  })

  // 3. Category deletions append the deleted group's resolved rows onto the receiving group and remove the group.
  const deletedIds = new Set(categoryEdits.deleted.map((d) => d.id))
  const reassignedExpenses = new Map<string, Expense[]>()
  for (const { group, expenses } of updated) {
    const target = categoryEdits.deleted.find((d) => d.id === group.id)?.reassignTo
    if (deletedIds.has(group.id) && target) {
      reassignedExpenses.set(target, [...(reassignedExpenses.get(target) ?? []), ...expenses])
    }
  }
  const survivors = updated.filter(({ group }) => !deletedIds.has(group.id))

  // 4. Stored order. Ids it does not name keep their relative position after the ones it does,
  //    and an id it names that no longer exists simply has no effect.
  const order = categoryEdits.order
  const rank = (id: string) => {
    const index = order?.indexOf(id) ?? -1
    return index === -1 ? (order?.length ?? 0) : index
  }
  const ordered = order ? [...survivors].sort((a, b) => rank(a.group.id) - rank(b.group.id)) : survivors

  // 5. Recompute each group's total and budget status.
  const groups = ordered.map(({ group, expenses, budgetAmount }) =>
    finalizeGroup(group, [...expenses, ...(reassignedExpenses.get(group.id) ?? [])], budgetAmount, currentDay, cycleDays),
  )

  // 6. Recompute the page: expenses total, the current history entry, and the free margin.
  const total = groups.reduce((sum, group) => sum + group.total, 0)
  const freeMargin = base.income.total - total - base.savings.cycle
  const history = base.history.map((entry) => (entry.month === base.cycle.month ? { ...entry, total } : entry))

  return { ...base, expenses: { total, groups }, freeMargin, history }
}

let counter = 0

export function createDemoExpenseMutations(setEdits: Dispatch<SetStateAction<DemoExpenseEdits>>): ExpenseMutations {
  return {
    create(categoryId, draft) {
      counter += 1
      const id = `demo-new-${counter}`
      setEdits((edits) => ({ ...edits, created: [...edits.created, { id, categoryId, draft }] }))
      return Promise.resolve()
    },
    update(expenseId, draft) {
      setEdits((edits) => ({ ...edits, updated: { ...edits.updated, [expenseId]: draft } }))
      return Promise.resolve()
    },
    softDelete(expenseId) {
      setEdits((edits) => ({ ...edits, deletedIds: [...edits.deletedIds, expenseId] }))
      return Promise.resolve()
    },
    restore(expenseId) {
      setEdits((edits) => ({ ...edits, deletedIds: edits.deletedIds.filter((id) => id !== expenseId) }))
      return Promise.resolve()
    },
  }
}
