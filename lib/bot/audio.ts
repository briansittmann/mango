/**
 * Duration of a voice note from its bytes (`add-voice-messages` design D3). Pure: no dependency,
 * only the Ogg container and the `OpusHead` of the first page. The 30 s rule of the bot lives
 * next to it because it is a product rule, the same for every channel.
 */

/** The longest voice note the bot sends to the model. One constant for every account. */
export const MAX_AUDIO_SECONDS = 30

/**
 * Why a voice note is refused before any model call (design D8): the adapter could not fetch it
 * or the bytes are not a decodable note (`undecodable`), or it is over the limit, by size or by
 * measured duration (`too-long`). Null when the note goes to the model.
 */
export function refuseVoiceNote(audio: { data: Uint8Array } | { error: 'download' | 'too-large' }): 'too-long' | 'undecodable' | null {
  if ('error' in audio) return audio.error === 'too-large' ? 'too-long' : 'undecodable'
  const seconds = oggOpusDurationSeconds(audio.data)
  if (seconds === null) return 'undecodable'
  return seconds > MAX_AUDIO_SECONDS ? 'too-long' : null
}

/** Opus granule positions always count at 48 kHz, whatever the input rate. */
const OPUS_RATE = 48_000

const OGGS = [0x4f, 0x67, 0x67, 0x53] // "OggS"
const OPUS_HEAD = [0x4f, 0x70, 0x75, 0x73, 0x48, 0x65, 0x61, 0x64] // "OpusHead"

/**
 * Seconds of audio in an Ogg/Opus stream: the last page's granule position minus the pre-skip of
 * `OpusHead`. Null when the data is not Ogg/Opus, or when its pages do not add up (a truncated
 * upload): nothing is sent to the model on a guess.
 */
export function oggOpusDurationSeconds(data: Uint8Array): number | null {
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength)
  let offset = 0
  let preSkip: number | null = null
  let lastGranule: number | null = null

  while (offset < data.byteLength) {
    if (offset + 27 > data.byteLength || !matches(data, offset, OGGS)) return null
    // 64-bit little-endian granule, read as two words: no BigInt (the TS target is ES2017).
    const low = view.getUint32(offset + 6, true)
    const high = view.getUint32(offset + 10, true)
    const noPacketEnds = low === 0xffffffff && high === 0xffffffff
    const segments = data[offset + 26]
    const headerEnd = offset + 27 + segments
    if (headerEnd > data.byteLength) return null

    let bodyLength = 0
    for (let i = 0; i < segments; i++) bodyLength += data[offset + 27 + i]
    const pageEnd = headerEnd + bodyLength
    if (pageEnd > data.byteLength) return null

    if (offset === 0) {
      // The first page holds the identification header alone: "OpusHead" and the pre-skip at bytes 10–11.
      if (bodyLength < 19 || !matches(data, headerEnd, OPUS_HEAD)) return null
      preSkip = view.getUint16(headerEnd + 10, true)
    }

    // -1 marks a page where no packet ends; its granule says nothing about time.
    if (!noPacketEnds) lastGranule = high * 0x1_0000_0000 + low
    offset = pageEnd
  }

  if (preSkip === null || lastGranule === null) return null
  const samples = lastGranule - preSkip
  return samples <= 0 ? 0 : samples / OPUS_RATE
}

function matches(data: Uint8Array, offset: number, bytes: number[]): boolean {
  return bytes.every((byte, i) => data[offset + i] === byte)
}
