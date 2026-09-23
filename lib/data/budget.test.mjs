import { test } from 'node:test'
import assert from 'node:assert/strict'
import { getBudgetStatus, getFreeMargin } from './budget.ts'

// The demo's cycle: income 2.820, savings 146. Every category's `spent` is its total, recurring
// charges included — pending ones (gimnasio 40, limpieza 35) at their expected amount.
const demo = { income: 2820, savings: 146 }
const unbudgeted = [
  { budget: null, spent: 900 }, // vivienda: alquiler 820 + internet 45 + seguro 35, all recurring
  { budget: null, spent: 40 }, // salud: gimnasio, pending
  { budget: null, spent: 95 }, // hogar: limpieza 35 pending + decoración 60
  { budget: null, spent: 95 }, // compras
]
const comida = (spent, budget = 400) => ({ budget, spent })
const ocio = { budget: 150, spent: 130 }
const transporte = { budget: 100, spent: 130 } // gasolina 80 + parking 50, recurring

const margin = (categories) => getFreeMargin({ ...demo, categories })
const demoCategories = (extra = []) => [comida(310), ocio, transporte, ...unbudgeted, ...extra]

test('the demo load figures give 864', () => {
  assert.equal(margin(demoCategories()), 864)
})

test('spending within the budget leaves the margin alone', () => {
  assert.equal(margin([comida(330), ocio, transporte, ...unbudgeted]), margin(demoCategories()))
})

test('spending over the budget costs only the excess', () => {
  assert.equal(margin([comida(430), ocio, transporte, ...unbudgeted]), margin(demoCategories()) - 30)
})

test("one category's leftover does not offset another's overspending", () => {
  const categories = [
    { budget: 400, spent: 310 },
    { budget: 100, spent: 130 },
  ]
  const result = getFreeMargin({ income: 1000, savings: 0, categories })
  // Both budgets reserved (500), plus transporte's 30 beyond its own: −30 from the envelopes,
  // not a pooled max(500, 440) that comida's 90 left would absorb.
  assert.equal(result, 1000 - 500 - 30)
  assert.notEqual(result, 1000 - Math.max(500, 440))
})

test('raising and lowering a budget once spending exists', () => {
  const at = (budget) => margin([comida(310, budget), ocio, transporte, ...unbudgeted])
  assert.equal(at(600) - at(400), -200)
  assert.equal(at(350) - at(400), 50)
  // Lowering below what is spent releases only down to the spending.
  assert.equal(at(200) - at(400), 90)
  assert.equal(at(200), 954)
})

test('a category with no budget in the cycle counts its whole spending', () => {
  assert.equal(margin([comida(310, null), ocio, transporte, ...unbudgeted]), 954)
  assert.equal(getFreeMargin({ income: 500, savings: 0, categories: [{ budget: null, spent: 120 }] }), 380)
})

test('a new budget below spending that includes recurring charges leaves the margin unchanged', () => {
  // 600 spent plus a 300 recurring charge: max(150, 900) = 900, the same 900 counted before.
  const before = margin(demoCategories([{ budget: null, spent: 600 + 300 }]))
  const after = margin(demoCategories([{ budget: 150, spent: 600 + 300 }]))
  assert.equal(after, before)
})

test('a new budget above the spending costs only budget − spent', () => {
  const before = margin(demoCategories([{ budget: null, spent: 60 }]))
  const after = margin(demoCategories([{ budget: 150, spent: 60 }]))
  assert.equal(after, before - 90)
})

test('a budget whose recurring charge is under it reserves the whole budget, and the bar counts the charge', () => {
  // Suplementos: one 45 € recurring charge and an 80 € budget.
  assert.equal(margin(demoCategories([{ budget: 80, spent: 45 }])), margin(demoCategories()) - 80)
  const bar = getBudgetStatus({ amount: 80, spent: 45, currentDay: 1, cycleDays: 30 })
  assert.equal(bar.spent, 45)
  assert.equal(bar.amount, 80)
  assert.equal(bar.level, 'ok')
})

test('a recurring charge not yet charged counts at its expected amount, then at the real one', () => {
  // An unbudgeted category whose only expense is a pending 40 € charge: it costs 40 from day 1.
  assert.equal(margin(demoCategories([{ budget: null, spent: 40 }])), margin(demoCategories()) - 40)
  // Charged at 44, the real amount replaces the expected one.
  assert.equal(margin(demoCategories([{ budget: null, spent: 44 }])), margin(demoCategories()) - 44)
})
