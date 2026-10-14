import { test } from 'node:test'
import assert from 'node:assert/strict'
import { dueReminders, reminderParams } from './reminders.ts'

const plain = (text) => text.replace(/\s/g, ' ')

const gimnasio = {
  id: 'gym',
  name: 'Gimnasio',
  expectedAmount: 30,
  tipo: 'gasto',
  categoryId: 'salud',
  day: 1,
  active: true,
  reminder: { active: true, daysBefore: 1 },
  repetitions: null,
  remindedFor: null,
}
// Brian's cycle starts on the 28th: day 1 falls in the next month, inside the same cycle.
const october = [{ start: '2026-10-28', cyclesAfterGenerated: 0 }]
const due = (today, definitions, { cycles = october, rows = [] } = {}) => dueReminders({ today, definitions, cycles, rows })

test('a projected charge is reminded from daysBefore days ahead until its day', () => {
  assert.deepEqual(due('2026-10-30', [gimnasio]), [])
  assert.deepEqual(due('2026-10-31', [gimnasio]), [
    { definitionId: 'gym', name: 'Gimnasio', amount: 30, date: '2026-11-01', remindedFor: null },
  ])
  assert.equal(due('2026-11-01', [gimnasio]).length, 1)
  assert.equal(due('2026-11-01', [{ ...gimnasio, reminder: { active: true, daysBefore: 0 } }]).length, 1)
  assert.deepEqual(due('2026-10-31', [{ ...gimnasio, reminder: { active: true, daysBefore: 0 } }]), [])
})

test('the marker keeps it to one reminder per charge', () => {
  assert.deepEqual(due('2026-11-01', [{ ...gimnasio, remindedFor: '2026-11-01' }]), [])
  assert.equal(due('2026-11-01', [{ ...gimnasio, remindedFor: '2026-10-01' }])[0].remindedFor, '2026-10-01')
})

test('the slot row replaces the projection: its amount and day while pending, nothing once paid or deleted', () => {
  const row = { definitionId: 'gym', cycle: '2026-10-28', pending: true, amount: 35, date: '2026-11-02' }
  assert.deepEqual(due('2026-11-01', [gimnasio], { rows: [row] }), [
    { definitionId: 'gym', name: 'Gimnasio', amount: 35, date: '2026-11-02', remindedFor: null },
  ])
  assert.deepEqual(due('2026-10-31', [gimnasio], { rows: [{ ...row, pending: false, date: '2026-11-01' }] }), [])
  // A row of another cycle holds nothing in this one.
  assert.equal(due('2026-10-31', [gimnasio], { rows: [{ ...row, cycle: '2026-09-28' }] }).length, 1)
})

test('only active expense definitions with the reminder on', () => {
  assert.deepEqual(due('2026-10-31', [{ ...gimnasio, active: false }]), [])
  assert.deepEqual(due('2026-10-31', [{ ...gimnasio, reminder: { active: false, daysBefore: 1 } }]), [])
  assert.deepEqual(due('2026-10-31', [{ ...gimnasio, tipo: 'ingreso', categoryId: null }]), [])
})

test('a plan already over is not reminded', () => {
  const cuotas = { ...gimnasio, repetitions: { total: 3, done: 3 } }
  assert.equal(due('2026-10-31', [cuotas]).length, 1)
  const next = [{ start: '2026-11-28', cyclesAfterGenerated: 1 }]
  assert.deepEqual(due('2026-11-30', [cuotas], { cycles: next }), [])
  assert.equal(due('2026-11-30', [gimnasio], { cycles: next }).length, 1)
})

test('a charge of the next cycle is reminded before that cycle is generated', () => {
  const alquiler = { ...gimnasio, id: 'alquiler', name: 'Alquiler', expectedAmount: 820, day: 28, reminder: { active: true, daysBefore: 3 } }
  const cycles = [...october, { start: '2026-11-28', cyclesAfterGenerated: 1 }]
  assert.deepEqual(due('2026-11-26', [alquiler], { cycles }), [
    { definitionId: 'alquiler', name: 'Alquiler', amount: 820, date: '2026-11-28', remindedFor: null },
  ])
})

test('with two charges in the window, the earliest goes first', () => {
  const lejos = { ...gimnasio, reminder: { active: true, daysBefore: 40 } }
  const cycles = [...october, { start: '2026-11-28', cyclesAfterGenerated: 1 }]
  assert.equal(due('2026-10-29', [lejos], { cycles })[0].date, '2026-11-01')
  assert.equal(due('2026-10-29', [{ ...lejos, remindedFor: '2026-11-01' }], { cycles })[0].date, '2026-12-01')
})

test('the template values: name, relative day and the amount as the bot writes it', () => {
  const netflix = { name: 'Netflix', amount: 12.99, date: '2026-10-15' }
  const es = { locale: 'es', currency: 'EUR', amountFormat: 'completo', today: '2026-10-14' }
  assert.deepEqual(reminderParams(es, netflix).map(plain), ['Netflix', 'mañana', '12,99 €'])
  assert.deepEqual(reminderParams({ ...es, today: '2026-10-15' }, netflix).map(plain), ['Netflix', 'hoy', '12,99 €'])
  assert.equal(reminderParams({ ...es, today: '2026-10-12' }, netflix)[1], 'dentro de 3 días')
  assert.deepEqual(reminderParams({ ...es, locale: 'en' }, netflix), ['Netflix', 'tomorrow', '€12.99'])
  assert.equal(plain(reminderParams({ ...es, currency: 'ARS' }, { ...netflix, amount: 25000 })[2]), '$ 25.000')
})
