import { test } from 'node:test'
import assert from 'node:assert/strict'
import { isInviteRequired } from './invite.ts'

test('missing variable requires an invitation', () => {
  assert.equal(isInviteRequired(undefined), true)
})

test('empty string requires an invitation', () => {
  assert.equal(isInviteRequired(''), true)
})

test("exactly 'false' turns the requirement off", () => {
  assert.equal(isInviteRequired('false'), false)
})

test("'False' (wrong case) still requires an invitation", () => {
  assert.equal(isInviteRequired('False'), true)
})

test("'0' still requires an invitation", () => {
  assert.equal(isInviteRequired('0'), true)
})

test("'no' still requires an invitation", () => {
  assert.equal(isInviteRequired('no'), true)
})

test("'true' still requires an invitation", () => {
  assert.equal(isInviteRequired('true'), true)
})
