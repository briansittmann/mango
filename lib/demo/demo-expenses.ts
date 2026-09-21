import type { Dispatch, SetStateAction } from 'react'
import { getBudgetStatus } from '@/lib/data/budget'
import type { DashboardData, Expense, ExpenseGroup } from '@/lib/data/dashboard'
import type { ExpenseDraft, ExpenseMutations } from '@/lib/data/expenses'
import type { IncomeDraft, IncomeEntry } from '@/lib/data/income'
import type { RecurringDefinition, RecurringDraft, RecurringTarget } from '@/lib/data/recurring'
import type { DemoCategoryEdits } from '@/lib/demo/demo-categories'
import type { DemoIncomeEdits } from '@/lib/demo/demo-income'
import type { DemoRecurringEdits } from '@/lib/demo/demo-recurring'

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

function toDefinition(id: string, target: RecurringTarget, draft: RecurringDraft): RecurringDefinition {
  return {
    id,
    name: draft.name,
    expectedAmount: draft.expectedAmount,
    tipo: target.tipo,
    categoryId: target.tipo === 'gasto' ? target.categoryId : null,
    day: draft.day,
    active: true,
    reminder: draft.reminder,
    repetitions: draft.repetitions != null ? { total: draft.repetitions, done: 0 } : null,
  }
}

function resolveDefinitions(base: RecurringDefinition[], edits: DemoRecurringEdits): RecurringDefinition[] {
  const created = edits.created.map(({ id, target, draft }) => toDefinition(id, target, draft))

  return [...base, ...created]
    .filter((definition) => !edits.deletedIds.includes(definition.id))
    .map((definition) => {
      const update = edits.updated[definition.id]
      const stopped = edits.stoppedIds.includes(definition.id)
      if (!update && !stopped) return definition
      return {
        ...definition,
        ...(stopped ? { active: false } : {}),
        ...(update ? { name: update.name, expectedAmount: update.expectedAmount, day: update.day, reminder: update.reminder } : {}),
      }
    })
}

// What an update or a deletion does to the charge a definition already produced, resolved
// ahead of the ordinary expense-edit step (D6): an amount change rewrites this cycle's charge
// only while it is still pending (D4); a deletion removes it. Stopping touches no expense — a
// stopped definition simply produces no more charges from here on.
function reconcileRecurringUpdatesAndDeletes(groups: ExpenseGroup[], edits: DemoRecurringEdits, expenseDefinitionIds: Set<string>): ExpenseGroup[] {
  return groups.map((group) => ({
    ...group,
    expenses: group.expenses
      .filter(
        (expense) =>
          !expense.fixed || !expenseDefinitionIds.has(expense.fixed.definitionId) || !edits.deletedIds.includes(expense.fixed.definitionId),
      )
      .map((expense) => {
        if (!expense.fixed || expense.fixed.charged || !expenseDefinitionIds.has(expense.fixed.definitionId)) return expense
        const update = edits.updated[expense.fixed.definitionId]
        return update ? { ...expense, amount: update.expectedAmount } : expense
      }),
  }))
}

// The entry sheet's recurrence toggle calls `create` on both operation sets for the same save
// (7.2/7.3): `expenses.create` records this cycle's row, `recurring.create` records the
// definition. Resolved after expense edits (so the plain row exists to find), this claims that
// row — same category, amount, day and name, all drawn from the same typed-in values — and
// tags it as the definition's charge, rather than adding a second one; one visible row, not
// two, mirroring a single linked insert in Supabase. A created definition with no matching row
// (no other caller exists yet, but the contract doesn't require one) still gets a synthesized
// charge, so it is never silently dropped.
function attachCreatedDefinitions(
  resolved: { group: ExpenseGroup; expenses: Expense[] }[],
  created: DemoRecurringEdits['created'],
  currentDay: number,
  cycleStart: string,
): { group: ExpenseGroup; expenses: Expense[] }[] {
  const expenseCreated = created.filter(
    (c): c is { id: string; target: { tipo: 'gasto'; categoryId: string }; draft: RecurringDraft } => c.target.tipo === 'gasto',
  )
  const claimed = new Set<string>()

  const tagged = resolved.map(({ group, expenses }) => ({
    group,
    expenses: expenses.map((expense) => {
      if (expense.fixed) return expense
      const day = Number(expense.date.slice(8, 10))
      const match = expenseCreated.find(
        (c) =>
          c.target.categoryId === group.id &&
          !claimed.has(c.id) &&
          c.draft.expectedAmount === expense.amount &&
          c.draft.day === day &&
          c.draft.name.trim() === expense.name.trim(),
      )
      if (!match) return expense
      claimed.add(match.id)
      return { ...expense, fixed: { definitionId: match.id, day: match.draft.day, charged: match.draft.day <= currentDay } }
    }),
  }))

  const monthPrefix = cycleStart.slice(0, 8) // 'YYYY-MM-'
  return tagged.map(({ group, expenses }) => {
    const additions = expenseCreated
      .filter((c) => c.target.categoryId === group.id && !claimed.has(c.id))
      .map(
        ({ id, draft }): Expense => ({
          id: `charge-${id}`,
          name: draft.name,
          amount: draft.expectedAmount,
          date: `${monthPrefix}${String(draft.day).padStart(2, '0')}T12:00:00Z`,
          fixed: { definitionId: id, day: draft.day, charged: draft.day <= currentDay },
        }),
      )
    return { group, expenses: [...expenses, ...additions] }
  })
}

function toIncomeEntry(id: string, draft: IncomeDraft, recurring?: IncomeEntry['recurring']): IncomeEntry {
  return { id, name: draft.description, amount: draft.amount, date: `${draft.date}T12:00:00Z`, ...(recurring ? { recurring } : {}) }
}

function resolveIncome(base: IncomeEntry[], edits: DemoIncomeEdits): IncomeEntry[] {
  const created = edits.created.map((c) => toIncomeEntry(c.id, c.draft))

  return [...base, ...created]
    .filter((entry) => !edits.deletedIds.includes(entry.id))
    .map((entry) => {
      const update = edits.updated[entry.id]
      return update ? toIncomeEntry(entry.id, update, entry.recurring) : entry
    })
}

// Mirrors attachCreatedDefinitions (D6): a recurring income create submitted alongside an
// income entry create (same name, amount and day) tags that entry rather than producing a
// second row. Only 'ingreso' targets are considered — a 'gasto' recurring create never
// produces an income row.
function attachCreatedIncomeDefinition(entries: IncomeEntry[], created: DemoRecurringEdits['created'], cycleStart: string): IncomeEntry[] {
  const incomeCreated = created.filter((c): c is { id: string; target: { tipo: 'ingreso' }; draft: RecurringDraft } => c.target.tipo === 'ingreso')
  const claimed = new Set<string>()

  const tagged = entries.map((entry) => {
    if (entry.recurring) return entry
    const day = Number(entry.date.slice(8, 10))
    const match = incomeCreated.find(
      (c) => !claimed.has(c.id) && c.draft.expectedAmount === entry.amount && c.draft.day === day && c.draft.name.trim() === entry.name.trim(),
    )
    if (!match) return entry
    claimed.add(match.id)
    return { ...entry, recurring: { definitionId: match.id, day: match.draft.day } }
  })

  const monthPrefix = cycleStart.slice(0, 8) // 'YYYY-MM-'
  const additions = incomeCreated
    .filter((c) => !claimed.has(c.id))
    .map(
      ({ id, draft }): IncomeEntry => ({
        id: `income-${id}`,
        name: draft.name,
        amount: draft.expectedAmount,
        date: `${monthPrefix}${String(draft.day).padStart(2, '0')}T12:00:00Z`,
        recurring: { definitionId: id, day: draft.day },
      }),
    )
  return [...tagged, ...additions]
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

export function deriveDemoData(
  base: DashboardData,
  baseDefinitions: RecurringDefinition[],
  expenseEdits: DemoExpenseEdits,
  categoryEdits: DemoCategoryEdits,
  recurringEdits: DemoRecurringEdits,
  incomeEdits: DemoIncomeEdits,
): { data: DashboardData; definitions: RecurringDefinition[] } {
  const today = Number(base.cycle.today.slice(8, 10))
  const start = Number(base.cycle.start.slice(8, 10))
  const end = Number(base.cycle.end.slice(8, 10))
  const currentDay = today - start + 1
  const cycleDays = end - start + 1

  // 1. Definition edits resolve first (D6): what an update or a deletion does to the charges
  //    they produced, ahead of any edit made directly on one of those charges — so an expense
  //    edit applied after a definition update wins on that charge.
  const definitions = resolveDefinitions(baseDefinitions, recurringEdits)
  const gastoDefinitionIds = new Set(baseDefinitions.filter((d) => d.tipo === 'gasto').map((d) => d.id))
  const groupsAfterRecurring = reconcileRecurringUpdatesAndDeletes(base.expenses.groups, recurringEdits, gastoDefinitionIds)

  // 2. Expense edits resolve each group's rows.
  const expenseResolved = groupsAfterRecurring.map((group) => ({ group, expenses: resolveExpenses(group, expenseEdits) }))

  // 3. A definition created in this submit claims the plain expense the same submit created.
  const resolved = attachCreatedDefinitions(expenseResolved, recurringEdits.created, currentDay, base.cycle.start)

  // 4. Category updates override name, colour and budget amount.
  const updated = resolved.map(({ group, expenses }) => {
    const draft = categoryEdits.updated[group.id]
    if (!draft) return { group, expenses, budgetAmount: group.budget?.amount ?? null }
    return { group: { ...group, name: draft.name, color: draft.color }, expenses, budgetAmount: draft.budget }
  })

  // 5. Category deletions append the deleted group's resolved rows onto the receiving group and remove the group.
  const deletedIds = new Set(categoryEdits.deleted.map((d) => d.id))
  const reassignedExpenses = new Map<string, Expense[]>()
  for (const { group, expenses } of updated) {
    const target = categoryEdits.deleted.find((d) => d.id === group.id)?.reassignTo
    if (deletedIds.has(group.id) && target) {
      reassignedExpenses.set(target, [...(reassignedExpenses.get(target) ?? []), ...expenses])
    }
  }
  const survivors = updated.filter(({ group }) => !deletedIds.has(group.id))

  // 5b. Category creations append after the deletion pass and before the stored-order sort
  //     (D4): appending before deletions would let a create be swept up by a delete's
  //     reassignment, and appending after the sort would ignore a stored order that already
  //     names the new id.
  const created = categoryEdits.created.map(({ id, draft }) => ({
    group: { id, kind: 'category' as const, name: draft.name, color: draft.color, total: 0, budget: null, expenses: [] },
    expenses: [] as Expense[],
    budgetAmount: draft.budget,
  }))
  const withCreated = [...survivors, ...created]

  // A definition's own `categoryId` is stored separately from the expense rows it produced, so
  // deleting its category has to relocate it too — otherwise its sheet points at a category that
  // no longer exists (`dashboard-ui` → *A deleted category carries its charges*).
  const categoryReassignment = new Map(
    categoryEdits.deleted.filter((d): d is { id: string; reassignTo: string } => d.reassignTo != null).map((d) => [d.id, d.reassignTo]),
  )
  const relocatedDefinitions = definitions.map((definition) => {
    const reassignTo = definition.categoryId != null ? categoryReassignment.get(definition.categoryId) : undefined
    return reassignTo ? { ...definition, categoryId: reassignTo } : definition
  })

  // 6. Stored order. Ids it does not name keep their relative position after the ones it does,
  //    and an id it names that no longer exists simply has no effect.
  const order = categoryEdits.order
  const rank = (id: string) => {
    const index = order?.indexOf(id) ?? -1
    return index === -1 ? (order?.length ?? 0) : index
  }
  const ordered = order ? [...withCreated].sort((a, b) => rank(a.group.id) - rank(b.group.id)) : withCreated

  // 7. Recompute each group's total and budget status.
  const groups = ordered.map(({ group, expenses, budgetAmount }) =>
    finalizeGroup(group, [...expenses, ...(reassignedExpenses.get(group.id) ?? [])], budgetAmount, currentDay, cycleDays),
  )

  // 8. Recompute the expenses total and the current history entry.
  const total = groups.reduce((sum, group) => sum + group.total, 0)
  const history = base.history.map((entry) => (entry.month === base.cycle.month ? { ...entry, total } : entry))

  // 9. Income resolves last (D6): income edits resolve into plain rows first — the same order as
  //    expenses (step 2 before step 3) — so a recurring income create submitted alongside an
  //    income entry create has that entry to find and tag, rather than being resolved onto the
  //    untouched base list and then having `resolveIncome` add the same entry a second time.
  const incomeResolved = resolveIncome(base.income.entries, incomeEdits)
  const incomeEntries = attachCreatedIncomeDefinition(incomeResolved, recurringEdits.created, base.cycle.start)
  const incomeTotal = incomeEntries.reduce((sum, entry) => sum + entry.amount, 0)
  const freeMargin = incomeTotal - total - base.savings.cycle

  return {
    data: { ...base, expenses: { total, groups }, income: { total: incomeTotal, entries: incomeEntries }, freeMargin, history },
    definitions: relocatedDefinitions,
  }
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
