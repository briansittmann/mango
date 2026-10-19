import { test } from 'node:test'
import assert from 'node:assert/strict'
import { decodeSignupPrefs, encodeSignupPrefs, signupPrefs } from './signup-prefs.ts'

test('keeps a supported language and a known timezone', () => {
  assert.deepEqual(signupPrefs({ idioma: 'en', timezone: 'Europe/Madrid' }), { idioma: 'en', timezone: 'Europe/Madrid' })
  assert.deepEqual(signupPrefs({ idioma: 'es', timezone: 'America/Argentina/Buenos_Aires' }), { idioma: 'es', timezone: 'America/Argentina/Buenos_Aires' })
})

test('drops an unsupported language', () => {
  assert.deepEqual(signupPrefs({ idioma: 'fr', timezone: 'Europe/Madrid' }), { timezone: 'Europe/Madrid' })
  assert.deepEqual(signupPrefs({ idioma: 1 }), {})
})

test('drops an unknown timezone', () => {
  assert.deepEqual(signupPrefs({ idioma: 'en', timezone: 'Mars/Olympus' }), { idioma: 'en' })
  assert.deepEqual(signupPrefs({ timezone: '' }), {})
  assert.deepEqual(signupPrefs({ timezone: 'x'.repeat(80) }), {})
})

test('anything that is not an object reads as nothing', () => {
  assert.deepEqual(signupPrefs(null), {})
  assert.deepEqual(signupPrefs('en'), {})
})

test('the cookie round-trips and a malformed one reads as nothing', () => {
  const prefs = { idioma: 'en', timezone: 'Europe/Madrid' }
  assert.deepEqual(decodeSignupPrefs(encodeSignupPrefs(prefs)), prefs)
  assert.deepEqual(decodeSignupPrefs('{not json'), {})
  assert.deepEqual(decodeSignupPrefs(''), {})
  assert.deepEqual(decodeSignupPrefs(undefined), {})
  assert.deepEqual(decodeSignupPrefs('{"idioma":"de","timezone":"Nowhere"}'), {})
})

test('keeps a same-origin next and drops any other', () => {
  assert.deepEqual(signupPrefs({ next: '/oauth/consent?authorization_id=abc' }), { next: '/oauth/consent?authorization_id=abc' })
  assert.deepEqual(signupPrefs({ next: 'https://evil.example' }), {})
  assert.deepEqual(signupPrefs({ next: '//evil.example' }), {})
  const prefs = { idioma: 'es', next: '/oauth/consent?authorization_id=abc' }
  assert.deepEqual(decodeSignupPrefs(encodeSignupPrefs(prefs)), prefs)
})
