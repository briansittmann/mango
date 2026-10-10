import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { MAX_AUDIO_SECONDS, oggOpusDurationSeconds, refuseVoiceNote } from './audio.ts'
import { MAX_AUDIO_BYTES } from '../whatsapp/media.ts'

const fixture = (name) => new Uint8Array(readFileSync(new URL(`./voice-cases/${name}`, import.meta.url)))
const short = fixture('sintetico-3s.ogg')
const long = fixture('sintetico-38s.ogg')

test('the 3 s fixture measures 2.62 s within ±0.1 s (afinfo says 2.62)', () => {
  const seconds = oggOpusDurationSeconds(short)
  assert.ok(seconds !== null && Math.abs(seconds - 2.62) <= 0.1, String(seconds))
  assert.ok(seconds <= MAX_AUDIO_SECONDS)
})

test('the long fixture is over the limit', () => {
  const seconds = oggOpusDurationSeconds(long)
  assert.ok(seconds !== null && seconds > MAX_AUDIO_SECONDS, String(seconds))
  assert.ok(Math.abs(seconds - 38.66) <= 0.1, String(seconds))
})

test('random bytes, an empty buffer and a non-Opus Ogg are null', () => {
  const random = new Uint8Array(4096)
  for (let i = 0; i < random.length; i++) random[i] = (i * 7919 + 13) % 256
  assert.equal(oggOpusDurationSeconds(random), null)
  assert.equal(oggOpusDurationSeconds(new Uint8Array(0)), null)

  // "OggS" with a first packet that is not OpusHead.
  const notOpus = new Uint8Array(short)
  notOpus.set([0x56, 0x6f, 0x72, 0x62], 28) // "Vorb"
  assert.equal(oggOpusDurationSeconds(notOpus), null)
})

test('a truncated upload is null, not a guess', () => {
  assert.equal(oggOpusDurationSeconds(short.subarray(0, short.length - 100)), null)
})

test('the gate before the model: a long note, a failed download or undecodable bytes are refused; the short note passes', () => {
  assert.equal(refuseVoiceNote({ data: long }), 'too-long')
  assert.equal(refuseVoiceNote({ error: 'too-large' }), 'too-long')
  assert.equal(refuseVoiceNote({ error: 'download' }), 'undecodable')
  assert.equal(refuseVoiceNote({ data: new Uint8Array(64) }), 'undecodable')
  assert.equal(refuseVoiceNote({ data: short }), null)
})

test('the fixtures stay well under the download cap', () => {
  console.log(`sintetico-3s.ogg: ${short.byteLength} bytes · sintetico-38s.ogg: ${long.byteLength} bytes · cap ${MAX_AUDIO_BYTES}`)
  assert.ok(long.byteLength < MAX_AUDIO_BYTES / 4)
})
