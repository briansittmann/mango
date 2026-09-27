import { test } from 'node:test'
import assert from 'node:assert/strict'
import { budgetFor, copyForward, dropCategory, setBudget, setBudgetInCycle } from './demo-budgets.ts'
import { proyectarCiclo } from '../data/projection.ts'

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

// Future cycles (`category-editing` → *Budgets belong to one cycle*), with Brian's September.
const SEPT = '2026-09-01'
const cycles = ['2026-10-01', '2026-11-01', '2026-12-01', '2027-01-01', '2027-02-01', '2027-03-01', '2027-04-01']
const [OCTU, NOV, DEC, JAN, FEB, MAR] = cycles
const september = [
  { categoryId: 'comida', cycle: SEPT, amount: 300 },
  { categoryId: 'suplementos', cycle: SEPT, amount: 100 },
]
const inDecember = (scope) => ({ current: SEPT, cycle: DEC, following: JAN, scope })
const shown = (rows, start) =>
  Object.fromEntries(proyectarCiclo({ start, cyclesAfterGenerated: 1, definitions: [], budgetRows: rows, savingsTarget: null }).budgets)

test('nothing is created for a future cycle: a projection reads the inherited rows', () => {
  const rows = copyForward(september, SEPT)
  assert.deepEqual(shown(rows, NOV), { comida: 300, suplementos: 100 })
  assert.ok(rows.every((row) => row.cycle <= SEPT))
})

test('only this month: December changes, January keeps the values from before', () => {
  const rows = setBudgetInCycle(september, 'comida', 500, inDecember('only'))
  assert.deepEqual(inCycle(rows, SEPT), september)
  assert.deepEqual(inCycle(rows, OCTU), [])
  assert.deepEqual(inCycle(rows, NOV), [])
  assert.deepEqual(shown(rows, DEC), { comida: 500, suplementos: 100 })
  assert.deepEqual(inCycle(rows, JAN).length, 2)
  assert.deepEqual(shown(rows, JAN), { comida: 300, suplementos: 100 })
  assert.deepEqual(shown(rows, OCTU), { comida: 300, suplementos: 100 })
  assert.deepEqual(shown(rows, NOV), { comida: 300, suplementos: 100 })
  assert.deepEqual(shown(rows, FEB), { comida: 300, suplementos: 100 })
})

test('from this month on: December changes and the later projections inherit it', () => {
  const rows = setBudgetInCycle(september, 'comida', 500, inDecember('onward'))
  assert.deepEqual(shown(rows, DEC), { comida: 500, suplementos: 100 })
  assert.deepEqual(inCycle(rows, JAN), [])
  for (const later of [JAN, FEB, MAR]) assert.equal(shown(rows, later).comida, 500)
  assert.equal(shown(rows, OCTU).comida, 300)
  assert.equal(shown(rows, NOV).comida, 300)
})

test('a materialised cycle keeps its entries when the current cycle changes', () => {
  let rows = setBudgetInCycle(september, 'comida', 500, inDecember('onward'))
  rows = setBudgetInCycle(rows, 'comida', 350, { current: SEPT, cycle: SEPT, following: OCTU, scope: null })
  assert.equal(budgetFor(rows, 'comida', SEPT), 350)
  assert.equal(shown(rows, OCTU).comida, 350)
  assert.equal(shown(rows, NOV).comida, 350)
  assert.equal(shown(rows, DEC).comida, 500)
})

test('only this month does not carry over when nothing was there to inherit', () => {
  const rows = setBudgetInCycle([], 'comida', 500, inDecember('only'))
  assert.deepEqual(shown(rows, DEC), { comida: 500 })
  assert.deepEqual(shown(rows, JAN), { comida: null })
  assert.deepEqual(inCycle(rows, SEPT), [])
})

test('only this month leaves a following cycle with entries of its own alone', () => {
  let rows = setBudgetInCycle(september, 'comida', 400, { current: SEPT, cycle: JAN, following: FEB, scope: 'onward' })
  const january = inCycle(rows, JAN)
  rows = setBudgetInCycle(rows, 'comida', 500, inDecember('only'))
  assert.deepEqual(inCycle(rows, JAN), january)
  assert.equal(shown(rows, DEC).comida, 500)
})

test('an edit from a past cycle writes the current cycle', () => {
  const rows = setBudgetInCycle(september, 'comida', 320, { current: SEPT, cycle: '2026-08-01', following: SEPT, scope: null })
  assert.equal(budgetFor(rows, 'comida', SEPT), 320)
  assert.deepEqual(inCycle(rows, '2026-08-01'), [])
})

test('a rename from a projected cycle (no scope) changes no budget', () => {
  const rows = setBudgetInCycle(september, 'comida', 999, inDecember(null))
  assert.deepEqual(rows, copyForward(september, SEPT))
  assert.equal(shown(rows, DEC).comida, 300)
})
