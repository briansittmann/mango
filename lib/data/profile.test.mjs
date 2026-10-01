import { test } from 'node:test'
import assert from 'node:assert/strict'
import { INVALID_COUNTRY, INVALID_CURRENCY, INVALID_CYCLE_DAY, INVALID_NAME, INVALID_TIMEZONE, validateBasics } from './profile.ts'

const basics = (overrides = {}) => ({
  name: '  Ana ',
  country: 'AR',
  currency: 'ARS',
  timezone: 'America/Argentina/Cordoba',
  cycleDay: 28,
  amountFormat: 'abreviado',
  ...overrides,
})

test('the basics are stored trimmed, with the abbreviated format only for Argentina', () => {
  assert.deepEqual(validateBasics(basics()), {
    name: 'Ana',
    country: 'AR',
    currency: 'ARS',
    timezone: 'America/Argentina/Cordoba',
    cycleDay: 28,
    amountFormat: 'abreviado',
  })
  assert.equal(validateBasics(basics({ country: 'UY', currency: 'UYU', timezone: 'America/Montevideo' })).amountFormat, 'completo')
  // The currency stays editable: Argentina in euros keeps the format control.
  assert.equal(validateBasics(basics({ currency: 'EUR' })).amountFormat, 'abreviado')
})

test('each field outside the rules rejects with its own message', () => {
  assert.throws(() => validateBasics(basics({ name: '   ' })), { message: INVALID_NAME })
  assert.throws(() => validateBasics(basics({ name: 'a'.repeat(81) })), { message: INVALID_NAME })
  assert.throws(() => validateBasics(basics({ country: 'XX' })), { message: INVALID_COUNTRY })
  assert.throws(() => validateBasics(basics({ currency: 'XYZ' })), { message: INVALID_CURRENCY })
  assert.throws(() => validateBasics(basics({ timezone: 'Europe/Dublin' })), { message: INVALID_TIMEZONE })
  assert.throws(() => validateBasics(basics({ cycleDay: 29 })), { message: INVALID_CYCLE_DAY })
  assert.throws(() => validateBasics(basics({ cycleDay: 0 })), { message: INVALID_CYCLE_DAY })
  assert.throws(() => validateBasics(basics({ cycleDay: 1.5 })), { message: INVALID_CYCLE_DAY })
})
