import type { Dispatch, SetStateAction } from 'react'
import { getBudgetStatus } from '@/lib/data/budget'
import type { DashboardData, Expense, ExpenseGroup } from '@/lib/data/dashboard'
import type { ExpenseDraft, ExpenseMutations } from '@/lib/data/expenses'

export type DemoExpenseEdits = {
  created: { id: string; categoryId: string; draft: ExpenseDraft }[]
  updated: Record<string, ExpenseDraft>
  deletedIds: string[] // the demo's borrado_en: rows stay, flagged
}

export const noDemoEdits: DemoExpenseEdits = { created: [], updated: {}, deletedIds: [] }

function toExpense(id: string, draft: ExpenseDraft): Expense {
  return { id, name: draft.description, amount: draft.amount, date: `${draft.date}T12:00:00Z` }
}

function deriveGroup(group: ExpenseGroup, edits: DemoExpenseEdits, currentDay: number, cycleDays: number): ExpenseGroup {
  const created = edits.created.filter((c) => c.categoryId === group.id).map((c) => toExpense(c.id, c.draft))

  const expenses = [...group.expenses, ...created]
    .filter((expense) => !edits.deletedIds.includes(expense.id))
    .map((expense) => {
      const update = edits.updated[expense.id]
      return update ? toExpense(expense.id, update) : expense
    })

  const total = expenses.reduce((sum, expense) => sum + expense.amount, 0)

  return {
    ...group,
    total,
    budget: group.budget ? getBudgetStatus({ amount: group.budget.amount, spent: total, currentDay, cycleDays }) : null,
    expenses,
  }
}

export function deriveDemoData(base: DashboardData, edits: DemoExpenseEdits): DashboardData {
  const today = Number(base.cycle.today.slice(8, 10))
  const start = Number(base.cycle.start.slice(8, 10))
  const end = Number(base.cycle.end.slice(8, 10))
  const currentDay = today - start + 1
  const cycleDays = end - start + 1

  const groups = base.expenses.groups.map((group) => deriveGroup(group, edits, currentDay, cycleDays))
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
