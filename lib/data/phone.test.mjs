import { test } from 'node:test'
import assert from 'node:assert/strict'
import { formatPhone, toE164 } from './phone.ts'

test('an Argentine mobile gets its 9 after the country code', () => {
  assert.equal(toE164('11 5555 1234', 'AR'), '+5491155551234')
  assert.equal(toE164('+54 9 11 5555-1234', 'AR'), '+5491155551234')
  assert.equal(toE164('15 5555 1234', 'AR'), null)
  assert.equal(toE164('011 15 5555 1234', 'AR'), '+5491155551234')
})

test('a trunk zero is dropped by the country rules', () => {
  assert.equal(toE164('085 152 8917', 'IE'), '+353851528917')
  assert.equal(toE164('07911 123456', 'GB'), '+447911123456')
  assert.equal(toE164('+353 85 152 8917', 'AR'), '+353851528917')
})

test('an invalid number for the country is null', () => {
  assert.equal(toE164('12', 'IE'), null)
  assert.equal(toE164('abc', 'AR'), null)
  assert.equal(toE164('', 'AR'), null)
  assert.equal(toE164('11 5555 1234', 'XX'), null)
  assert.equal(toE164('11 5555 1234', ''), null)
})

test('a stored number is shown in international format', () => {
  assert.equal(formatPhone('+5491155551234'), '+54 9 11 5555 1234')
  assert.equal(formatPhone('+353851528917'), '+353 85 152 8917')
  assert.equal(formatPhone('nope'), 'nope')
})
