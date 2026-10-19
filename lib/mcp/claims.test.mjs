import { test } from 'node:test'
import assert from 'node:assert/strict'
import { checkClaims, issuerOf } from './claims.ts'

const issuer = issuerOf('https://noemlszbjqzqbzagahyd.supabase.co/')
const valid = { iss: issuer, sub: 'auth-user', aud: 'authenticated', role: 'authenticated', client_id: 'client-1', exp: 1 }

test('the issuer is the project URL plus /auth/v1', () => {
  assert.equal(issuer, 'https://noemlszbjqzqbzagahyd.supabase.co/auth/v1')
})

test('a token of an OAuth client from our issuer passes', () => {
  assert.deepEqual(checkClaims(valid, issuer), { clientId: 'client-1', sub: 'auth-user' })
})

test('a browser session token (no client_id) does not', () => {
  const session = { ...valid, client_id: undefined }
  assert.equal(checkClaims(session, issuer), null)
  assert.equal(checkClaims({ ...valid, client_id: '' }, issuer), null)
})

test('a foreign issuer does not', () => {
  assert.equal(checkClaims({ ...valid, iss: 'https://other.supabase.co/auth/v1' }, issuer), null)
  assert.equal(checkClaims({ ...valid, iss: undefined }, issuer), null)
})

test('a missing subject, another role or no claims do not', () => {
  assert.equal(checkClaims({ ...valid, sub: undefined }, issuer), null)
  assert.equal(checkClaims({ ...valid, role: 'anon' }, issuer), null)
  assert.equal(checkClaims(null, issuer), null)
  assert.equal(checkClaims('token', issuer), null)
})
