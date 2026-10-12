import { test } from 'node:test'
import assert from 'node:assert/strict'
import { groupByDay, userMovements } from './movements.ts'

const group = (id, expenses) => ({
  id,
  kind: 'category',
  name: id,
  color: 'naranja_calido',
  total: expenses.reduce((sum, e) => sum + e.amount, 0),
  budget: null,
  expenses,
  rowsLater: 0,
  showProgress: true,
})
const row = (id, amount, date, extra = {}) => ({ id, name: id, amount, date, ...extra })
const fixed = (definitionId, charged = true) => ({ fixed: { definitionId, day: 1, charged } })

// The demo's cycle (lib/demo/demo-data.ts), Europe/Dublin.
const demo = {
  expenses: {
    total: 0,
    groups: [
      group('vivienda', [
        row('Alquiler', 820, '2026-09-01T09:00:00Z', fixed('def-alquiler')),
        row('Internet', 45, '2026-09-03T09:00:00Z', fixed('def-internet')),
        row('Seguro', 35, '2026-09-08T09:00:00Z', fixed('def-seguro')),
      ]),
      group('salud', [row('Gimnasio', 40, '2026-09-22T11:00:00Z', fixed('def-gimnasio', false))]),
      group('hogar', [row('Limpieza', 35, '2026-09-20T10:00:00Z', fixed('def-limpieza', false)), row('Decoración', 60, '2026-09-09T10:00:00Z')]),
      group('comida', [
        row('Supermercado', 180, '2026-09-03T12:00:00Z'),
        row('Restaurante', 67.6, '2026-09-07T20:00:00Z'),
        row('Café', 62.4, '2026-09-02T23:30:00Z'),
      ]),
      group('ocio', [row('Cine', 45, '2026-09-05T19:00:00Z'), row('Conciertos', 85, '2026-09-08T21:00:00Z')]),
      group('transporte', [row('Gasolina', 80, '2026-09-04T08:00:00Z'), row('Parking', 50, '2026-09-15T08:00:00Z', fixed('def-parking', false))]),
      group('compras', [row('Ropa', 65, '2026-09-06T15:00:00Z'), row('Electrónica', 30, '2026-09-10T15:00:00Z')]),
    ],
  },
  income: {
    total: 0,
    history: [],
    entries: [
      row('Salario', 2400, '2026-09-01T09:00:00Z', { recurring: { definitionId: 'def-salario', day: 1 } }),
      row('Freelance', 420, '2026-09-05T09:00:00Z'),
    ],
  },
  savings: {
    cycle: 0,
    accumulated: 0,
    target: null,
    history: [],
    movements: [
      row('Ahorro mensual', 176, '2026-09-03T09:00:00Z'),
      row('Retiro emergencia', -80, '2026-09-08T09:00:00Z'),
      row('Bono ahorro', 50, '2026-09-09T09:00:00Z'),
    ],
  },
}

test("the demo's thirteen movements, newest first, without fixed or recurring rows", () => {
  const movements = userMovements(demo, 'Europe/Dublin')
  assert.deepEqual(
    movements.map((m) => m.name),
    [
      'Electrónica',
      'Decoración',
      'Bono ahorro',
      'Conciertos',
      'Retiro emergencia',
      'Restaurante',
      'Ropa',
      'Cine',
      'Freelance',
      'Gasolina',
      'Supermercado',
      'Ahorro mensual',
      'Café',
    ],
  )
  assert.deepEqual(
    movements.map((m) => m.kind),
    ['expense', 'expense', 'savings', 'expense', 'savings', 'expense', 'expense', 'expense', 'income', 'expense', 'expense', 'savings', 'expense'],
  )
  assert.equal(movements[0].key, 'expense:Electrónica')
  assert.equal(movements[0].group.id, 'compras')
})

test('a row at the day boundary counts on its local day', () => {
  const cafe = userMovements(demo, 'Europe/Dublin').find((m) => m.name === 'Café')
  assert.equal(cafe.day, '2026-09-03')
  assert.equal(userMovements(demo, 'UTC').find((m) => m.name === 'Café').day, '2026-09-02')
})

test('projected charges and projected income are left out', () => {
  const data = {
    expenses: { total: 0, groups: [group('comida', [row('proj:def-a', 10, '2026-11-01T00:00:00Z', { projected: true }), row('Super', 5, '2026-11-02T00:00:00Z')])] },
    income: { total: 0, history: [], entries: [row('proj:def-s', 2400, '2026-11-01T00:00:00Z', { projected: true, recurring: { definitionId: 'def-s', day: 1 } })] },
    savings: { cycle: 0, accumulated: 0, target: null, history: [], movements: [] },
  }
  assert.deepEqual(userMovements(data, 'UTC').map((m) => m.name), ['Super'])
})

test('ties keep input order: expenses, then income, then savings', () => {
  const at = '2026-09-05T00:00:00Z'
  const data = {
    expenses: { total: 0, groups: [group('a', [row('e1', 1, at)]), group('b', [row('e2', 1, at)])] },
    income: { total: 0, history: [], entries: [row('i1', 1, at)] },
    savings: { cycle: 0, accumulated: 0, target: null, history: [], movements: [row('s1', 1, at)] },
  }
  assert.deepEqual(userMovements(data, 'UTC').map((m) => m.name), ['e1', 'e2', 'i1', 's1'])
})

test('days are grouped in order with today and yesterday labelled', () => {
  const data = {
    expenses: { total: 0, groups: [group('a', [row('hoy', 1, '2026-09-22T10:00:00Z'), row('ayer', 1, '2026-09-21T10:00:00Z'), row('antes', 1, '2026-09-10T10:00:00Z'), row('hoy2', 1, '2026-09-22T08:00:00Z')])] },
    income: { total: 0, history: [], entries: [] },
    savings: { cycle: 0, accumulated: 0, target: null, history: [], movements: [] },
  }
  const days = groupByDay(userMovements(data, 'UTC'), '2026-09-22')
  assert.deepEqual(
    days.map((d) => [d.day, d.label, d.items.map((m) => m.name)]),
    [
      ['2026-09-22', 'today', ['hoy', 'hoy2']],
      ['2026-09-21', 'yesterday', ['ayer']],
      ['2026-09-10', null, ['antes']],
    ],
  )
})

test("the demo's first days", () => {
  const days = groupByDay(userMovements(demo, 'Europe/Dublin'), '2026-09-30')
  assert.equal(days.length, 8)
  assert.deepEqual(days.slice(0, 3).map((d) => [d.day, d.items.map((m) => m.name)]), [
    ['2026-09-10', ['Electrónica']],
    ['2026-09-09', ['Decoración', 'Bono ahorro']],
    ['2026-09-08', ['Conciertos', 'Retiro emergencia']],
  ])
  assert.deepEqual(days.at(-1).items.map((m) => m.name), ['Supermercado', 'Ahorro mensual', 'Café'])
})
