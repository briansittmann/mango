import { test, beforeEach, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { MAX_AUDIO_BYTES, downloadMedia } from './media.ts'

const realFetch = globalThis.fetch
const bytes = new Uint8Array([0x4f, 0x67, 0x67, 0x53, 1, 2, 3])

/** `responses` answer the lookup and the file request in order; a function gets the url and init. */
function fakeFetch(...responses) {
  const calls = []
  globalThis.fetch = async (url, init) => {
    calls.push({ url, init })
    const next = responses[calls.length - 1]
    return typeof next === 'function' ? next(url, init) : next
  }
  return calls
}

const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })
const lookup = (overrides = {}) => json({ url: 'https://lookaside.example/file?x=1', mime_type: 'audio/ogg; codecs=opus', file_size: bytes.length, ...overrides })

beforeEach(() => {
  process.env.WHATSAPP_TOKEN = 'token-1'
})
afterEach(() => {
  globalThis.fetch = realFetch
})

test('two bearer requests: the lookup by id, then the file at its url; returns bytes and MIME type', async () => {
  const calls = fakeFetch(lookup(), new Response(bytes, { status: 200 }))
  const result = await downloadMedia('media-1')
  assert.deepEqual(result, { data: bytes, mimeType: 'audio/ogg; codecs=opus' })
  assert.equal(calls.length, 2)
  assert.equal(calls[0].url, 'https://graph.facebook.com/v21.0/media-1')
  assert.equal(calls[1].url, 'https://lookaside.example/file?x=1')
  for (const call of calls) {
    assert.equal(call.init.headers.Authorization, 'Bearer token-1')
    assert.ok(call.init.signal instanceof AbortSignal)
  }
})

test('a file_size over the cap is refused before the second request', async () => {
  const calls = fakeFetch(lookup({ file_size: MAX_AUDIO_BYTES + 1 }))
  assert.deepEqual(await downloadMedia('media-2'), { error: 'too-large' })
  assert.equal(calls.length, 1)
})

test('a non-2xx on either request is a download error', async () => {
  fakeFetch(json({ error: 'nope' }, 400))
  assert.deepEqual(await downloadMedia('media-3'), { error: 'download' })

  fakeFetch(lookup(), new Response('gone', { status: 404 }))
  assert.deepEqual(await downloadMedia('media-4'), { error: 'download' })
})

test('a timeout or a network error never throws', async () => {
  fakeFetch(async () => {
    throw new DOMException('The operation was aborted due to timeout', 'TimeoutError')
  })
  assert.deepEqual(await downloadMedia('media-5'), { error: 'download' })

  fakeFetch(lookup(), async () => {
    throw new TypeError('fetch failed')
  })
  assert.deepEqual(await downloadMedia('media-6'), { error: 'download' })
})

test('a lookup without url, or a missing token, is a download error with no file request', async () => {
  const calls = fakeFetch(json({ mime_type: 'audio/ogg' }))
  assert.deepEqual(await downloadMedia('media-7'), { error: 'download' })
  assert.equal(calls.length, 1)

  delete process.env.WHATSAPP_TOKEN
  const none = fakeFetch()
  assert.deepEqual(await downloadMedia('media-8'), { error: 'download' })
  assert.equal(none.length, 0)
})
