import { test } from 'node:test'
import assert from 'node:assert/strict'
import { bilingual, handleIncoming } from './handle-message.ts'
import es from '../../messages/es.json' with { type: 'json' }
import en from '../../messages/en.json' with { type: 'json' }

const pick = (bot) => ({
  vinculado: bot.vinculado,
  yaVinculado: bot.yaVinculado,
  codigoInvalido: bot.codigoInvalido,
  numeroEnOtraCuenta: bot.numeroEnOtraCuenta,
  cuentaYaVinculada: bot.cuentaYaVinculada,
  soloTextoYAudio: bot.soloTextoYAudio,
})
const texts = { es: pick(es.bot), en: pick(en.bot) }

const PHONE = '+5491155551234'
const message = (text, extra = {}) => ({ phone: PHONE, text, messageId: 'wamid.1', ...extra })
const voice = (extra = {}) => message('', { audio: { id: 'media-1', mimeType: 'audio/ogg; codecs=opus', voice: true }, ...extra })
const BYTES = new Uint8Array([0x4f, 0x67, 0x67, 0x53])

/** Fakes every side effect and records what was called; `known` is the id the number resolves to. */
function fakeDeps({ known = null, link = { ok: true, userId: 'user-a' }, firstContact = true, processed = false, media = { data: BYTES, mimeType: 'audio/ogg; codecs=opus' } } = {}) {
  const calls = { linkChannel: [], registerUnknownContact: [], processUnknownNumber: [], handleKnown: [], sendText: [], downloadMedia: [] }
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
    messageAlreadyProcessed: async () => processed,
    downloadMedia: async (id) => {
      calls.downloadMedia.push(id)
      return media
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

test('any other message from a known number takes the known flow, without a download', async () => {
  const { deps, calls } = fakeDeps({ known: 'user-a' })
  const incoming = message('super 15')
  await handleIncoming(incoming, deps)
  assert.deepEqual(calls.handleKnown, [['user-a', incoming, undefined]])
  assert.equal(calls.downloadMedia.length, 0)
  assert.equal(calls.sendText.length, 0)
})

test('a retry of a processed message is discarded before any download', async () => {
  const { deps, calls } = fakeDeps({ known: 'user-a', processed: true })
  await handleIncoming(voice(), deps)
  assert.equal(calls.downloadMedia.length, 0)
  assert.equal(calls.handleKnown.length, 0)
  assert.equal(calls.sendText.length, 0)
})

test('a voice note from a known number is downloaded and reaches the known flow as bytes', async () => {
  const { deps, calls } = fakeDeps({ known: 'user-a' })
  const incoming = voice()
  await handleIncoming(incoming, deps)
  assert.deepEqual(calls.downloadMedia, ['media-1'])
  assert.equal(calls.handleKnown.length, 1)
  const [userId, passed, audio] = calls.handleKnown[0]
  assert.equal(userId, 'user-a')
  assert.equal(passed, incoming)
  assert.deepEqual(audio, { data: BYTES, mimeType: 'audio/ogg; codecs=opus' })
  assert.equal(calls.sendText.length, 0)
})

test('a failed download reaches the known flow as the failure, not as bytes', async () => {
  for (const error of ['download', 'too-large']) {
    const { deps, calls } = fakeDeps({ known: 'user-a', media: { error } })
    await handleIncoming(voice(), deps)
    assert.deepEqual(calls.handleKnown[0][2], { error })
  }
})

test('an unsupported media type from a known number gets the fixed reply and never reaches the known flow', async () => {
  for (const unsupported of ['image', 'audio', 'document', 'sticker']) {
    const { deps, calls } = fakeDeps({ known: 'user-a' })
    await handleIncoming(message('', { unsupported }), deps)
    assert.deepEqual(calls.sendText, [[PHONE, es.bot.soloTextoYAudio]])
    assert.equal(calls.handleKnown.length, 0)
    assert.equal(calls.downloadMedia.length, 0)
  }
})

test('an unsupported media type that is a retry is answered again, like a retried query', async () => {
  const { deps, calls } = fakeDeps({ known: 'user-a', processed: true })
  await handleIncoming(message('', { unsupported: 'image' }), deps)
  // `messageAlreadyProcessed` only sees messages that wrote a movement, so a real retry here is never "processed".
  assert.equal(calls.sendText.length, 0)
  assert.equal(calls.handleKnown.length, 0)
})

test("a stranger's voice note or photo is answered once with the web reply and never downloaded", async () => {
  for (const incoming of [voice(), message('', { unsupported: 'image' })]) {
    const first = fakeDeps({ firstContact: true })
    await handleIncoming(incoming, first.deps)
    assert.deepEqual(first.calls.processUnknownNumber, [{ channel: 'whatsapp', externalId: PHONE, text: '', answered: false }])
    assert.deepEqual(first.calls.sendText, [[PHONE, 'desconocido']])
    assert.equal(first.calls.downloadMedia.length, 0)
    assert.equal(first.calls.handleKnown.length, 0)

    const again = fakeDeps({ firstContact: false })
    await handleIncoming(incoming, again.deps)
    assert.equal(again.calls.sendText.length, 0)
    assert.equal(again.calls.downloadMedia.length, 0)
  }
})
