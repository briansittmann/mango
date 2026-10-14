import { test } from 'node:test'
import assert from 'node:assert/strict'
import { splitSavings } from './savings.ts'

test('regular movements are counted, withdrawals negative', () => {
  assert.deepEqual(splitSavings([{ amount: 176 }, { amount: -80 }, { amount: 50 }]), { counted: 146, alreadySaved: 0 })
})

test('a deposit already saved stays out of the counted sum', () => {
  assert.deepEqual(splitSavings([{ amount: 176 }, { amount: -80 }, { amount: 50 }, { amount: 1000, alreadySaved: true }]), {
    counted: 146,
    alreadySaved: 1000,
  })
})

test('a cycle with only already-saved deposits counts nothing', () => {
  assert.deepEqual(splitSavings([{ amount: 176, alreadySaved: true }]), { counted: 0, alreadySaved: 176 })
})

test('no movements', () => {
  assert.deepEqual(splitSavings([]), { counted: 0, alreadySaved: 0 })
})
