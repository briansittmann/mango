import { test } from 'node:test'
import assert from 'node:assert/strict'
import { DEFAULT_WIDGET_ORDER, normalizeWidgetOrder } from './dashboard.ts'

test('null and undefined give the default order', () => {
  assert.deepEqual(normalizeWidgetOrder(null), DEFAULT_WIDGET_ORDER)
  assert.deepEqual(normalizeWidgetOrder(undefined), DEFAULT_WIDGET_ORDER)
  assert.deepEqual(DEFAULT_WIDGET_ORDER, ['weekly', 'calendar', 'monthly', 'distribution'])
})

test('a complete stored order is kept as is', () => {
  assert.deepEqual(normalizeWidgetOrder(['distribution', 'weekly', 'calendar', 'monthly']), ['distribution', 'weekly', 'calendar', 'monthly'])
})

test('unknown ids are dropped and missing ones appended in the default order', () => {
  assert.deepEqual(normalizeWidgetOrder(['distribution', 'pie', 'weekly']), ['distribution', 'weekly', 'calendar', 'monthly'])
})

test('duplicates collapse to their first position', () => {
  assert.deepEqual(normalizeWidgetOrder(['monthly', 'weekly', 'monthly', 'weekly']), ['monthly', 'weekly', 'calendar', 'distribution'])
})

test('the result never shares the default array', () => {
  const order = normalizeWidgetOrder(null)
  order.reverse()
  assert.deepEqual(DEFAULT_WIDGET_ORDER, ['weekly', 'calendar', 'monthly', 'distribution'])
})
