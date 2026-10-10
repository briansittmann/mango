/**
 * Downloads a media file from the WhatsApp Cloud API (`add-voice-messages` design D2): one GET
 * for the media URL and size, one GET for the bytes, each with its own timeout and the bearer
 * `WHATSAPP_TOKEN`. Nothing touches the disk; the bytes live in memory for the request. Never
 * throws: every failure is a result the adapter turns into a reply.
 */

export type MediaResult = { data: Uint8Array; mimeType: string } | { error: 'download' | 'too-large' }

/**
 * A WhatsApp voice note is about 2 KB per second, so 30 s is ~60 KB and 1 MB is minutes of
 * speech: an abuse guard before the second request, not the 30 s rule (that one reads the audio).
 */
export const MAX_AUDIO_BYTES = 1_000_000

/** Per request. Two of these plus the model calls must fit the webhook's 60 s. */
export const MEDIA_TIMEOUT_MS = 10_000

const GRAPH_URL = 'https://graph.facebook.com/v21.0'

export async function downloadMedia(id: string): Promise<MediaResult> {
  const token = process.env.WHATSAPP_TOKEN
  if (!token) {
    console.error('[whatsapp] missing WHATSAPP_TOKEN, media not downloaded')
    return { error: 'download' }
  }
  const headers = { Authorization: `Bearer ${token}` }

  try {
    const meta = await fetch(`${GRAPH_URL}/${id}`, { headers, signal: AbortSignal.timeout(MEDIA_TIMEOUT_MS) })
    if (!meta.ok) {
      console.error(`[whatsapp] media ${id} lookup failed: ${meta.status}`)
      return { error: 'download' }
    }
    const info = (await meta.json()) as { url?: unknown; mime_type?: unknown; file_size?: unknown }
    if (typeof info.url !== 'string') {
      console.error(`[whatsapp] media ${id} lookup returned no url`)
      return { error: 'download' }
    }
    if (typeof info.file_size === 'number' && info.file_size > MAX_AUDIO_BYTES) {
      console.info(`[whatsapp] media ${id} refused: ${info.file_size} bytes`)
      return { error: 'too-large' }
    }

    const file = await fetch(info.url, { headers, signal: AbortSignal.timeout(MEDIA_TIMEOUT_MS) })
    if (!file.ok) {
      console.error(`[whatsapp] media ${id} download failed: ${file.status}`)
      return { error: 'download' }
    }
    const data = new Uint8Array(await file.arrayBuffer())
    if (data.byteLength > MAX_AUDIO_BYTES) {
      console.info(`[whatsapp] media ${id} refused after download: ${data.byteLength} bytes`)
      return { error: 'too-large' }
    }
    return { data, mimeType: typeof info.mime_type === 'string' ? info.mime_type : 'application/octet-stream' }
  } catch (error) {
    // A timeout, a network error or a body that isn't JSON: the URL is never logged, only the id.
    console.error(`[whatsapp] media ${id} download failed:`, error instanceof Error ? error.name : error)
    return { error: 'download' }
  }
}
