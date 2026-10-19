import { test } from 'node:test'
import assert from 'node:assert/strict'
import { z } from 'zod'
import { McpToolError, toToolError } from './errors.ts'

test('our own refusals pass through', () => {
  assert.deepEqual(toToolError(new McpToolError('fixed-row', 'Use update_fixed_charge.')), {
    code: 'fixed-row',
    message: 'Use update_fixed_charge.',
  })
})

test('duplicate category and card names become duplicate-name', () => {
  assert.equal(toToolError(new Error('duplicate-category-name')).code, 'duplicate-name')
  assert.equal(toToolError(new Error('duplicate-card-name')).code, 'duplicate-name')
})

test('not-found from the contracts and PGRST116 become not-found', () => {
  assert.equal(toToolError(new Error('not-found')).code, 'not-found')
  assert.equal(toToolError({ code: 'PGRST116', message: 'JSON object requested, multiple (or no) rows returned' }).code, 'not-found')
})

test('a zod failure becomes invalid-input with its first issue', () => {
  const result = z.object({ amount: z.number().positive() }).safeParse({ amount: -1 })
  const error = toToolError(result.error)
  assert.equal(error.code, 'invalid-input')
  assert.match(error.message, /^amount: /)
})

test('anything else becomes failed, without the real message', () => {
  const error = toToolError(new Error('permission denied for table transacciones'))
  assert.equal(error.code, 'failed')
  assert.doesNotMatch(error.message, /transacciones/)
  assert.equal(toToolError('boom').code, 'failed')
  assert.equal(toToolError(undefined).code, 'failed')
})
