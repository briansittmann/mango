import { test } from 'node:test'
import assert from 'node:assert/strict'
import { extractTextMessages } from './payload.ts'

const payload = (...messages) => ({ entry: [{ changes: [{ field: 'messages', value: { messages } }] }] })

test('a text message', () => {
  assert.deepEqual(extractTextMessages(payload({ id: 'wamid.A', from: '34600111222', type: 'text', text: { body: 'nafta 45' } })), [
    { phone: '+34600111222', text: 'nafta 45', messageId: 'wamid.A' },
  ])
})

test('a reply button press carries its id and no text', () => {
  const press = {
    id: 'wamid.B',
    from: '34600111222',
    type: 'interactive',
    interactive: { type: 'button_reply', button_reply: { id: 'undo:4b0c7f0e-8a5d-4c1e-9f3a-2d6b1e7c9a10', title: 'Deshacer' } },
  }
  assert.deepEqual(extractTextMessages(payload(press)), [
    { phone: '+34600111222', text: '', messageId: 'wamid.B', buttonId: 'undo:4b0c7f0e-8a5d-4c1e-9f3a-2d6b1e7c9a10' },
  ])
})

test('other interactive types and message types are ignored', () => {
  const list = { id: 'wamid.C', from: '34600111222', type: 'interactive', interactive: { type: 'list_reply', list_reply: { id: 'x' } } }
  const image = { id: 'wamid.D', from: '34600111222', type: 'image', image: { id: 'm' } }
  assert.deepEqual(extractTextMessages(payload(list, image)), [])
})
