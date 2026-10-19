import { test } from 'node:test'
import assert from 'node:assert/strict'
import { checkPaymentMethods, defaultColor, hasCents, mergeMovement, newMovement, reorderedIds, toScope } from './map.ts'
import { classifyRow, isRowId } from './rows.ts'
import { CATEGORY_COLORS } from '../data/categories.ts'

const today = '2026-10-19'

test('an expense, with today as the default date', () => {
  assert.deepEqual(newMovement('expense', { amount: 12.5, description: ' Café ', category_id: 'comida' }, today), {
    kind: 'expense',
    categoryId: 'comida',
    draft: { amount: 12.5, description: 'Café', date: today, paymentMethod: null },
  })
  assert.throws(() => newMovement('expense', { amount: 3 }, today), { code: 'invalid-input' })
})

test('amounts: positive with at most two decimals', () => {
  assert.equal(hasCents(0.29), true)
  assert.equal(hasCents(1.005), false)
  assert.throws(() => newMovement('income', { amount: 0 }, today), { code: 'invalid-input' })
  assert.throws(() => newMovement('income', { amount: 1.005 }, today), { code: 'invalid-input' })
})

test('savings take a direction and a description; already_saved only on a deposit', () => {
  assert.deepEqual(newMovement('savings', { amount: 50, description: 'Hucha', direction: 'deposit', already_saved: true }, today).draft, {
    kind: 'deposit', name: 'Hucha', amount: 50, date: today, alreadySaved: true,
  })
  assert.throws(() => newMovement('savings', { amount: 50, direction: 'deposit' }, today), { code: 'invalid-input' })
  assert.throws(() => newMovement('savings', { amount: 50, description: 'x', direction: 'withdrawal', already_saved: true }, today), { code: 'invalid-input' })
})

test('a field that does not apply to the kind is refused', () => {
  assert.throws(() => newMovement('income', { amount: 5, category_id: 'comida' }, today), { code: 'invalid-input' })
  assert.throws(() => newMovement('transfer', { amount: 5, into: 'efectivo', description: 'x' }, today), { code: 'invalid-input' })
})

test('the payment-method gate', () => {
  assert.doesNotThrow(() => checkPaymentMethods(true, 'transfer', { into: 'efectivo' }))
  assert.doesNotThrow(() => checkPaymentMethods(false, 'expense', { payment_method: null }))
  assert.throws(() => checkPaymentMethods(false, 'expense', { payment_method: 'efectivo' }), { code: 'payment-methods-not-offered' })
  assert.throws(() => checkPaymentMethods(false, 'transfer', { amount: 5 }), { code: 'payment-methods-not-offered' })
})

const stored = { kind: 'expense', amount: 20, description: 'Super', date: '2026-10-02', categoryId: 'comida', paymentMethod: 'tarjeta', alreadySaved: false }

test('a partial update keeps every field not given', () => {
  assert.deepEqual(mergeMovement(stored, { amount: 22 }), {
    kind: 'expense', categoryId: 'comida', draft: { amount: 22, description: 'Super', date: '2026-10-02', paymentMethod: 'tarjeta' },
  })
  assert.equal(mergeMovement(stored, { category_id: 'ocio' }).categoryId, 'ocio')
  assert.equal(mergeMovement(stored, { payment_method: null }).draft.paymentMethod, null)
  assert.throws(() => mergeMovement(stored, {}), { code: 'invalid-input' })
})

test('a savings row keeps its direction unless told, and a withdrawal drops the mark', () => {
  const deposit = { kind: 'savings', amount: 80, description: 'Hucha', date: '2026-10-01', categoryId: null, paymentMethod: null, alreadySaved: true }
  assert.deepEqual(mergeMovement(deposit, { amount: 90 }).draft, { kind: 'deposit', name: 'Hucha', amount: 90, date: '2026-10-01', alreadySaved: true })
  const withdrawal = { ...deposit, amount: -30, alreadySaved: false }
  assert.equal(mergeMovement(withdrawal, { amount: 40 }).draft.kind, 'withdrawal')
  assert.equal(mergeMovement(deposit, { direction: 'withdrawal' }).draft.alreadySaved, false)
})

test('a transfer keeps the pocket it enters', () => {
  const transfer = { kind: 'transfer', amount: 100, description: '', date: '2026-10-04', categoryId: null, paymentMethod: 'efectivo', alreadySaved: false }
  assert.deepEqual(mergeMovement(transfer, { amount: 150 }).draft, { amount: 150, into: 'efectivo', date: '2026-10-04' })
})

test('the default colour is the first unused one, never the rainbow', () => {
  assert.equal(defaultColor([]), CATEGORY_COLORS[0])
  assert.equal(defaultColor(['granate', 'rojo']), 'coral')
  const allButRainbow = CATEGORY_COLORS.filter((c) => c !== 'arcoiris')
  assert.notEqual(defaultColor(allButRainbow), 'arcoiris')
})

test('scopes', () => {
  assert.equal(toScope('only_this_month'), 'only')
  assert.equal(toScope('from_this_month'), 'onward')
})

test('rows: kinds, fixed rows, projected ids and ids of no row', () => {
  const id = '3c893da8-d11c-4a35-8b86-28c01e0b5eef'
  assert.equal(classifyRow(id, { tipo: 'gasto', movimiento_recurrente_id: null }, 'update'), 'expense')
  assert.equal(classifyRow(id, { tipo: 'transferencia', movimiento_recurrente_id: null }, 'delete'), 'transfer')
  assert.throws(() => classifyRow(id, { tipo: 'gasto', movimiento_recurrente_id: 'def' }, 'update'), (e) => e.code === 'fixed-row' && /update_fixed_charge/.test(e.message))
  assert.throws(() => classifyRow('proj:def', null, 'delete'), (e) => e.code === 'fixed-row' && /delete_fixed_charge/.test(e.message))
  assert.throws(() => classifyRow(id, null, 'restore'), { code: 'not-found' })
  assert.equal(isRowId(id), true)
  assert.equal(isRowId('proj:def'), false)
  assert.equal(isRowId("1' or 1=1"), false)
})

test('reorder: shown categories move, the others keep their positions', () => {
  const stored = ['a', 'ended', 'b', 'c', 'hidden']
  assert.deepEqual(reorderedIds(stored, ['a', 'b', 'c']), stored)
  assert.deepEqual(reorderedIds(stored, ['c', 'a', 'b']), ['c', 'ended', 'a', 'b', 'hidden'])
})
