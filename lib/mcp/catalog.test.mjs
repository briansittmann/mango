import { test } from 'node:test'
import assert from 'node:assert/strict'
import { CATALOG } from './catalog.ts'

const names = Object.keys(CATALOG)

test('nineteen tools, every one with the four hints and openWorldHint false', () => {
  assert.equal(names.length, 19)
  for (const [name, hints] of Object.entries(CATALOG)) {
    assert.deepEqual(Object.keys(hints).sort(), ['destructiveHint', 'idempotentHint', 'openWorldHint', 'readOnlyHint'], name)
    assert.equal(hints.openWorldHint, false, name)
    for (const value of Object.values(hints)) assert.equal(typeof value, 'boolean', name)
  }
})

test('read tools are read-only; nothing else is', () => {
  const readOnly = names.filter((n) => CATALOG[n].readOnlyHint)
  assert.deepEqual(readOnly, ['get_summary', 'list_movements', 'list_fixed_charges'])
  for (const n of readOnly) assert.equal(CATALOG[n].destructiveHint, false)
})

test('every update, delete and the reorder are destructive; creating, restoring and marking charged are not', () => {
  const destructive = names.filter((n) => CATALOG[n].destructiveHint).sort()
  assert.deepEqual(destructive, [
    'delete_card', 'delete_category', 'delete_fixed_charge', 'delete_movement',
    'reorder_categories',
    'update_card', 'update_category', 'update_fixed_charge', 'update_movement',
  ])
})

test('idempotent: reads, restores, set_fixed_charged, the reorder, the deletes and update_card', () => {
  const idempotent = names.filter((n) => CATALOG[n].idempotentHint).sort()
  assert.deepEqual(idempotent, [
    'delete_card', 'delete_category', 'delete_fixed_charge', 'delete_movement',
    'get_summary', 'list_fixed_charges', 'list_movements',
    'reorder_categories', 'restore_fixed_charge_month', 'restore_movement', 'set_fixed_charged', 'update_card',
  ])
})
