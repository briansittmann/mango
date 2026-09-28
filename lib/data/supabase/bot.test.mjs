import { test } from 'node:test'
import assert from 'node:assert/strict'
import { normalizeName } from './bot.ts'

test('normalizeName ignores case and accents', () => {
  assert.equal(normalizeName('Súper'), normalizeName('super'))
  assert.equal(normalizeName('SALUD'), 'salud')
  assert.equal(normalizeName('Música '), 'musica')
})
