import { test } from 'node:test'
import assert from 'node:assert/strict'
import { safeNext } from './next.ts'

test('keeps a same-origin path with its query', () => {
  assert.equal(safeNext('/oauth/consent?authorization_id=abc'), '/oauth/consent?authorization_id=abc')
  assert.equal(safeNext('/dashboard'), '/dashboard')
  assert.equal(safeNext('/dashboard?mes=2026-11#movimientos'), '/dashboard?mes=2026-11#movimientos')
})

test('drops other hosts and schemes', () => {
  assert.equal(safeNext('https://evil.example'), null)
  assert.equal(safeNext('//evil.example'), null)
  assert.equal(safeNext('/\\evil.example'), null)
  assert.equal(safeNext('javascript:alert(1)'), null)
  assert.equal(safeNext('evil.example/path'), null)
})

test('drops tricks that normalise to another host', () => {
  assert.equal(safeNext('/\t/evil.example'), null)
  assert.equal(safeNext('/%2F%2Fevil.example'), '/%2F%2Fevil.example')
})

test('anything that is not a non-empty string reads as nothing', () => {
  assert.equal(safeNext(''), null)
  assert.equal(safeNext(null), null)
  assert.equal(safeNext(['/dashboard']), null)
  assert.equal(safeNext('/' + 'a'.repeat(3000)), null)
})
