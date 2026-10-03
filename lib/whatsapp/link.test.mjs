import { test } from 'node:test'
import assert from 'node:assert/strict'
import { LINK_CODE_ALPHABET, generateLinkCode, linkMessage, parseLinkMessage, whatsAppLink } from './link.ts'

test('the alphabet leaves out 0, O, 1 and I, and a code is six symbols from it', () => {
  for (const symbol of ['0', 'O', '1', 'I']) assert.ok(!LINK_CODE_ALPHABET.includes(symbol), `${symbol} is out`)
  assert.equal(LINK_CODE_ALPHABET.length, 32)
  for (let i = 0; i < 50; i++) {
    const code = generateLinkCode()
    assert.match(code, /^[A-HJ-NP-Z2-9]{6}$/, code)
  }
  assert.notEqual(generateLinkCode(), generateLinkCode())
})

test('the link opens the number with "vincular <código>" written', () => {
  assert.equal(linkMessage('K7M2PX'), 'vincular K7M2PX')
  assert.equal(whatsAppLink('15551234567', 'K7M2PX'), 'https://wa.me/15551234567?text=vincular%20K7M2PX')
})

test('a linking message is recognised whatever its case and spacing, and nothing else is', () => {
  assert.equal(parseLinkMessage('vincular K7M2PX'), 'K7M2PX')
  assert.equal(parseLinkMessage('  Vincular   k7m2px '), 'K7M2PX')
  assert.equal(parseLinkMessage('vincular'), null)
  assert.equal(parseLinkMessage('vincular K7M2P'), null)
  assert.equal(parseLinkMessage('vinculá K7M2PX hoy'), null)
  assert.equal(parseLinkMessage('super 15'), null)
  assert.equal(parseLinkMessage(''), null)
})
