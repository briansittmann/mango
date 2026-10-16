import { test } from 'node:test'
import assert from 'node:assert/strict'
import { committedByCard } from './cards.ts'

const definitions = [
  { id: 'alquiler', cardId: 'debito' },
  { id: 'internet', cardId: 'debito' },
  { id: 'gimnasio', cardId: 'credito' },
  { id: 'parking', cardId: null },
]

const row = (id, amount, definitionId, extra = {}) => ({
  id,
  name: id,
  amount,
  date: '2026-09-01',
  ...(definitionId ? { fixed: { definitionId, day: 1, charged: false } } : {}),
  ...extra,
})

const group = (expenses) => ({ id: 'g', kind: 'category', name: 'G', color: 'rojo', total: 0, budget: null, expenses, rowsLater: 0, showProgress: true })

test('charged and pending rows count at their own amount', () => {
  const groups = [
    group([row('a', 820, 'alquiler', { fixed: { definitionId: 'alquiler', day: 1, charged: true } }), row('i', 45, 'internet')]),
    group([row('g', 40, 'gimnasio')]),
  ]
  const totals = committedByCard(groups, definitions)
  assert.deepEqual(totals.get('debito'), { total: 865, count: 2 })
  assert.deepEqual(totals.get('credito'), { total: 40, count: 1 })
})

test('projected charges count', () => {
  const groups = [group([row('proj:gimnasio', 40, 'gimnasio', { projected: true })])]
  assert.deepEqual(committedByCard(groups, definitions).get('credito'), { total: 40, count: 1 })
})

test('a "solo este mes" amount counts as shown', () => {
  const groups = [group([row('g', 55, 'gimnasio')])]
  assert.deepEqual(committedByCard(groups, definitions).get('credito'), { total: 55, count: 1 })
})

test('a deleted slot is absent from the rows, so it does not count', () => {
  const groups = [group([row('a', 820, 'alquiler')])]
  assert.deepEqual(committedByCard(groups, definitions).get('debito'), { total: 820, count: 1 })
})

test('one-off expenses and fixed charges without a card do not count', () => {
  const groups = [group([row('super', 30, null), row('p', 50, 'parking')])]
  assert.equal(committedByCard(groups, definitions).size, 0)
})

test('income never reaches the groups, and a card with no rows is absent', () => {
  const totals = committedByCard([], [...definitions, { id: 'salario', cardId: null }])
  assert.equal(totals.get('debito'), undefined)
})

test('decimals do not drift', () => {
  const groups = [group([row('a', 0.1, 'alquiler'), row('i', 0.2, 'internet')])]
  assert.equal(committedByCard(groups, definitions).get('debito').total, 0.3)
})
