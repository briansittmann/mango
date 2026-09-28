import { test } from 'node:test'
import assert from 'node:assert/strict'
import { sendStatus, verifyStatus } from './otp-status.ts'

test('a sent code and an unknown address answer the same', () => {
  assert.equal(sendStatus(null), 'sent')
  assert.equal(sendStatus({ status: 422, code: 'otp_disabled', message: 'Signups not allowed for otp' }), 'sent')
  assert.equal(sendStatus({ status: 400, message: 'Signups not allowed for this instance' }), 'sent')
})

test('the per-address interval and the hourly cap are rate_limited, not error', () => {
  assert.equal(sendStatus({ status: 429, code: 'over_email_send_rate_limit', message: 'For security purposes, you can only request this after 42 seconds.' }), 'rate_limited')
  assert.equal(sendStatus({ status: 429, code: 'over_email_send_rate_limit', message: 'email rate limit exceeded' }), 'rate_limited')
  assert.equal(sendStatus({ status: 429, message: 'Too many requests' }), 'rate_limited')
})

test('any other send failure is error', () => {
  assert.equal(sendStatus({ status: 500, code: 'unexpected_failure', message: 'Error sending magic link email' }), 'error')
  assert.equal(sendStatus({ message: 'fetch failed' }), 'error')
})

test('verify: ok, rejected, rate_limited and error', () => {
  assert.equal(verifyStatus(null), 'ok')
  assert.equal(verifyStatus({ status: 403, code: 'otp_expired', message: 'Token has expired or is invalid' }), 'rejected')
  assert.equal(verifyStatus({ status: 429, code: 'over_request_rate_limit', message: 'Request rate limit reached' }), 'rate_limited')
  assert.equal(verifyStatus({ status: 500, message: 'Internal error' }), 'error')
  assert.equal(verifyStatus({ message: 'fetch failed' }), 'error')
})
