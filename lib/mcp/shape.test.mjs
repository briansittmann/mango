import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fixedChargesOf, movementsOf, summaryOf } from './shape.ts'
import { maxMonthOf, resolveMonth } from './months.ts'

const definition = (id, extra = {}) => ({
  id,
  name: id,
  expectedAmount: 50,
  tipo: 'gasto',
  categoryId: 'vivienda',
  day: 5,
  active: true,
  reminder: { active: false, daysBefore: 1 },
  repetitions: null,
  cardId: null,
  paymentMethod: null,
  ...extra,
})

function fixture({ projected = false, pockets = null } = {}) {
  return {
    user: { name: 'B', phone: null, photoUrl: null, currency: 'EUR', timezone: 'Europe/Madrid', widgetOrder: [], defaultPaymentMethod: null, hasMarkedMovements: false, paymentMethodsOffered: false },
    cycle: { start: '2026-09-28', end: '2026-10-27', today: '2026-10-19', month: '2026-10', inProgress: !projected, projected, currentMonth: '2026-10', maxMonth: '2027-04' },
    freeMargin: 864.004,
    income: {
      total: 2100,
      entries: [
        { id: 'sueldo-row', name: 'Sueldo', amount: 2000, date: '2026-09-28T12:00:00Z', paymentMethod: null, recurring: { definitionId: 'sueldo', day: 28, charged: true } },
        { id: 'propina', name: 'Propina', amount: 100, date: '2026-10-02T12:00:00Z', paymentMethod: 'efectivo' },
      ],
      history: [],
    },
    savings: {
      cycle: 50,
      accumulated: 400.1,
      target: null,
      history: [],
      movements: [
        { id: 'dep', name: 'Hucha', date: '2026-10-01T12:00:00Z', amount: 80, alreadySaved: true },
        { id: 'ret', name: 'Viaje', date: '2026-10-03T12:00:00Z', amount: -30 },
      ],
    },
    expenses: {
      total: 870.5,
      groups: [
        {
          id: 'vivienda', kind: 'category', name: 'Vivienda', color: 'azul_apagado', total: 820, rowsLater: 0, showProgress: true,
          budget: null,
          expenses: [
            projected
              ? { id: 'proj:alquiler', name: 'Alquiler', amount: 820, date: '2026-10-01T12:00:00Z', paymentMethod: null, fixed: { definitionId: 'alquiler', day: 1, charged: false }, projected: true }
              : { id: 'alquiler-row', name: 'Alquiler', amount: 820, date: '2026-10-01T12:00:00Z', paymentMethod: null, fixed: { definitionId: 'alquiler', day: 1, charged: true } },
          ],
        },
        {
          id: 'comida', kind: 'category', name: 'Comida', color: 'naranja_calido', total: 50.5, rowsLater: 2, showProgress: false,
          budget: { amount: 300, spent: 50.5, usage: 0.17, level: 'ok', remaining: 249.5, daysLeft: 8, weeklyAllowance: 218 },
          // 23:30 UTC on the 18th is already the 19th in Madrid.
          expenses: [{ id: 'cafe', name: 'Café', amount: 50.5, date: '2026-10-18T23:30:00Z', paymentMethod: 'tarjeta' }],
        },
      ],
    },
    history: [],
    cards: [{ id: 'visa', name: 'Visa', color: 'rojo' }],
    pockets,
  }
}

const definitions = [
  definition('alquiler', { expectedAmount: 820, day: 1, cardId: 'visa', reminder: { active: true, daysBefore: 2 }, repetitions: { total: 12, done: 4 } }),
  definition('luz', { categoryId: 'ended-category' }),
  definition('gimnasio', { active: false }),
  definition('sueldo', { tipo: 'ingreso', categoryId: null, expectedAmount: 2000, day: 28 }),
]

test('summary carries the dashboard figures, rounded, and the currency once', () => {
  const summary = summaryOf(fixture(), definitions)
  assert.equal(summary.currency, 'EUR')
  assert.equal(summary.free_margin, 864)
  assert.equal(summary.savings.accumulated, 400.1)
  assert.deepEqual(summary.cycle, { month: '2026-10', start: '2026-09-28', end: '2026-10-27', in_progress: true, projected: false })
  assert.deepEqual(summary.categories.map((c) => c.id), ['vivienda', 'comida'])
  assert.deepEqual(summary.categories[1].budget, { amount: 300, spent: 50.5, remaining: 249.5 })
  assert.equal(summary.categories[1].show_progress, false)
  assert.deepEqual(summary.cards, [{ id: 'visa', name: 'Visa', color: 'rojo', committed_total: 820, fixed_charges: 1 }])
  assert.equal(JSON.stringify(summary).match(/"currency"/g).length, 1)
})

test('pockets only when the dashboard has them', () => {
  assert.equal('pockets' in summaryOf(fixture(), definitions), false)
  const pockets = { efectivo: { balance: 142.6, cameIn: 150, wentOut: 7.4 }, tarjeta: { balance: 1492.4, cameIn: 2000, wentOut: 507.6 }, transfers: [] }
  assert.deepEqual(summaryOf(fixture({ pockets }), definitions).pockets.efectivo, { balance: 142.6, came_in: 150, went_out: 7.4 })
})

test('movements list every kind, newest first, with local dates', () => {
  const pockets = { efectivo: { balance: 0, cameIn: 0, wentOut: 0 }, tarjeta: { balance: 0, cameIn: 0, wentOut: 0 }, transfers: [{ id: 't1', amount: 100, into: 'efectivo', date: '2026-10-04T12:00:00Z' }] }
  const { movements } = movementsOf(fixture({ pockets }))
  assert.deepEqual(movements.map((m) => m.id), ['cafe', 't1', 'ret', 'propina', 'alquiler-row', 'dep', 'sueldo-row'])
  const cafe = movements[0]
  assert.equal(cafe.date, '2026-10-19')
  assert.deepEqual(cafe.category, { id: 'comida', name: 'Comida' })
  assert.equal(cafe.payment_method, 'tarjeta')
  assert.deepEqual(movements.find((m) => m.id === 'ret'), { id: 'ret', kind: 'savings', description: 'Viaje', amount: 30, date: '2026-10-03', cycle_month: '2026-10', direction: 'withdrawal' })
  assert.equal(movements.find((m) => m.id === 'dep').already_saved, true)
  assert.deepEqual(movements.find((m) => m.id === 'alquiler-row').fixed, { definition_id: 'alquiler', charged: true, projected: false })
  assert.equal(movements.find((m) => m.id === 't1').into, 'efectivo')
})

test('a kind filter keeps only that kind', () => {
  assert.deepEqual(movementsOf(fixture(), 'income').movements.map((m) => m.id), ['propina', 'sueldo-row'])
})

test('a projected cycle lists its charges with proj: ids and is marked projected', () => {
  const { cycle, movements } = movementsOf(fixture({ projected: true }), 'expense')
  assert.equal(cycle.projected, true)
  const charge = movements.find((m) => m.id === 'proj:alquiler')
  assert.deepEqual(charge.fixed, { definition_id: 'alquiler', charged: false, projected: true })
})

test('fixed charges list every definition with its row of the month', () => {
  const { fixed_charges: list } = fixedChargesOf(fixture(), definitions, new Set(['luz']))
  const alquiler = list.find((d) => d.id === 'alquiler')
  assert.deepEqual(alquiler.this_month, { id: 'alquiler-row', name: 'Alquiler', amount: 820, date: '2026-10-01', category_id: 'vivienda', payment_method: null, charged: true, projected: false, deleted: false })
  assert.deepEqual(alquiler.card, { id: 'visa', name: 'Visa', color: 'rojo' })
  assert.equal(alquiler.reminder_days_before, 2)
  assert.deepEqual(alquiler.repetitions, { total: 12, done: 4 })
  assert.deepEqual(list.find((d) => d.id === 'luz').this_month, { deleted: true })
  assert.deepEqual(list.find((d) => d.id === 'luz').category, { id: 'ended-category', name: null })
  assert.equal(list.find((d) => d.id === 'gimnasio').active, false)
  assert.equal(list.find((d) => d.id === 'gimnasio').this_month, null)
  const sueldo = list.find((d) => d.id === 'sueldo')
  assert.equal(sueldo.kind, 'income')
  assert.equal(sueldo.category, null)
  assert.equal(sueldo.this_month.charged, true)
})

test('months: default, range and the fixed-charge rule', () => {
  const bounds = { current: '2026-10', first: '2026-08' }
  assert.equal(resolveMonth(undefined, bounds), '2026-10')
  assert.equal(resolveMonth('2026-08', bounds), '2026-08')
  assert.equal(maxMonthOf('2026-10'), '2027-04')
  assert.equal(resolveMonth('2027-04', bounds), '2027-04')
  assert.throws(() => resolveMonth('2027-05', bounds), { code: 'out-of-range' })
  assert.throws(() => resolveMonth('2026-07', bounds), { code: 'out-of-range' })
  assert.throws(() => resolveMonth('2026-13', bounds), { code: 'invalid-input' })
  assert.throws(() => resolveMonth('2026-09', bounds, { fromCurrent: true }), { code: 'out-of-range' })
  assert.equal(resolveMonth('2026-11', bounds, { fromCurrent: true }), '2026-11')
  // An account with no movement yet still has its cycle in progress.
  assert.equal(resolveMonth('2026-10', { current: '2026-10', first: '2026-12' }), '2026-10')
})
