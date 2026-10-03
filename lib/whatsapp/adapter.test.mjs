import { test } from 'node:test'
import assert from 'node:assert/strict'
import { bilingual, handleIncoming } from './handle-message.ts'
import es from '../../messages/es.json' with { type: 'json' }
import en from '../../messages/en.json' with { type: 'json' }

const texts = {
  es: { vinculado: es.bot.vinculado, yaVinculado: es.bot.yaVinculado, codigoInvalido: es.bot.codigoInvalido, numeroEnOtraCuenta: es.bot.numeroEnOtraCuenta, cuentaYaVinculada: es.bot.cuentaYaVinculada },
  en: { vinculado: en.bot.vinculado, yaVinculado: en.bot.yaVinculado, codigoInvalido: en.bot.codigoInvalido, numeroEnOtraCuenta: en.bot.numeroEnOtraCuenta, cuentaYaVinculada: en.bot.cuentaYaVinculada },
}

const PHONE = '+5491155551234'
const message = (text, extra = {}) => ({ phone: PHONE, text, messageId: 'wamid.1', ...extra })

/** Fakes every side effect and records what was called; `known` is the id the number resolves to. */
function fakeDeps({ known = null, link = { ok: true, userId: 'user-a' }, firstContact = true } = {}) {
  const calls = { linkChannel: [], registerUnknownContact: [], processUnknownNumber: [], handleKnown: [], sendText: [] }
  const deps = {
    findUserIdByPhone: async () => known,
    linkChannel: async (...args) => {
      calls.linkChannel.push(args)
      return link
    },
    registerUnknownContact: async (...args) => {
      calls.registerUnknownContact.push(args)
      return firstContact
    },
    localeOf: async () => 'es',
    processUnknownNumber: async (input) => {
      calls.processUnknownNumber.push(input)
      return input.answered ? { kind: 'none' } : { kind: 'text', text: 'desconocido' }
    },
    handleKnown: async (...args) => {
      calls.handleKnown.push(args)
    },
    sendText: async (...args) => {
      calls.sendText.push(args)
    },
    texts,
  }
  return { deps, calls }
}

test('"vincular K7M2PX" from an unknown number links the chat and confirms in the account\'s language', async () => {
  const { deps, calls } = fakeDeps()
  await handleIncoming(message('  Vincular   k7m2px '), deps)
  assert.deepEqual(calls.linkChannel, [['whatsapp', 'K7M2PX', PHONE]])
  assert.deepEqual(calls.sendText, [[PHONE, es.bot.vinculado]])
  assert.equal(calls.handleKnown.length, 0)
  assert.equal(calls.processUnknownNumber.length, 0)
  assert.equal(calls.registerUnknownContact.length, 0)
})

test('a refused link gets its reason in both languages and nothing else happens', async () => {
  for (const [error, key] of [
    ['codigo-invalido', 'codigoInvalido'],
    ['cuenta-ya-vinculada', 'cuentaYaVinculada'],
    ['numero-en-otra-cuenta', 'numeroEnOtraCuenta'],
  ]) {
    const { deps, calls } = fakeDeps({ link: { ok: false, error } })
    await handleIncoming(message('vincular ZZZZZZ'), deps)
    assert.deepEqual(calls.sendText, [[PHONE, `${es.bot[key]}\n\n${en.bot[key]}`]])
    assert.equal(calls.handleKnown.length, 0)
    assert.equal(calls.registerUnknownContact.length, 0)
  }
  assert.equal(bilingual(texts, 'codigoInvalido'), `${es.bot.codigoInvalido}\n\n${en.bot.codigoInvalido}`)
})

test('"vincular" from a known number says the chat is already linked, without the logic', async () => {
  const { deps, calls } = fakeDeps({ known: 'user-a' })
  await handleIncoming(message('vincular K7M2PX'), deps)
  assert.deepEqual(calls.sendText, [[PHONE, es.bot.yaVinculado]])
  assert.equal(calls.linkChannel.length, 0)
  assert.equal(calls.handleKnown.length, 0)
})

test('"hola" from an unknown number is answered the first time and remembered', async () => {
  const { deps, calls } = fakeDeps({ firstContact: true })
  await handleIncoming(message('hola'), deps)
  assert.deepEqual(calls.registerUnknownContact, [['whatsapp', PHONE]])
  assert.deepEqual(calls.processUnknownNumber, [{ channel: 'whatsapp', externalId: PHONE, text: 'hola', answered: false }])
  assert.deepEqual(calls.sendText, [[PHONE, 'desconocido']])
  assert.equal(calls.linkChannel.length, 0)
  assert.equal(calls.handleKnown.length, 0)
})

test('"hola" from an unknown number already answered sends nothing', async () => {
  const { deps, calls } = fakeDeps({ firstContact: false })
  await handleIncoming(message('hola'), deps)
  assert.deepEqual(calls.processUnknownNumber, [{ channel: 'whatsapp', externalId: PHONE, text: 'hola', answered: true }])
  assert.equal(calls.sendText.length, 0)
})

test('a button press from an unknown number is dropped', async () => {
  const { deps, calls } = fakeDeps()
  await handleIncoming(message('', { buttonId: 'undo:00000000-0000-0000-0000-000000000000' }), deps)
  assert.equal(calls.sendText.length, 0)
  assert.equal(calls.registerUnknownContact.length, 0)
  assert.equal(calls.processUnknownNumber.length, 0)
  assert.equal(calls.linkChannel.length, 0)
})

test('any other message from a known number takes the known flow', async () => {
  const { deps, calls } = fakeDeps({ known: 'user-a' })
  const incoming = message('super 15')
  await handleIncoming(incoming, deps)
  assert.deepEqual(calls.handleKnown, [['user-a', incoming]])
  assert.equal(calls.sendText.length, 0)
})
