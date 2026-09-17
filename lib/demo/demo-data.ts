import { getBudgetStatus } from '@/lib/data/budget'
import type { CategoryColor, DashboardData, ExpenseGroup } from '@/lib/data/dashboard'
import { deriveDemoData, noDemoEdits } from '@/lib/demo/demo-expenses'
import { noDemoCategoryEdits } from '@/lib/demo/demo-categories'

type Locale = 'es' | 'en'
type Localized = { es: string; en: string }

const CURRENT_DAY = 10
const CYCLE_DAYS = 30
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

function buildCategory(
  locale: Locale,
  id: string,
  nameKey: keyof typeof NAMES,
  color: CategoryColor,
  amount: number | null,
  items: { nameKey: keyof typeof NAMES; amount: number; date: string; fixed?: { day: number; charged: boolean } }[],
): ExpenseGroup {
  const expenses = items.map((item, index) => ({
    id: `${id}-${index}`,
    name: name(locale, item.nameKey),
    amount: item.amount,
    date: item.date,
    ...(item.fixed ? { fixed: item.fixed } : {}),
  }))
  const spent = expenses.reduce((sum, expense) => sum + expense.amount, 0)

  return {
    id,
    kind: 'category',
    name: name(locale, nameKey),
    color,
    total: spent,
    budget: amount != null ? getBudgetStatus({ amount, spent, currentDay: CURRENT_DAY, cycleDays: CYCLE_DAYS }) : null,
    expenses,
  }
}

export function buildDemoData(locale: Locale): DashboardData {
  const categoryGroups: ExpenseGroup[] = [
    buildCategory(locale, 'vivienda', 'vivienda', 'gris_oscuro', null, [
      { nameKey: 'alquiler', amount: 820, date: '2026-09-01T09:00:00Z', fixed: { day: 1, charged: true } },
      { nameKey: 'internet', amount: 45, date: '2026-09-03T09:00:00Z', fixed: { day: 3, charged: true } },
      { nameKey: 'seguro', amount: 35, date: '2026-09-08T09:00:00Z', fixed: { day: 8, charged: true } },
    ]),
    buildCategory(locale, 'comida', 'comida', 'naranja_calido', 400, [
      { nameKey: 'supermercado', amount: 180, date: '2026-09-03T12:00:00Z' },
      { nameKey: 'restaurante', amount: 67.6, date: '2026-09-07T20:00:00Z' },
      { nameKey: 'cafe', amount: 62.4, date: '2026-09-02T23:30:00Z' },
    ]),
    buildCategory(locale, 'ocio', 'ocio', 'violeta_metalico', 150, [
      { nameKey: 'cine', amount: 45, date: '2026-09-05T19:00:00Z' },
      { nameKey: 'conciertos', amount: 85, date: '2026-09-08T21:00:00Z' },
    ]),
    buildCategory(locale, 'transporte', 'transporte', 'azul_apagado', 100, [
      { nameKey: 'gasolina', amount: 80, date: '2026-09-04T08:00:00Z' },
      { nameKey: 'parking', amount: 50, date: '2026-09-15T08:00:00Z', fixed: { day: 15, charged: false } },
    ]),
    buildCategory(locale, 'salud', 'salud', 'verde_profundo', 120, [
      { nameKey: 'gimnasio', amount: 40, date: '2026-09-22T11:00:00Z', fixed: { day: 22, charged: false } },
    ]),
    buildCategory(locale, 'hogar', 'hogar', 'gris_calido', 200, [
      { nameKey: 'limpieza', amount: 35, date: '2026-09-20T10:00:00Z', fixed: { day: 20, charged: false } },
      { nameKey: 'decoracion', amount: 60, date: '2026-09-09T10:00:00Z' },
    ]),
    buildCategory(locale, 'compras', 'compras', 'granate', 180, [
      { nameKey: 'ropa', amount: 65, date: '2026-09-06T15:00:00Z' },
      { nameKey: 'electronica', amount: 30, date: '2026-09-10T15:00:00Z' },
    ]),
  ]

  const groups = categoryGroups
  const expensesTotal = groups.reduce((sum, group) => sum + group.total, 0)

  const incomeSources = [
    { id: 'salario', nameKey: 'salario' as const, estimated: 2400, actual: 2400 },
    { id: 'freelance', nameKey: 'freelance' as const, estimated: 500, actual: 420 },
  ]
  const incomeTotal = incomeSources.reduce((sum, source) => sum + source.actual, 0)

  const savingsMovements = [
    { id: 'savings-0', nameKey: 'ahorroMensual' as const, date: '2026-09-03T09:00:00Z', amount: 176 },
    { id: 'savings-1', nameKey: 'retiroEmergencia' as const, date: '2026-09-08T09:00:00Z', amount: -80 },
    { id: 'savings-2', nameKey: 'bonoAhorro' as const, date: '2026-09-09T09:00:00Z', amount: 50 },
  ].map((movement) => ({ ...movement, name: name(locale, movement.nameKey) }))
  const savingsCycle = savingsMovements.reduce((sum, movement) => sum + movement.amount, 0)
  const savingsAccumulatedBeforeCycle = 2500

  const history = [
    { month: '2026-04', total: 1400 },
    { month: '2026-05', total: 1550 },
    { month: '2026-06', total: 1600 },
    { month: '2026-07', total: 1450 },
    { month: '2026-08', total: 1750 },
    { month: '2026-09', total: expensesTotal },
  ]

  // The budgets built above are placeholders: deriveDemoData recomputes them all from this date.
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
    freeMargin: incomeTotal - expensesTotal - savingsCycle,
    income: {
      total: incomeTotal,
      sources: incomeSources.map(({ id, nameKey, estimated, actual }) => ({
        id,
        name: name(locale, nameKey),
        estimated,
        actual,
      })),
    },
    savings: {
      cycle: savingsCycle,
      accumulated: savingsAccumulatedBeforeCycle + savingsCycle,
      movements: savingsMovements.map(({ id, name: movementName, date, amount }) => ({ id, name: movementName, date, amount })),
    },
    expenses: { total: expensesTotal, groups },
    history,
  }

  return deriveDemoData(sample, noDemoEdits, noDemoCategoryEdits)
}
