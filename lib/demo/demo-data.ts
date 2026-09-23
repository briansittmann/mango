import type { BudgetRow } from '@/lib/data/budget'
import type { CategoryColor, DashboardData, ExpenseGroup } from '@/lib/data/dashboard'
import type { RecurringDefinition } from '@/lib/data/recurring'
import { deriveDemoData, noDemoEdits } from '@/lib/demo/demo-expenses'
import { noDemoCategoryEdits } from '@/lib/demo/demo-categories'
import { noDemoIncomeEdits } from '@/lib/demo/demo-income'
import { noDemoRecurringEdits } from '@/lib/demo/demo-recurring'
import { noDemoSavingsEdits } from '@/lib/demo/demo-savings'

type Locale = 'es' | 'en'
type Localized = { es: string; en: string }

const TIMEZONE = 'Europe/Dublin'
const CYCLE_START = '2026-09-01'
const CYCLE_END = '2026-09-30'

const NAMES = {
  comida: { es: 'Comida', en: 'Food' },
  ocio: { es: 'Ocio', en: 'Leisure' },
  transporte: { es: 'Transporte', en: 'Transport' },
  salud: { es: 'Salud', en: 'Health' },
  hogar: { es: 'Hogar', en: 'Home' },
  compras: { es: 'Compras', en: 'Shopping' },
  vivienda: { es: 'Vivienda', en: 'Housing' },
  alquiler: { es: 'Alquiler', en: 'Rent' },
  internet: { es: 'Internet', en: 'Internet' },
  seguro: { es: 'Seguro', en: 'Insurance' },
  supermercado: { es: 'Supermercado', en: 'Groceries' },
  restaurante: { es: 'Restaurante', en: 'Restaurant' },
  cafe: { es: 'Café', en: 'Coffee' },
  cine: { es: 'Cine', en: 'Cinema' },
  conciertos: { es: 'Conciertos', en: 'Concerts' },
  gasolina: { es: 'Gasolina', en: 'Gas' },
  parking: { es: 'Parking', en: 'Parking' },
  gimnasio: { es: 'Gimnasio', en: 'Gym' },
  limpieza: { es: 'Limpieza', en: 'Cleaning' },
  decoracion: { es: 'Decoración', en: 'Decor' },
  ropa: { es: 'Ropa', en: 'Clothes' },
  electronica: { es: 'Electrónica', en: 'Electronics' },
  salario: { es: 'Salario', en: 'Salary' },
  freelance: { es: 'Freelance', en: 'Freelance' },
  ahorroMensual: { es: 'Ahorro mensual', en: 'Monthly savings' },
  bonoAhorro: { es: 'Bono ahorro', en: 'Savings bonus' },
  retiroEmergencia: { es: 'Retiro emergencia', en: 'Emergency withdrawal' },
} as const satisfies Record<string, Localized>

function name(locale: Locale, key: keyof typeof NAMES): string {
  return NAMES[key][locale]
}

// The six definitions backing the six existing fixed charges (proposal.md "Demo"). Each
// `expectedAmount` equals its charge's current amount and no charge's day or charged state
// changes — "Seguro" is the only one with an end, so its progress is on screen at first load
// without inventing a row.
const RECURRING_DEFINITIONS: {
  id: string
  nameKey: keyof typeof NAMES
  tipo: 'gasto' | 'ingreso'
  categoryId: string | null
  day: number
  expectedAmount: number
  repetitions?: { total: number; done: number }
}[] = [
  { id: 'def-alquiler', nameKey: 'alquiler', tipo: 'gasto', categoryId: 'vivienda', day: 1, expectedAmount: 820 },
  { id: 'def-internet', nameKey: 'internet', tipo: 'gasto', categoryId: 'vivienda', day: 3, expectedAmount: 45 },
  { id: 'def-seguro', nameKey: 'seguro', tipo: 'gasto', categoryId: 'vivienda', day: 8, expectedAmount: 35, repetitions: { total: 10, done: 4 } },
  { id: 'def-parking', nameKey: 'parking', tipo: 'gasto', categoryId: 'transporte', day: 15, expectedAmount: 50 },
  { id: 'def-limpieza', nameKey: 'limpieza', tipo: 'gasto', categoryId: 'hogar', day: 20, expectedAmount: 35 },
  { id: 'def-gimnasio', nameKey: 'gimnasio', tipo: 'gasto', categoryId: 'salud', day: 22, expectedAmount: 40 },
  { id: 'def-salario', nameKey: 'salario', tipo: 'ingreso', categoryId: null, day: 1, expectedAmount: 2400 },
]

export function buildDemoRecurringDefinitions(locale: Locale): RecurringDefinition[] {
  return RECURRING_DEFINITIONS.map((definition) => ({
    id: definition.id,
    name: name(locale, definition.nameKey),
    expectedAmount: definition.expectedAmount,
    tipo: definition.tipo,
    categoryId: definition.categoryId,
    day: definition.day,
    active: true,
    reminder: { active: false, daysBefore: 1 },
    repetitions: definition.repetitions ?? null,
  }))
}

// Budgets are stored for the cycle before the sample's and none for the sample's cycle, so the
// figures on load are the copy (`category-editing` → *Budgets belong to one cycle*).
export function buildDemoBudgetRows(): BudgetRow[] {
  return [
    { categoryId: 'comida', cycle: '2026-08-01', amount: 400 },
    { categoryId: 'ocio', cycle: '2026-08-01', amount: 150 },
    { categoryId: 'transporte', cycle: '2026-08-01', amount: 100 },
  ]
}

function buildCategory(
  locale: Locale,
  id: string,
  nameKey: keyof typeof NAMES,
  color: CategoryColor,
  items: { nameKey: keyof typeof NAMES; amount: number; date: string; fixed?: { definitionId: string; day: number; charged: boolean } }[],
): ExpenseGroup {
  const expenses = items.map((item, index) => ({
    id: `${id}-${index}`,
    name: name(locale, item.nameKey),
    amount: item.amount,
    date: item.date,
    ...(item.fixed ? { fixed: item.fixed } : {}),
  }))
  const total = expenses.reduce((sum, expense) => sum + expense.amount, 0)

  return {
    id,
    kind: 'category',
    name: name(locale, nameKey),
    color,
    total,
    budget: null,
    expenses,
  }
}

export function buildDemoData(locale: Locale): DashboardData {
  const categoryGroups: ExpenseGroup[] = [
    buildCategory(locale, 'vivienda', 'vivienda', 'gris_oscuro', [
      { nameKey: 'alquiler', amount: 820, date: '2026-09-01T09:00:00Z', fixed: { definitionId: 'def-alquiler', day: 1, charged: true } },
      { nameKey: 'internet', amount: 45, date: '2026-09-03T09:00:00Z', fixed: { definitionId: 'def-internet', day: 3, charged: true } },
      { nameKey: 'seguro', amount: 35, date: '2026-09-08T09:00:00Z', fixed: { definitionId: 'def-seguro', day: 8, charged: true } },
    ]),
    buildCategory(locale, 'salud', 'salud', 'verde_profundo', [
      { nameKey: 'gimnasio', amount: 40, date: '2026-09-22T11:00:00Z', fixed: { definitionId: 'def-gimnasio', day: 22, charged: false } },
    ]),
    buildCategory(locale, 'hogar', 'hogar', 'gris_calido', [
      { nameKey: 'limpieza', amount: 35, date: '2026-09-20T10:00:00Z', fixed: { definitionId: 'def-limpieza', day: 20, charged: false } },
      { nameKey: 'decoracion', amount: 60, date: '2026-09-09T10:00:00Z' },
    ]),
    buildCategory(locale, 'comida', 'comida', 'naranja_calido', [
      { nameKey: 'supermercado', amount: 180, date: '2026-09-03T12:00:00Z' },
      { nameKey: 'restaurante', amount: 67.6, date: '2026-09-07T20:00:00Z' },
      { nameKey: 'cafe', amount: 62.4, date: '2026-09-02T23:30:00Z' },
    ]),
    buildCategory(locale, 'ocio', 'ocio', 'violeta_metalico', [
      { nameKey: 'cine', amount: 45, date: '2026-09-05T19:00:00Z' },
      { nameKey: 'conciertos', amount: 85, date: '2026-09-08T21:00:00Z' },
    ]),
    buildCategory(locale, 'transporte', 'transporte', 'azul_apagado', [
      { nameKey: 'gasolina', amount: 80, date: '2026-09-04T08:00:00Z' },
      { nameKey: 'parking', amount: 50, date: '2026-09-15T08:00:00Z', fixed: { definitionId: 'def-parking', day: 15, charged: false } },
    ]),
    buildCategory(locale, 'compras', 'compras', 'granate', [
      { nameKey: 'ropa', amount: 65, date: '2026-09-06T15:00:00Z' },
      { nameKey: 'electronica', amount: 30, date: '2026-09-10T15:00:00Z' },
    ]),
  ]

  const groups = categoryGroups
  const expensesTotal = groups.reduce((sum, group) => sum + group.total, 0)

  const incomeEntries = [
    { id: 'salario', nameKey: 'salario' as const, amount: 2400, date: '2026-09-01T09:00:00Z', recurring: { definitionId: 'def-salario', day: 1 } },
    { id: 'freelance', nameKey: 'freelance' as const, amount: 420, date: '2026-09-05T09:00:00Z' },
  ]
  const incomeTotal = incomeEntries.reduce((sum, entry) => sum + entry.amount, 0)

  const savingsMovements = [
    { id: 'savings-0', nameKey: 'ahorroMensual' as const, date: '2026-09-03T09:00:00Z', amount: 176 },
    { id: 'savings-1', nameKey: 'retiroEmergencia' as const, date: '2026-09-08T09:00:00Z', amount: -80 },
    { id: 'savings-2', nameKey: 'bonoAhorro' as const, date: '2026-09-09T09:00:00Z', amount: 50 },
  ].map((movement) => ({ ...movement, name: name(locale, movement.nameKey) }))
  const savingsCycle = savingsMovements.reduce((sum, movement) => sum + movement.amount, 0)
  const savingsAccumulatedBeforeCycle = 2500

  const savingsHistory = [
    { month: '2026-04', accumulated: 2200 },
    { month: '2026-05', accumulated: 2290 },
    { month: '2026-06', accumulated: 2350 },
    { month: '2026-07', accumulated: 2410 },
    { month: '2026-08', accumulated: savingsAccumulatedBeforeCycle },
    { month: '2026-09', accumulated: savingsAccumulatedBeforeCycle + savingsCycle },
  ]

  const history = [
    { month: '2026-04', total: 1400 },
    { month: '2026-05', total: 1550 },
    { month: '2026-06', total: 1600 },
    { month: '2026-07', total: 1450 },
    { month: '2026-08', total: 1750 },
    { month: '2026-09', total: expensesTotal },
  ]

  // Budgets and the free margin are left out here: deriveDemoData computes them from the budget
  // rows and this date.
  const realToday = new Intl.DateTimeFormat('en-CA', { timeZone: TIMEZONE, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())
  const today = realToday < CYCLE_START ? CYCLE_START : realToday > CYCLE_END ? CYCLE_END : realToday

  const sample: DashboardData = {
    user: {
      name: 'Ana García',
      phone: '+34 611 222 333',
      photoUrl: null,
      currency: 'EUR',
      timezone: TIMEZONE,
    },
    cycle: { start: CYCLE_START, end: CYCLE_END, today, month: '2026-09', inProgress: realToday >= CYCLE_START && realToday <= CYCLE_END },
    freeMargin: 0,
    income: {
      total: incomeTotal,
      entries: incomeEntries.map(({ id, nameKey, amount, date, recurring }) => ({
        id,
        name: name(locale, nameKey),
        amount,
        date,
        ...(recurring ? { recurring } : {}),
      })),
    },
    savings: {
      cycle: savingsCycle,
      accumulated: savingsAccumulatedBeforeCycle + savingsCycle,
      target: 300,
      history: savingsHistory,
      movements: savingsMovements.map(({ id, name: movementName, date, amount }) => ({ id, name: movementName, date, amount })),
    },
    expenses: { total: expensesTotal, groups },
    history,
  }

  return deriveDemoData(
    sample,
    buildDemoRecurringDefinitions(locale),
    buildDemoBudgetRows(),
    noDemoEdits,
    noDemoCategoryEdits,
    noDemoRecurringEdits,
    noDemoIncomeEdits,
    noDemoSavingsEdits,
  ).data
}
