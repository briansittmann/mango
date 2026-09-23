import { test } from 'node:test'
import assert from 'node:assert/strict'
import { getFreeMargin } from './budget.ts'

// The demo's cycle: income 2.820, savings 146, recurring charges 1.025, and 155 spent outside
// recurring charges in categories without a budget (hogar 60, compras 95).
const demo = { income: 2820, savings: 146, fixed: 1025 }
const unbudgeted = [
  { budget: null, spent: 60 },
  { budget: null, spent: 95 },
]
const comida = (spent, budget = 400) => ({ budget, spent })
const ocio = { budget: 150, spent: 130 }
const transporte = (spent, budget = 100) => ({ budget, spent })

const margin = (categories) => getFreeMargin({ ...demo, categories })

test('the demo load figures give 844', () => {
  assert.equal(margin([comida(310), ocio, transporte(80), ...unbudgeted]), 844)
})

test('spending within the budget leaves the margin alone', () => {
  const before = margin([comida(310), ocio, transporte(80), ...unbudgeted])
  const after = margin([comida(330), ocio, transporte(80), ...unbudgeted])
  assert.equal(after, before)
})

test('spending over the budget costs only the excess', () => {
  const before = margin([comida(310), ocio, transporte(80), ...unbudgeted])
  const after = margin([comida(310), ocio, transporte(110), ...unbudgeted])
  assert.equal(after, before - 10)
})

test("one category's leftover does not offset another's overspending", () => {
  const categories = [
    { budget: 400, spent: 310 },
    { budget: 100, spent: 130 },
  ]
  const result = getFreeMargin({ income: 1000, savings: 0, fixed: 0, categories })
  // Both budgets reserved (500), plus transporte's 30 beyond its own: −30 from the envelopes,
  // not a pooled max(500, 440) that comida's 90 left would absorb.
  assert.equal(result, 1000 - 500 - 30)
  assert.notEqual(result, 1000 - Math.max(500, 440))
})

test('raising and lowering a budget once spending exists', () => {
  const at = (budget) => margin([comida(310, budget), ocio, transporte(80), ...unbudgeted])
  assert.equal(at(600) - at(400), -200)
  assert.equal(at(350) - at(400), 50)
  // Lowering below what is spent releases only down to the spending.
  assert.equal(at(200) - at(400), 90)
  assert.equal(at(200), 934)
})

test('a category with no budget in the cycle counts its whole spending', () => {
  const result = margin([comida(310, null), ocio, transporte(80), ...unbudgeted])
  assert.equal(result, 934)
  assert.equal(getFreeMargin({ income: 500, savings: 0, fixed: 0, categories: [{ budget: null, spent: 120 }] }), 380)
})
