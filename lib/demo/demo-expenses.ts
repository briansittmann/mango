import type { Dispatch, SetStateAction } from 'react'
import { getBudgetStatus, getFreeMargin, type BudgetRow } from '@/lib/data/budget'
import type { CategoryColor, DashboardData, Expense, ExpenseGroup } from '@/lib/data/dashboard'
import type { ExpenseDraft, ExpenseMutations, LocalDate } from '@/lib/data/expenses'
import type { IncomeDraft, IncomeEntry } from '@/lib/data/income'
import { mezclarProyeccion, proyectarCiclo } from '@/lib/data/projection'
import type { RecurringDefinition, RecurringDraft, RecurringTarget } from '@/lib/data/recurring'
import { budgetFor, copyForward, dropCategory, dropCategoryFrom, setBudgetInCycle } from '@/lib/demo/demo-budgets'
import type { DemoCategoryEdits } from '@/lib/demo/demo-categories'
import type { DemoIncomeEdits } from '@/lib/demo/demo-income'
import { slotKey, type DemoRecurringEdits, type DemoSlot } from '@/lib/demo/demo-recurring'
import type { DemoSavingsEdits } from '@/lib/demo/demo-savings'

export type DemoExpenseEdits = {
  created: { id: string; categoryId: string; draft: ExpenseDraft }[]
  /** The last saved draft wins, with the category it was saved in. */
  updated: Record<string, ExpenseDraft & { categoryId: string }>
  deletedIds: string[] // the demo's borrado_en: rows stay, flagged
}

export const noDemoEdits: DemoExpenseEdits = { created: [], updated: {}, deletedIds: [] }

/** A row with the category it belongs to before any category delete moves it. */
type Placed = { categoryId: string; expense: Expense }

function toExpense(id: string, draft: ExpenseDraft, fixed?: Expense['fixed']): Expense {
  return { id, name: draft.description, amount: draft.amount, date: `${draft.date}T12:00:00Z`, ...(fixed ? { fixed } : {}) }
}

// A created row belongs to the cycle its effective date falls in, a calendar month in the demo
// (D6 of `add-entries-in-projected-cycles`): its update's date when it has one, else its own.
function inMonth(id: string, draft: { date: string }, updated: Record<string, { date: string }>, month: string): boolean {
  return (updated[id]?.date ?? draft.date).slice(0, 7) === month
}

function resolveExpenses(group: ExpenseGroup, edits: DemoExpenseEdits, month: string): Expense[] {
  const created = edits.created
    .filter((c) => c.categoryId === group.id && inMonth(c.id, c.draft, edits.updated, month))
    .map((c) => toExpense(c.id, c.draft))

  return [...group.expenses, ...created]
    .filter((expense) => !edits.deletedIds.includes(expense.id))
    .map((expense) => {
      const update = edits.updated[expense.id]
      return update ? toExpense(expense.id, update, expense.fixed) : expense
    })
}

/** The rows the visitor entered in `month`, with the category their last save put them in. */
function createdIn(edits: DemoExpenseEdits, month: string): Placed[] {
  return edits.created
    .filter((c) => !edits.deletedIds.includes(c.id) && inMonth(c.id, c.draft, edits.updated, month))
    .map((c) => ({
      categoryId: edits.updated[c.id]?.categoryId ?? c.categoryId,
      expense: toExpense(c.id, edits.updated[c.id] ?? c.draft),
    }))
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

// Created, deleted and stopped definitions; the field changes come in `definitionsAt`.
function resolveDefinitions(base: RecurringDefinition[], edits: DemoRecurringEdits): RecurringDefinition[] {
  const created = edits.created.map(({ id, target, draft }) => toDefinition(id, target, draft))

  return [...base, ...created]
    .filter((definition) => !edits.deletedIds.includes(definition.id))
    .map((definition) => (edits.stoppedIds.includes(definition.id) ? { ...definition, active: false } : definition))
}

/**
 * The definitions as a cycle starting on `cycle` sees them (`add-forward-scoped-edits` D2, D3): the
 * definition-sheet updates, which reach every cycle from the one in progress, and the changes "from
 * this month on" made from `cycle` or earlier, applied in the order they were saved. `null` applies
 * every change: the definitions as stored, what the sheets and "Próximos cobros" read. The cycles
 * an onward change skips keep what they showed, as the frozen rows do in Supabase.
 */
function definitionsAt(definitions: RecurringDefinition[], edits: DemoRecurringEdits, cycle: LocalDate | null): RecurringDefinition[] {
  return definitions.map((definition) => {
    const sheet = edits.updated[definition.id]
    const changes = [
      ...(sheet ? [{ seq: edits.updatedSeq[definition.id] ?? 0, sheet, onward: undefined }] : []),
      ...edits.onward
        .filter((o) => o.definitionId === definition.id && (cycle == null || o.cycle <= cycle))
        .map((onward) => ({ seq: onward.seq, sheet: undefined, onward })),
    ].sort((a, b) => a.seq - b.seq)

    return changes.reduce<RecurringDefinition>((current, { sheet, onward }) => {
      if (sheet) return { ...current, name: sheet.name, expectedAmount: sheet.expectedAmount, day: sheet.day, reminder: sheet.reminder }
      if (!onward!.entry) return { ...current, active: false }
      const { amount, description, date, categoryId } = onward!.entry
      return {
        ...current,
        name: description || current.name,
        expectedAmount: amount,
        day: Number(date.slice(8, 10)),
        categoryId: current.tipo === 'gasto' ? categoryId : null,
      }
    }, definition)
  })
}

/**
 * A definition's slot in the cycle starting on `cycle`, unless a later change rewrote it: an onward
 * change from an earlier cycle, or a definition-sheet update for a slot after `sampleStart`
 * (0024 rewrites pending slots there). A deleted slot stays deleted.
 */
function effectiveSlot(edits: DemoRecurringEdits, definitionId: string, cycle: LocalDate, sampleStart: LocalDate): DemoSlot | null {
  const slot = edits.slots[slotKey(definitionId, cycle)]
  if (!slot || slot.deleted) return slot ?? null
  const rewritten =
    edits.onward.some((o) => o.definitionId === definitionId && o.cycle < cycle && o.seq > slot.seq) ||
    (sampleStart < cycle && (edits.updatedSeq[definitionId] ?? 0) > slot.seq)
  return rewritten ? null : slot
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

function resolveIncome(base: IncomeEntry[], edits: DemoIncomeEdits, month: string): IncomeEntry[] {
  const created = edits.created.filter((c) => inMonth(c.id, c.draft, edits.updated, month)).map((c) => toIncomeEntry(c.id, c.draft))

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

// The demo's cycles start on the 1st, so the next cycle starts on the same day a month later.
function followingCycle(start: string): string {
  const [year, month, day] = start.split('-').map(Number)
  return new Date(Date.UTC(year, month, day)).toISOString().slice(0, 10)
}

/** `YYYY-MM` shifted by `n` months; the demo's cycles are calendar months. */
export function shiftDemoMonth(month: string, n: number): string {
  const [year, m] = month.split('-').map(Number)
  return new Date(Date.UTC(year, m - 1 + n, 1)).toISOString().slice(0, 7)
}

function monthsBetween(from: string, to: string): number {
  const [fy, fm] = from.split('-').map(Number)
  const [ty, tm] = to.split('-').map(Number)
  return (ty - fy) * 12 + (tm - fm)
}

function toMovement({ id, draft }: DemoSavingsEdits['created'][number]): DashboardData['savings']['movements'][number] {
  return { id, name: draft.name, date: `${draft.date}T12:00:00Z`, amount: draft.kind === 'withdrawal' ? -draft.amount : draft.amount }
}

const byDate = <T extends { date: string }>(a: T, b: T) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0)

/**
 * Where category deletes leave things (`category-editing` → *A category lives from its first cycle
 * to its last*, `add-forward-scoped-edits` D7): a category lives from the cycle it was created in,
 * a delete "only this month" hides it in that cycle, one "from this month on" ends it at the cycle
 * before — or removes it entirely from its first cycle (`gone`). `placeAt` follows a row of a
 * category to where it is in a cycle: itself, or the receiving category of the delete that
 * reaches that cycle.
 */
function categoryLifetimes(edits: DemoCategoryEdits) {
  const firstCycle = (id: string) => edits.created.find((c) => c.id === id)?.cycle ?? null
  const removes = (d: DemoCategoryEdits['deleted'][number]) =>
    d.scope === 'onward' && firstCycle(d.id) != null && firstCycle(d.id)! >= d.cycle
  const deleteAt = (id: string, cycle: LocalDate) =>
    edits.deleted.find((d) => d.id === id && (d.scope === 'only' ? d.cycle === cycle : removes(d) || d.cycle <= cycle))

  return {
    gone: (id: string) => edits.deleted.some((d) => d.id === id && removes(d)),
    alive: (id: string, cycle: LocalDate) => {
      const from = firstCycle(id)
      // Created "only this month": it lives in its first cycle and no other.
      const only = edits.created.find((c) => c.id === id)?.only ?? false
      return (from == null || from <= cycle) && (!only || cycle === from) && deleteAt(id, cycle) == null
    },
    placeAt: (id: string, cycle: LocalDate): string | null => {
      let current: string | null = id
      for (let hop = 0; hop < 5 && current != null; hop++) {
        const d = deleteAt(current, cycle)
        if (!d) return current
        current = d.reassignTo
      }
      return current
    },
  }
}

/**
 * The sample cycle after the in-memory edits, or, for a `shownMonth` after it, that cycle's
 * projection from the edited definitions and budget rows (`cycle-projection` → *The demo projects too*).
 */
export function deriveDemoData(
  base: DashboardData,
  baseDefinitions: RecurringDefinition[],
  baseBudgetRows: BudgetRow[],
  expenseEdits: DemoExpenseEdits,
  categoryEdits: DemoCategoryEdits,
  recurringEdits: DemoRecurringEdits,
  incomeEdits: DemoIncomeEdits,
  savingsEdits: DemoSavingsEdits,
  shownMonth: string = base.cycle.month,
): { data: DashboardData; definitions: RecurringDefinition[] } {
  const today = Number(base.cycle.today.slice(8, 10))
  const start = Number(base.cycle.start.slice(8, 10))
  const end = Number(base.cycle.end.slice(8, 10))
  const currentDay = today - start + 1
  const cycleDays = end - start + 1
  const sampleStart = base.cycle.start
  const lifetimes = categoryLifetimes(categoryEdits)

  // A delete "from this month on" moves every definition of the category, in every cycle, as
  // `eliminar_categoria` does; one "only this month" moves only that cycle's charges (`placeAt`).
  const relocation = new Map(
    categoryEdits.deleted
      .filter((d): d is typeof d & { reassignTo: string } => d.scope === 'onward' && d.reassignTo != null)
      .map((d) => [d.id, d.reassignTo]),
  )
  const relocate = (definitions: RecurringDefinition[]) =>
    definitions.map((definition) => {
      const reassignTo = definition.categoryId != null ? relocation.get(definition.categoryId) : undefined
      return reassignTo ? { ...definition, categoryId: reassignTo } : definition
    })
  const definitions = resolveDefinitions(baseDefinitions, recurringEdits)
  const storedDefinitions = relocate(definitionsAt(definitions, recurringEdits, null))

  // 1. Definition edits resolve first (D6): what an update or a deletion does to the charges
  //    they produced, ahead of any edit made directly on one of those charges — so an expense
  //    edit applied after a definition update wins on that charge.
  const gastoDefinitionIds = new Set(baseDefinitions.filter((d) => d.tipo === 'gasto').map((d) => d.id))
  const groupsAfterRecurring = reconcileRecurringUpdatesAndDeletes(base.expenses.groups, recurringEdits, gastoDefinitionIds)

  // 2. Expense edits resolve each group's rows; 3. a definition created in this submit claims the
  //    plain expense the same submit created.
  const resolved = attachCreatedDefinitions(
    groupsAfterRecurring.map((group) => ({ group, expenses: resolveExpenses(group, expenseEdits, base.cycle.month) })),
    recurringEdits.created,
    currentDay,
    sampleStart,
  )

  // 4. Each row goes to the category its last save chose — rows entered in a category created
  //    here included — then a fixed charge's slot in the sample cycle, a "solo este mes" edit or a
  //    swipe from its row, overrides it (D1).
  const baseIds = new Set(base.expenses.groups.map((group) => group.id))
  const sampleRows: Placed[] = [
    ...resolved.flatMap(({ group, expenses }) =>
      expenses.map((expense) => ({ categoryId: expenseEdits.updated[expense.id]?.categoryId ?? group.id, expense })),
    ),
    ...createdIn({ ...expenseEdits, created: expenseEdits.created.filter((c) => !baseIds.has(c.categoryId)) }, base.cycle.month),
  ]
    .flatMap((placed): Placed[] => {
      const slot = placed.expense.fixed ? effectiveSlot(recurringEdits, placed.expense.fixed.definitionId, sampleStart, sampleStart) : null
      if (!slot) return [placed]
      if (slot.deleted) return []
      if (!slot.entry) return [placed]
      const { amount, description, date, categoryId } = slot.entry
      return [
        {
          categoryId: categoryId ?? placed.categoryId,
          // Saved from its row in the cycle in progress, a charge is confirmed (0024).
          expense: { ...placed.expense, amount, name: description, date: `${date}T12:00:00Z`, fixed: { ...placed.expense.fixed!, charged: true } },
        },
      ]
    })

  // 5. Budgets come from the per-cycle rows (D4): the copy into the sample cycle, then creations
  //    (a budget from the category's first cycle on), then budget saves in order (the sample
  //    cycle, or a projected one with its scope), then deletions: every row of a category gone
  //    entirely, the rows from its last cycle on for one ended, none for one hidden in a cycle.
  let budgetRows = copyForward(baseBudgetRows, sampleStart)
  for (const { id, draft, cycle } of categoryEdits.created) {
    if (draft.budget != null) {
      budgetRows = setBudgetInCycle(budgetRows, id, draft.budget, {
        current: sampleStart,
        cycle,
        following: followingCycle(cycle),
        scope: 'onward',
      })
    }
  }
  for (const edit of categoryEdits.budgets) {
    budgetRows = setBudgetInCycle(budgetRows, edit.categoryId, edit.amount, {
      current: sampleStart,
      cycle: edit.cycle,
      following: followingCycle(edit.cycle),
      scope: edit.scope,
    })
  }
  for (const deletion of categoryEdits.deleted) {
    if (lifetimes.gone(deletion.id)) budgetRows = dropCategory(budgetRows, deletion.id)
    else if (deletion.scope === 'onward') budgetRows = dropCategoryFrom(budgetRows, deletion.id, deletion.cycle)
  }

  // 6. Every category, updated and in the stored order, whichever cycle it lives in. Ids the
  //    order does not name keep their relative position after the ones it does, and an id it
  //    names that no longer exists simply has no effect.
  const categories: { id: string; name: string; color: CategoryColor }[] = [
    ...base.expenses.groups.map(({ id, name, color }) => ({ id, name, color })),
    ...categoryEdits.created.map(({ id, draft }) => ({ id, name: draft.name, color: draft.color })),
  ]
    .filter(({ id }) => !lifetimes.gone(id))
    .map((category) => {
      const draft = categoryEdits.updated[category.id]
      return draft ? { ...category, name: draft.name, color: draft.color } : category
    })
  const order = categoryEdits.order
  const rank = (id: string) => {
    const index = order?.indexOf(id) ?? -1
    return index === -1 ? (order?.length ?? 0) : index
  }
  const ordered = order ? [...categories].sort((a, b) => rank(a.id) - rank(b.id)) : categories

  // The groups of one cycle: the categories alive in it, each with the rows placed in it.
  function groupsIn(cycle: LocalDate, rows: Placed[], budgetOf: (id: string) => number | null, day: number, days: number): ExpenseGroup[] {
    const month = cycle.slice(0, 7)
    const bucket = new Map<string, Expense[]>()
    for (const { categoryId, expense } of rows) {
      const at = lifetimes.placeAt(categoryId, cycle)
      if (at != null) bucket.set(at, [...(bucket.get(at) ?? []), expense])
    }
    const later = new Map<string, number>()
    for (const { id, categoryId, draft } of expenseEdits.created) {
      const date = (expenseEdits.updated[id] ?? draft).date
      if (expenseEdits.deletedIds.includes(id) || date.slice(0, 7) <= month) continue
      const at = lifetimes.placeAt(expenseEdits.updated[id]?.categoryId ?? categoryId, `${date.slice(0, 7)}-01`)
      if (at != null) later.set(at, (later.get(at) ?? 0) + 1)
    }
    return ordered
      .filter(({ id }) => lifetimes.alive(id, cycle))
      .map(({ id, name, color }) => {
        // Recurring charges count inside their category's budget, pending ones at their expected amount.
        const expenses = (bucket.get(id) ?? []).sort(byDate)
        const total = expenses.reduce((sum, expense) => sum + expense.amount, 0)
        const budgetAmount = budgetOf(id)
        return {
          id,
          kind: 'category' as const,
          name,
          color,
          total,
          budget: budgetAmount != null ? getBudgetStatus({ amount: budgetAmount, spent: total, currentDay: day, cycleDays: days }) : null,
          expenses,
          rowsLater: later.get(id) ?? 0,
          showProgress: categoryEdits.progress[id] ?? true,
        }
      })
  }

  const withSlot = (entries: IncomeEntry[], cycle: LocalDate) =>
    entries.flatMap((entry): IncomeEntry[] => {
      const slot = entry.recurring ? effectiveSlot(recurringEdits, entry.recurring.definitionId, cycle, sampleStart) : null
      if (!slot) return [entry]
      if (slot.deleted) return []
      if (!slot.entry) return [entry]
      return [{ ...entry, amount: slot.entry.amount, name: slot.entry.description, date: `${slot.entry.date}T12:00:00Z` }]
    })

  // 7. The sample cycle.
  const groups = groupsIn(sampleStart, sampleRows, (id) => budgetFor(budgetRows, id, sampleStart), currentDay, cycleDays)
  const total = groups.reduce((sum, group) => sum + group.total, 0)
  const history = base.history.map((entry) => (entry.month === base.cycle.month ? { ...entry, total } : entry))

  // 8. Income resolves after expenses (D6): income edits resolve into plain rows first — the same
  //    order as expenses — so a recurring income create submitted alongside an income entry create
  //    has that entry to find and tag, rather than being resolved onto the untouched base list and
  //    then having `resolveIncome` add the same entry a second time.
  const incomeResolved = resolveIncome(base.income.entries, incomeEdits, base.cycle.month)
  const incomeEntries = withSlot(attachCreatedIncomeDefinition(incomeResolved, recurringEdits.created, sampleStart), sampleStart)
  const incomeTotal = incomeEntries.reduce((sum, entry) => sum + entry.amount, 0)

  // 9. Savings: created movements append to the base ones and are stable-sorted by date, so a
  //    same-day addition lands after the existing movement(s); deleted ones count nowhere.
  const notDeleted = (movement: { id: string }) => !savingsEdits.deletedIds.includes(movement.id)
  const createdMovements = savingsEdits.created.filter((c) => c.draft.date.slice(0, 7) === base.cycle.month).map(toMovement)
  const movements = [...base.savings.movements, ...createdMovements].filter(notDeleted).sort(byDate)
  const savingsCycle = movements.reduce((sum, movement) => sum + movement.amount, 0)
  const savingsAccumulated = base.savings.accumulated - base.savings.cycle + savingsCycle
  const savingsHistory = base.savings.history.map((entry) =>
    entry.month === base.cycle.month ? { ...entry, accumulated: savingsAccumulated } : entry,
  )

  const sample: DashboardData = {
    ...base,
    expenses: { total, groups },
    income: { total: incomeTotal, entries: incomeEntries },
    savings: { ...base.savings, cycle: savingsCycle, accumulated: savingsAccumulated, history: savingsHistory, movements },
    freeMargin: getFreeMargin({
      income: incomeTotal,
      savings: savingsCycle,
      categories: groups.map((group) => ({ budget: group.budget?.amount ?? null, spent: group.total })),
    }),
    history,
  }

  if (shownMonth <= base.cycle.month) return { data: sample, definitions: storedDefinitions }

  // 10. A cycle after the sample, computed through `proyectarCiclo` with the sample as the last
  //     generated cycle (D9), from the definitions as that cycle sees them. A slot the visitor
  //     wrote there (an edit, or a swipe) holds it: an edited slot is listed as a row, a deleted
  //     one as nothing. The rows entered in that month are merged as `resumenMensual` merges real rows.
  const cycle = `${shownMonth}-01`
  const [year, m] = shownMonth.split('-').map(Number)
  const projectedDays = new Date(Date.UTC(year, m, 0)).getUTCDate()
  const projectedEnd = `${shownMonth}-${String(projectedDays).padStart(2, '0')}`
  const definitionsHere = relocate(definitionsAt(definitions, recurringEdits, cycle))
  const projection = proyectarCiclo({
    start: cycle,
    cyclesAfterGenerated: monthsBetween(base.cycle.month, shownMonth),
    definitions: definitionsHere,
    budgetRows,
    savingsTarget: base.savings.target,
  })

  const held: string[] = []
  const slotExpenses: Placed[] = []
  const slotIncome: IncomeEntry[] = []
  for (const definition of definitionsHere) {
    const slot = effectiveSlot(recurringEdits, definition.id, cycle, sampleStart)
    // A restored slot with nothing of its own shows the projected charge again.
    if (!slot || (!slot.deleted && !slot.entry)) continue
    held.push(definition.id)
    if (slot.deleted || !slot.entry) continue
    const { amount, description, date, categoryId } = slot.entry
    const day = Number(date.slice(8, 10))
    const id = `slot:${slotKey(definition.id, cycle)}`
    if (definition.tipo === 'gasto') {
      slotExpenses.push({
        categoryId: categoryId ?? definition.categoryId!,
        expense: { id, name: description, amount, date: `${date}T12:00:00Z`, fixed: { definitionId: definition.id, day, charged: false } },
      })
    } else {
      slotIncome.push({ id, name: description, amount, date: `${date}T12:00:00Z`, recurring: { definitionId: definition.id, day } })
    }
  }
  const charges = mezclarProyeccion({
    charges: projection.charges,
    rows: held.map((definitionId) => ({ definitionId, cycle })),
    start: cycle,
  })
  const dayOf = new Map(definitionsHere.map((definition) => [definition.id, definition.day]))

  const projectedRows: Placed[] = [
    ...charges
      .filter((charge) => charge.tipo === 'gasto')
      .map((charge) => ({
        categoryId: charge.categoryId!,
        expense: {
          id: `proj:${charge.definitionId}`,
          name: charge.name,
          amount: charge.amount,
          date: `${charge.date}T12:00:00Z`,
          fixed: { definitionId: charge.definitionId, day: dayOf.get(charge.definitionId)!, charged: false },
          projected: true as const,
        },
      })),
    ...slotExpenses,
    ...createdIn(expenseEdits, shownMonth),
  ]
  // The demo's cycles run from day 1, so a projected cycle has the days of its own month.
  const [shownYear, shownMonthNumber] = shownMonth.split('-').map(Number)
  const shownDays = new Date(Date.UTC(shownYear, shownMonthNumber, 0)).getUTCDate()
  const projectedGroups = groupsIn(cycle, projectedRows, (id) => projection.budgets.get(id) ?? null, 1, shownDays)

  const entries: IncomeEntry[] = [
    ...charges
      .filter((charge) => charge.tipo === 'ingreso')
      .map((charge) => ({
        id: `proj:${charge.definitionId}`,
        name: charge.name,
        amount: charge.amount,
        date: `${charge.date}T12:00:00Z`,
        recurring: { definitionId: charge.definitionId, day: dayOf.get(charge.definitionId)! },
        projected: true as const,
      })),
    ...slotIncome,
    ...resolveIncome([], incomeEdits, shownMonth),
  ].sort(byDate)
  const projectedIncome = entries.reduce((sum, entry) => sum + entry.amount, 0)
  // The savings target is an envelope in a projection (D4).
  const projectedMovements = savingsEdits.created
    .filter((c) => c.draft.date.slice(0, 7) === shownMonth)
    .map(toMovement)
    .filter(notDeleted)
    .sort(byDate)
  const projectedSavings = Math.max(projection.savings, projectedMovements.reduce((sum, movement) => sum + movement.amount, 0))

  return {
    data: {
      ...sample,
      cycle: { ...sample.cycle, start: cycle, end: projectedEnd, today: cycle, month: shownMonth, inProgress: false, projected: true },
      freeMargin: getFreeMargin({
        income: projectedIncome,
        savings: projectedSavings,
        categories: projectedGroups.map((group) => ({ budget: group.budget?.amount ?? null, spent: group.total })),
      }),
      income: { total: projectedIncome, entries },
      savings: { ...sample.savings, cycle: projectedSavings, movements: projectedMovements },
      expenses: { total: projectedGroups.reduce((sum, group) => sum + group.total, 0), groups: projectedGroups },
    },
    definitions: storedDefinitions,
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
    update(expenseId, draft, categoryId) {
      setEdits((edits) => ({ ...edits, updated: { ...edits.updated, [expenseId]: { ...draft, categoryId } } }))
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
