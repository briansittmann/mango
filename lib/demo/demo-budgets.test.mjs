import { test } from 'node:test'
import assert from 'node:assert/strict'
import { budgetFor, copyForward, dropCategory, setBudget } from './demo-budgets.ts'

const AUG = '2026-08-26'
const SEP = '2026-09-26'
const OCT = '2026-10-26'

const august = [
  { categoryId: 'comida', cycle: AUG, amount: 400 },
  { categoryId: 'ocio', cycle: AUG, amount: 150 },
]
const inCycle = (rows, cycle) => rows.filter((row) => row.cycle === cycle)

test("a new current cycle copies the previous cycle's rows and leaves them unchanged", () => {
  const rows = copyForward(august, SEP)
  assert.deepEqual(inCycle(rows, SEP), [
    { categoryId: 'comida', cycle: SEP, amount: 400 },
    { categoryId: 'ocio', cycle: SEP, amount: 150 },
  ])
  assert.deepEqual(inCycle(rows, AUG), august)
})

test('it copies from the most recent cycle that has rows, skipping an empty one', () => {
  const rows = copyForward([{ categoryId: 'comida', cycle: '2026-07-26', amount: 380 }], SEP)
  assert.equal(budgetFor(rows, 'comida', SEP), 380)
  assert.deepEqual(inCycle(rows, AUG), [])
})

test('no copy when the current cycle already holds a row', () => {
  const rows = [...august, { categoryId: 'ocio', cycle: SEP, amount: 150 }]
  assert.equal(copyForward(rows, SEP), rows)
  assert.equal(budgetFor(rows, 'comida', SEP), null)
})

test('setBudget writes only the current cycle, and the next copy carries it', () => {
  const copied = copyForward(august, SEP)
  const edited = setBudget(copied, 'comida', 600, SEP)
  assert.deepEqual(inCycle(edited, AUG), august)
  assert.equal(budgetFor(edited, 'comida', SEP), 600)
  assert.equal(budgetFor(copyForward(edited, OCT), 'comida', OCT), 600)
})

test('clearing every budget leaves markers that stay cleared and carry forward', () => {
  let rows = copyForward(august, SEP)
  rows = setBudget(rows, 'comida', null, SEP)
  rows = setBudget(rows, 'ocio', null, SEP)
  assert.deepEqual(inCycle(rows, SEP), [
    { categoryId: 'comida', cycle: SEP, amount: null },
    { categoryId: 'ocio', cycle: SEP, amount: null },
  ])
  assert.equal(copyForward(rows, SEP), rows)

  const next = copyForward(rows, OCT)
  assert.deepEqual(inCycle(next, OCT), [
    { categoryId: 'comida', cycle: OCT, amount: null },
    { categoryId: 'ocio', cycle: OCT, amount: null },
  ])
  assert.equal(budgetFor(next, 'comida', OCT), null)
  assert.equal(budgetFor(next, 'ocio', OCT), null)
})

test('no row after the current cycle exists after any sequence of copies and edits', () => {
  let rows = copyForward(august, SEP)
  rows = setBudget(rows, 'comida', 600, SEP)
  rows = setBudget(rows, 'transporte', 100, SEP)
  rows = copyForward(rows, SEP)
  rows = setBudget(rows, 'ocio', null, SEP)
  rows = dropCategory(rows, 'transporte')
  rows = copyForward(rows, SEP)
  assert.ok(rows.every((row) => row.cycle <= SEP))
  assert.ok(rows.every((row) => row.categoryId !== 'transporte'))
})
