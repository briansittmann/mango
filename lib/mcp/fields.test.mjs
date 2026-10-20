import { test } from 'node:test'
import assert from 'node:assert/strict'
import { amountField } from './tools/fields.ts'

test('an amount is positive, has two decimals at most and fits numeric(12,2)', () => {
  assert.equal(amountField.safeParse(9999999999.99).success, true)
  assert.equal(amountField.safeParse(12.5).success, true)
  assert.equal(amountField.safeParse(1e12).success, false)
  assert.equal(amountField.safeParse(10_000_000_000).success, false)
  assert.equal(amountField.safeParse(0).success, false)
  assert.equal(amountField.safeParse(1.234).success, false)
})
