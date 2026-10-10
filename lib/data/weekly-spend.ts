import type { CategoryColor, Expense, ExpenseGroup } from './dashboard'
import type { LocalDate } from './expenses'

/**
 * The arithmetic behind the two spend widgets (`spend-insights`): how a cycle is cut into weeks,
 * which rows count as spent, how a week's categories rank and fold, and how the cycle's days step
 * on the heat ramp. Pure, timezone-aware, shared by the demo and the real dashboard through the
 * template (design D3); nothing here reads data of its own.
 */

export type Week = {
  /** 1-based position in the cycle. */
  index: number
  start: LocalDate
  end: LocalDate
  /** Contains the cycle's "today" (its last day for a past cycle). */
  current: boolean
}

export type SpentRow = {
  categoryId: string
  categoryName: string
  color: CategoryColor
  amount: number
  /** The row's local day in the user's timezone. */
  day: LocalDate
}

export type WeeklyCategory = {
  /** Null on the "Otras" fold, which is not a category and not a control. */
  id: string | null
  name: string
  color: CategoryColor | null
  amount: number
  rows: number
  /** Share of the week's total, 0–1. */
  share: number
  /** How many categories the fold holds; absent on a real category. */
  folded?: number
}

export type DayCategory = {
  group: ExpenseGroup
  /** The day's counted rows of the category, highest amount first. */
  expenses: Expense[]
  total: number
}

export type DayTotal = {
  date: LocalDate
  /** Day of month, for the cell. */
  day: number
  total: number
  rows: number
  /** 0 for nothing spent, 1–4 by quantile of the cycle's non-zero days. */
  step: 0 | 1 | 2 | 3 | 4
  today: boolean
  future: boolean
}

const DAY_MS = 86_400_000

function toUtc(date: LocalDate): Date {
  return new Date(`${date}T00:00:00Z`)
}

function fromUtc(date: Date): LocalDate {
  return date.toISOString().slice(0, 10)
}

export function addDays(date: LocalDate, days: number): LocalDate {
  return fromUtc(new Date(toUtc(date).getTime() + days * DAY_MS))
}

/** Days from `start` to `end`, both included. */
export function daysBetween(start: LocalDate, end: LocalDate): number {
  return Math.round((toUtc(end).getTime() - toUtc(start).getTime()) / DAY_MS) + 1
}

/** The local calendar day of an instant in a timezone (`YYYY-MM-DD`). */
export function localDayOf(instant: string | Date, timeZone: string): LocalDate {
  return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(instant))
}

/**
 * Seven-day slots from the cycle's first day; the last holds whatever remains (D1). The current
 * week contains `today`, clamped into the cycle, so a past cycle's current week is its last one.
 */
export function weeksOfCycle(start: LocalDate, end: LocalDate, today: LocalDate): Week[] {
  const total = daysBetween(start, end)
  const clampedToday = today < start ? start : today > end ? end : today
  const weeks: Week[] = []
  for (let offset = 0, index = 1; offset < total; offset += 7, index += 1) {
    const weekStart = addDays(start, offset)
    const weekEnd = offset + 7 > total ? end : addDays(start, offset + 6)
    weeks.push({ index, start: weekStart, end: weekEnd, current: clampedToday >= weekStart && clampedToday <= weekEnd })
  }
  return weeks
}

export function currentWeekIndex(weeks: Week[]): number {
  return weeks.find((week) => week.current)?.index ?? weeks.length
}

/**
 * The rows that count as spent (D2): expenses that are neither projected charges nor pending
 * recurring charges. Each carries its local day in the user's timezone.
 */
function isSpent(expense: Expense): boolean {
  return !expense.projected && !(expense.fixed && !expense.fixed.charged)
}

export function spentRows(groups: ExpenseGroup[], timeZone: string): SpentRow[] {
  const rows: SpentRow[] = []
  for (const group of groups) {
    for (const expense of group.expenses) {
      if (!isSpent(expense)) continue
      rows.push({
        categoryId: group.id,
        categoryName: group.name,
        color: group.color,
        amount: expense.amount,
        day: localDayOf(expense.date, timeZone),
      })
    }
  }
  return rows
}

/**
 * Categories ranked by what was spent in the week, highest first; past `top` the rest fold into
 * one last entry with `id: null` (`spend-insights` → *Weekly top categories widget*).
 */
export function weeklyTopCategories(
  groups: ExpenseGroup[],
  week: Pick<Week, 'start' | 'end'>,
  timeZone: string,
  { top = 5, othersName = 'Otras' }: { top?: number; othersName?: string } = {},
): { items: WeeklyCategory[]; total: number } {
  const byCategory = new Map<string, WeeklyCategory>()
  for (const group of groups) {
    byCategory.set(group.id, { id: group.id, name: group.name, color: group.color, amount: 0, rows: 0, share: 0 })
  }
  for (const row of spentRows(groups, timeZone)) {
    if (row.day < week.start || row.day > week.end) continue
    const entry = byCategory.get(row.categoryId)!
    entry.amount += row.amount
    entry.rows += 1
  }
  const ranked = [...byCategory.values()].filter((entry) => entry.amount > 0).sort((a, b) => b.amount - a.amount)
  const total = ranked.reduce((sum, entry) => sum + entry.amount, 0)
  let items = ranked
  if (ranked.length > top) {
    const rest = ranked.slice(top)
    items = [
      ...ranked.slice(0, top),
      {
        id: null,
        name: othersName,
        color: null,
        amount: rest.reduce((sum, entry) => sum + entry.amount, 0),
        rows: rest.reduce((sum, entry) => sum + entry.rows, 0),
        share: 0,
        folded: rest.length,
      },
    ]
  }
  for (const item of items) item.share = total > 0 ? item.amount / total : 0
  return { items, total }
}

/**
 * One entry per local day of the cycle with its spent total and heat step: 0 for nothing spent,
 * then 1–4 by the day's quantile rank among the cycle's non-zero days (ties share a step, a single
 * spending day is the darkest).
 */
export function dailyTotals(groups: ExpenseGroup[], start: LocalDate, end: LocalDate, timeZone: string, today: LocalDate): DayTotal[] {
  const totals = new Map<LocalDate, { total: number; rows: number }>()
  for (const row of spentRows(groups, timeZone)) {
    if (row.day < start || row.day > end) continue
    const entry = totals.get(row.day) ?? { total: 0, rows: 0 }
    entry.total += row.amount
    entry.rows += 1
    totals.set(row.day, entry)
  }
  const nonZero = [...totals.values()].map((entry) => entry.total).sort((a, b) => a - b)
  const step = (total: number): DayTotal['step'] => {
    if (total <= 0) return 0
    // The heaviest day is always the darkest, ties included.
    if (total >= nonZero[nonZero.length - 1]) return 4
    const below = nonZero.filter((value) => value < total).length
    return (1 + Math.min(2, Math.floor((below / (nonZero.length - 1)) * 3))) as DayTotal['step']
  }
  const days: DayTotal[] = []
  for (let i = 0, count = daysBetween(start, end); i < count; i += 1) {
    const date = addDays(start, i)
    const entry = totals.get(date) ?? { total: 0, rows: 0 }
    days.push({
      date,
      day: Number(date.slice(8, 10)),
      total: entry.total,
      rows: entry.rows,
      step: step(entry.total),
      today: date === today,
      future: date > today,
    })
  }
  return days
}

/**
 * One day's spent rows grouped by category, for the day detail (`spend-insights` → *Day detail*):
 * the rows the day's calendar cell counts, categories and rows by amount, highest first.
 */
export function dayExpenses(groups: ExpenseGroup[], day: LocalDate, timeZone: string): { items: DayCategory[]; total: number } {
  const items: DayCategory[] = []
  for (const group of groups) {
    const expenses = group.expenses
      .filter((expense) => isSpent(expense) && localDayOf(expense.date, timeZone) === day)
      .sort((a, b) => b.amount - a.amount)
    if (expenses.length > 0) items.push({ group, expenses, total: expenses.reduce((sum, expense) => sum + expense.amount, 0) })
  }
  items.sort((a, b) => b.total - a.total)
  return { items, total: items.reduce((sum, item) => sum + item.total, 0) }
}
