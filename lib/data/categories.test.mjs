import { test } from 'node:test'
import assert from 'node:assert/strict'
import { categoriaViva } from './categories.ts'

const life = (from, until, hidden = []) => ({ from, until, hidden })

test('a category with no dates lives in every cycle', () => {
  assert.equal(categoriaViva(life(null, null), '2020-01-01'), true)
  assert.equal(categoriaViva(life(null, null), '2027-03-01'), true)
})

test('a category starts in its first cycle', () => {
  assert.equal(categoriaViva(life('2026-12-01', null), '2026-11-01'), false)
  assert.equal(categoriaViva(life('2026-12-01', null), '2026-12-01'), true)
  assert.equal(categoriaViva(life('2026-12-01', null), '2027-01-01'), true)
})

test('an ended category lives up to its last cycle', () => {
  assert.equal(categoriaViva(life(null, '2026-09-01'), '2026-09-01'), true)
  assert.equal(categoriaViva(life(null, '2026-09-01'), '2026-10-01'), false)
})

test('a hidden cycle is the only one it is missing from', () => {
  const ocio = life(null, null, ['2026-09-01'])
  assert.equal(categoriaViva(ocio, '2026-08-01'), true)
  assert.equal(categoriaViva(ocio, '2026-09-01'), false)
  assert.equal(categoriaViva(ocio, '2026-10-01'), true)
})
