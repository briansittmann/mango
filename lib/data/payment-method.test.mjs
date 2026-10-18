import { test } from 'node:test'
import assert from 'node:assert/strict'
import { countedRows, paymentMethodsOffered, pocketBalances, pocketRows } from './payment-method.ts'

const tz = 'Europe/Madrid'
const cycle = { start: '2026-09-01', end: '2026-09-30', today: '2026-09-15' }
const at = (day) => `${day}T12:00:00Z`
const row = (kind, amount, day, paymentMethod, extra = {}) => ({ kind, amount, date: at(day), paymentMethod, ...extra })
const balances = (rows, transfers = [], c = cycle) => pocketBalances({ rows, transfers, cycle: c, timeZone: tz })
const transfer = (id, amount, into, day) => ({ id, amount, into, date: at(day) })

test('income adds to its pocket, an expense subtracts', () => {
  const { efectivo, tarjeta } = balances([row('income', 150, '2026-09-02', 'efectivo'), row('expense', 40, '2026-09-03', 'efectivo'), row('expense', 12, '2026-09-04', 'tarjeta')])
  assert.deepEqual(efectivo, { balance: 110, cameIn: 150, wentOut: 40 })
  assert.deepEqual(tarjeta, { balance: -12, cameIn: 0, wentOut: 12 })
})

test('a withdrawal moves card into cash', () => {
  const { efectivo, tarjeta } = balances([], [transfer('t', 200, 'efectivo', '2026-09-05')])
  assert.deepEqual(efectivo, { balance: 200, cameIn: 200, wentOut: 0 })
  assert.deepEqual(tarjeta, { balance: -200, cameIn: 0, wentOut: 200 })
})

test('a deposit moves cash into card', () => {
  const { efectivo, tarjeta } = balances([row('income', 120, '2026-09-01', 'efectivo')], [transfer('t', 120, 'tarjeta', '2026-09-02')])
  assert.deepEqual(efectivo, { balance: 0, cameIn: 120, wentOut: 120 })
  assert.deepEqual(tarjeta, { balance: 120, cameIn: 120, wentOut: 0 })
})

test('a pending charge does not count until it is taken', () => {
  const luz = (charged) => row('expense', 72, '2026-09-20', 'tarjeta', { charged })
  assert.equal(balances([luz(false)]).tarjeta.balance, 0)
  assert.equal(balances([luz(true)]).tarjeta.balance, -72)
})

test('a charge marked not charged after its day does not count', () => {
  // The caller computes `charged` with the dashboard's rule: day passed but `no_cobrado` → false.
  assert.equal(balances([row('expense', 50, '2026-09-10', 'tarjeta', { charged: false })]).tarjeta.balance, 0)
})

test('a one-off row or a transfer dated after today does not count yet', () => {
  const { efectivo, tarjeta } = balances([row('expense', 30, '2026-09-16', 'efectivo')], [transfer('t', 50, 'efectivo', '2026-09-20')])
  assert.deepEqual(efectivo, { balance: 0, cameIn: 0, wentOut: 0 })
  assert.deepEqual(tarjeta, { balance: 0, cameIn: 0, wentOut: 0 })
})

test('earlier cycles count in the balance, not in came in or went out', () => {
  const { efectivo } = balances([row('income', 300, '2026-08-10', 'efectivo'), row('expense', 80, '2026-09-10', 'efectivo')])
  assert.deepEqual(efectivo, { balance: 220, cameIn: 0, wentOut: 80 })
})

test('rows with no method count nowhere', () => {
  const { efectivo, tarjeta } = balances([row('expense', 30, '2026-09-10', null), row('income', 100, '2026-09-10', null)])
  assert.equal(efectivo.balance, 0)
  assert.equal(tarjeta.balance, 0)
})

test('deleted and projected rows count nowhere', () => {
  const { efectivo } = balances([
    row('expense', 30, '2026-09-10', 'efectivo', { deleted: true }),
    row('expense', 20, '2026-09-10', 'efectivo', { projected: true, charged: true }),
  ])
  assert.deepEqual(efectivo, { balance: 0, cameIn: 0, wentOut: 0 })
})

test('a balance may be negative', () => {
  assert.equal(balances([row('expense', 15, '2026-09-10', 'efectivo')]).efectivo.balance, -15)
})

test('a past cycle shows the balance at its last day', () => {
  const past = { start: '2026-08-01', end: '2026-08-31', today: '2026-08-31' }
  const { efectivo } = balances([row('income', 300, '2026-08-10', 'efectivo'), row('expense', 40, '2026-08-31', 'efectivo')], [], past)
  assert.deepEqual(efectivo, { balance: 260, cameIn: 300, wentOut: 40 })
})

const expense = (id, amount, day, paymentMethod, extra = {}) => ({ id, name: id, amount, date: at(day), paymentMethod, ...extra })
const group = (expenses) => ({ id: 'ocio', kind: 'category', name: 'Ocio', color: 'rojo', total: 0, budget: null, expenses, rowsLater: 0, showProgress: true })

test('countedRows carries the charged flag of recurring rows only', () => {
  const rows = countedRows(
    [group([expense('Cine', 45, '2026-09-12', 'efectivo'), expense('Gym', 50, '2026-09-20', 'tarjeta', { fixed: { definitionId: 'g', day: 20, charged: false } })])],
    [{ id: 'Sueldo', name: 'Sueldo', amount: 2000, date: at('2026-09-01'), paymentMethod: 'tarjeta', recurring: { definitionId: 's', day: 1, charged: true } }],
  )
  assert.deepEqual(
    rows.map((r) => [r.kind, r.amount, r.charged]),
    [
      ['expense', 45, undefined],
      ['expense', 50, false],
      ['income', 2000, true],
    ],
  )
})

test('pocketRows lists the counted rows of one pocket and every transfer, newest first', () => {
  const rows = pocketRows({
    method: 'efectivo',
    groups: [group([expense('Café', 62.4, '2026-09-03', 'efectivo'), expense('Cine', 45, '2026-09-12', 'efectivo'), expense('Bar', 9, '2026-09-13', 'tarjeta'), expense('Taxi', 7, '2026-09-25', 'efectivo')])],
    entries: [{ id: 'Propina', name: 'Propina', amount: 20, date: at('2026-09-14'), paymentMethod: 'tarjeta' }],
    transfers: [transfer('t', 100, 'efectivo', '2026-09-04')],
    today: '2026-09-15',
    timeZone: tz,
  })
  assert.deepEqual(rows.map((r) => r.key), ['expense:Cine', 'transfer:t', 'expense:Café'])
})

test('offered by country unless the admin switch says otherwise', () => {
  for (const country of ['AR', 'UY', 'MX', 'CO']) assert.equal(paymentMethodsOffered(country, null), true, country)
  for (const country of ['ES', 'IE', null, undefined]) assert.equal(paymentMethodsOffered(country, null), false, String(country))
  assert.equal(paymentMethodsOffered('ES', true), true)
  assert.equal(paymentMethodsOffered(null, true), true)
  assert.equal(paymentMethodsOffered('AR', false), false)
})
