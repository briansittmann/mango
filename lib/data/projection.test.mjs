import { test } from 'node:test'
import assert from 'node:assert/strict'
import { getFreeMargin } from './budget.ts'
import { fechaEnCiclo, mezclarProyeccion, proyectarCiclo } from './projection.ts'

const def = (id, overrides = {}) => ({
  id,
  name: id,
  expectedAmount: 10,
  tipo: 'gasto',
  categoryId: 'deudas',
  day: 1,
  active: true,
  reminder: { active: false, daysBefore: 1 },
  repetitions: null,
  ...overrides,
})
const project = (n, definitions, extra = {}) =>
  proyectarCiclo({ start: '2026-10-01', cyclesAfterGenerated: n, definitions, budgetRows: [], savingsTarget: null, ...extra })
const names = (projection) => projection.charges.map((charge) => charge.name)

// The free margin of a projection: every category's spending is the sum of its projected charges.
function margin(projection, categoryIds) {
  const income = projection.charges.filter((c) => c.tipo === 'ingreso').reduce((sum, c) => sum + c.amount, 0)
  const categories = categoryIds.map((id) => ({
    budget: projection.budgets.get(id) ?? null,
    spent: projection.charges.filter((c) => c.categoryId === id).reduce((sum, c) => sum + c.amount, 0),
  }))
  return getFreeMargin({ income, savings: projection.savings, categories })
}

test('a plan ends inside the horizon: Hacienda 1 of 3 in October and November, not December', () => {
  const hacienda = def('Hacienda', { expectedAmount: 220, day: 7, repetitions: { total: 3, done: 1 } })
  const alquiler = def('Alquiler', { expectedAmount: 1000, categoryId: 'vivienda' })
  const sueldo = def('Sueldo', { tipo: 'ingreso', categoryId: null, expectedAmount: 2600, day: 29 })
  const all = [hacienda, alquiler, sueldo]
  assert.ok(names(project(1, all)).includes('Hacienda'))
  assert.ok(names(project(2, all)).includes('Hacienda'))
  assert.ok(!names(project(3, all)).includes('Hacienda'))
  const cats = ['deudas', 'vivienda']
  assert.equal(margin(project(3, all), cats) - margin(project(2, all), cats), 220)
})

test('a plan that has not started yet: DB Bank 0 of 4 from October to January, not February', () => {
  const dbBank = [def('DB Bank', { expectedAmount: 266, day: 6, repetitions: { total: 4, done: 0 } })]
  for (const n of [1, 2, 3, 4]) assert.deepEqual(names(project(n, dbBank)), ['DB Bank'])
  assert.deepEqual(names(project(5, dbBank)), [])
})

test('projected free margin: 4 000 − 1 000 − 100 − 300 = 2 600', () => {
  const projection = project(1, [
    def('Sueldo', { tipo: 'ingreso', categoryId: null, expectedAmount: 4000 }),
    def('Alquiler', { categoryId: 'vivienda', expectedAmount: 1000 }),
    def('Huel', { categoryId: 'suplementos', expectedAmount: 90 }),
  ], {
    budgetRows: [
      { categoryId: 'suplementos', cycle: '2026-09-01', amount: 100 },
      { categoryId: 'comida', cycle: '2026-09-01', amount: 300 },
    ],
  })
  assert.equal(margin(projection, ['vivienda', 'suplementos', 'comida']), 2600)
})

test('the savings target is the projected savings, 0 without one', () => {
  assert.equal(project(1, []).savings, 0)
  assert.equal(project(1, [], { savingsTarget: 300 }).savings, 300)
})

test('an inactive definition is absent', () => {
  assert.deepEqual(names(project(1, [def('Netflix', { active: false }), def('Spotify')])), ['Spotify'])
})

test('each charge is dated inside the cycle and sorted by date', () => {
  const projection = project(1, [def('Netflix', { day: 14 }), def('Alquiler', { day: 1 })])
  assert.deepEqual(
    projection.charges.map((c) => [c.name, c.date]),
    [['Alquiler', '2026-10-01'], ['Netflix', '2026-10-14']],
  )
})

test('a recurring charge falls on its day inside the cycle', () => {
  assert.equal(fechaEnCiclo('2026-10-01', 14), '2026-10-14')
  // Cycle 26 January – 25 February 2027.
  assert.equal(fechaEnCiclo('2027-01-26', 3), '2027-02-03')
  assert.equal(fechaEnCiclo('2027-01-26', 29), '2027-01-29')
  // A day the month does not have goes to its last day.
  assert.equal(fechaEnCiclo('2026-09-01', 31), '2026-09-30')
  assert.equal(fechaEnCiclo('2027-02-26', 30), '2027-02-28')
  // Across the year boundary.
  assert.equal(fechaEnCiclo('2026-12-26', 5), '2027-01-05')
})

test('budgets are inherited from the latest cycle with rows, markers included', () => {
  const budgetRows = [
    { categoryId: 'comida', cycle: '2026-08-01', amount: 250 },
    { categoryId: 'comida', cycle: '2026-09-01', amount: 300 },
    { categoryId: 'ocio', cycle: '2026-09-01', amount: null },
  ]
  const october = project(1, [], { budgetRows })
  assert.deepEqual([...october.budgets], [['comida', 300], ['ocio', null]])

  const own = project(1, [], { budgetRows: [...budgetRows, { categoryId: 'comida', cycle: '2026-10-01', amount: 500 }] })
  assert.deepEqual([...own.budgets], [['comida', 500]])

  const later = [...budgetRows, { categoryId: 'comida', cycle: '2026-11-01', amount: 700 }]
  assert.deepEqual([...project(1, [], { budgetRows: later }).budgets], [['comida', 300], ['ocio', null]])

  assert.equal(project(1, []).budgets.size, 0)
})

// The margin of a projection with real rows: each category spends its real rows plus the charges
// `mezclarProyeccion` keeps, and savings are max(target, Σ movements) (D4).
function mergedMargin(projection, { start = '2026-10-01', expenses = [], income = [], savings = [], categoryIds, target }) {
  const rows = [...expenses, ...income].map((r) => ({ definitionId: r.definitionId ?? null, cycle: r.cycle ?? null }))
  const charges = mezclarProyeccion({ charges: projection.charges, rows, start })
  const incomeTotal =
    charges.filter((c) => c.tipo === 'ingreso').reduce((sum, c) => sum + c.amount, 0) + income.reduce((sum, r) => sum + r.amount, 0)
  const categories = categoryIds.map((id) => ({
    budget: projection.budgets.get(id) ?? null,
    spent:
      charges.filter((c) => c.tipo === 'gasto' && c.categoryId === id).reduce((sum, c) => sum + c.amount, 0) +
      expenses.filter((r) => r.categoryId === id).reduce((sum, r) => sum + r.amount, 0),
  }))
  const savingsTotal = Math.max(target ?? 0, savings.reduce((sum, amount) => sum + amount, 0))
  return getFreeMargin({ income: incomeTotal, savings: savingsTotal, categories })
}

const luz = { definitionId: 'Luz', tipo: 'gasto', categoryId: 'hogar', name: 'Luz', amount: 90, date: '2026-10-05' }
const netflix = { definitionId: 'Netflix', tipo: 'gasto', categoryId: 'ocio', name: 'Netflix', amount: 13, date: '2026-10-14' }

test('a linked row replaces its projected charge', () => {
  const kept = mezclarProyeccion({ charges: [luz, netflix], rows: [{ definitionId: 'Luz', cycle: '2026-10-01' }], start: '2026-10-01' })
  assert.deepEqual(kept.map((c) => c.name), ['Netflix'])
})

test('a linked row for another cycle removes nothing', () => {
  const kept = mezclarProyeccion({ charges: [luz, netflix], rows: [{ definitionId: 'Luz', cycle: '2026-09-01' }], start: '2026-10-01' })
  assert.deepEqual(kept, [luz, netflix])
})

test('a manual row removes nothing', () => {
  const kept = mezclarProyeccion({ charges: [luz, netflix], rows: [{ definitionId: null, cycle: null }], start: '2026-10-01' })
  assert.deepEqual(kept, [luz, netflix])
})

test('no rows returns every charge', () => {
  assert.deepEqual(mezclarProyeccion({ charges: [luz, netflix], rows: [], start: '2026-10-01' }), [luz, netflix])
})

test('a real expense joins the projection: 4 000 − 1 000 − 120 − 300 = 2 580', () => {
  const projection = project(1, [
    def('Sueldo', { tipo: 'ingreso', categoryId: null, expectedAmount: 4000 }),
    def('Alquiler', { categoryId: 'vivienda', expectedAmount: 1000 }),
    def('Huel', { categoryId: 'suplementos', expectedAmount: 90 }),
  ], {
    budgetRows: [
      { categoryId: 'suplementos', cycle: '2026-09-01', amount: 100 },
      { categoryId: 'comida', cycle: '2026-09-01', amount: 300 },
    ],
  })
  const expenses = [
    { categoryId: 'comida', amount: 250 },
    { categoryId: 'suplementos', amount: 30 },
  ]
  assert.equal(mergedMargin(projection, { expenses, categoryIds: ['vivienda', 'suplementos', 'comida'] }), 2580)
})

test('a real income entry and a savings movement join the projection: 4 300, then 4 150', () => {
  const projection = project(1, [def('Sueldo', { tipo: 'ingreso', categoryId: null, expectedAmount: 4000 })], { savingsTarget: 200 })
  const income = [{ amount: 500 }]
  assert.equal(mergedMargin(projection, { income, savings: [50], categoryIds: [], target: 200 }), 4300)
  assert.equal(mergedMargin(projection, { income, savings: [350], categoryIds: [], target: 200 }), 4150)
})
