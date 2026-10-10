import { test } from 'node:test'
import assert from 'node:assert/strict'
import { extractMessages, messageKind } from './payload.ts'

const payload = (...messages) => ({ entry: [{ changes: [{ field: 'messages', value: { messages } }] }] })
const from = '34600111222'

test('a text message', () => {
  assert.deepEqual(extractMessages(payload({ id: 'wamid.A', from, type: 'text', text: { body: 'nafta 45' } })), [
    { phone: '+34600111222', text: 'nafta 45', messageId: 'wamid.A' },
  ])
})

test('a reply button press carries its id and no text', () => {
  const press = {
    id: 'wamid.B',
    from,
    type: 'interactive',
    interactive: { type: 'button_reply', button_reply: { id: 'undo:4b0c7f0e-8a5d-4c1e-9f3a-2d6b1e7c9a10', title: 'Deshacer' } },
  }
  assert.deepEqual(extractMessages(payload(press)), [
    { phone: '+34600111222', text: '', messageId: 'wamid.B', buttonId: 'undo:4b0c7f0e-8a5d-4c1e-9f3a-2d6b1e7c9a10' },
  ])
})

test('a voice note carries its media id and MIME type, with no text', () => {
  const note = { id: 'wamid.V', from, type: 'audio', audio: { id: 'media-1', mime_type: 'audio/ogg; codecs=opus', sha256: 'x', voice: true } }
  const [message] = extractMessages(payload(note))
  assert.deepEqual(message, { phone: '+34600111222', text: '', messageId: 'wamid.V', audio: { id: 'media-1', mimeType: 'audio/ogg; codecs=opus', voice: true } })
  assert.equal(messageKind(message), 'voice')
})

test('an attached audio file and the other media types are unsupported, each with its type', () => {
  const file = { id: 'wamid.F', from, type: 'audio', audio: { id: 'media-2', mime_type: 'audio/mpeg', voice: false } }
  const image = { id: 'wamid.D', from, type: 'image', image: { id: 'm' } }
  const document = { id: 'wamid.E', from, type: 'document', document: { id: 'm' } }
  const sticker = { id: 'wamid.G', from, type: 'sticker', sticker: { id: 'm' } }
  const video = { id: 'wamid.H', from, type: 'video', video: { id: 'm' } }
  const location = { id: 'wamid.I', from, type: 'location', location: { latitude: 0, longitude: 0 } }
  const contacts = { id: 'wamid.J', from, type: 'contacts', contacts: [] }
  const messages = extractMessages(payload(file, image, document, sticker, video, location, contacts))
  assert.deepEqual(
    messages.map((m) => [m.messageId, m.unsupported, m.text]),
    [
      ['wamid.F', 'audio', ''],
      ['wamid.D', 'image', ''],
      ['wamid.E', 'document', ''],
      ['wamid.G', 'sticker', ''],
      ['wamid.H', 'video', ''],
      ['wamid.I', 'location', ''],
      ['wamid.J', 'contacts', ''],
    ],
  )
  assert.ok(messages.every((m) => m.audio === undefined))
  assert.equal(messageKind(messages[1]), 'unsupported:image')
})

test('reactions and other interactive types are ignored', () => {
  const list = { id: 'wamid.C', from, type: 'interactive', interactive: { type: 'list_reply', list_reply: { id: 'x' } } }
  const reaction = { id: 'wamid.R', from, type: 'reaction', reaction: { message_id: 'wamid.A', emoji: '👍' } }
  assert.deepEqual(extractMessages(payload(list, reaction)), [])
})
