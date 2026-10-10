import { GoogleGenAI, type ContentListUnion } from '@google/genai'

import type { Model } from './parser'

/** Pinned by name, not an alias: an alias can move to another model and silently change the eval. */
export const GEMINI_MODEL = 'gemini-3.8-flash'

/**
 * Per call. Two attempts plus the reads, the write and the send must fit in the webhook's 60 s
 * (`maxDuration`); a hung call used to eat all of it and the function died without replying.
 * A 34 s voice note measured 7.4 s at worst (`add-voice-messages` design), so the same cap holds.
 */
export const GEMINI_TIMEOUT_MS = 20_000

/**
 * The parser's `model` over Gemini (design D1): JSON mode, temperature 0. The key is read inside
 * the function, not at module scope, so it comes from the runtime environment. A voice note goes
 * as a second, inline part of the same request (`add-voice-messages` D4): the bytes never leave
 * memory and nothing of them is logged.
 */
export function createGeminiModel(): Model {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) throw new Error('Missing GEMINI_API_KEY')

  const ai = new GoogleGenAI({ apiKey })

  return async ({ prompt, audio }) => {
    const contents: ContentListUnion = audio
      ? [{ role: 'user', parts: [{ text: prompt }, { inlineData: { mimeType: audio.mimeType, data: Buffer.from(audio.data).toString('base64') } }] }]
      : prompt
    const response = await ai.models.generateContent({
      model: GEMINI_MODEL,
      contents,
      config: {
        responseMimeType: 'application/json',
        temperature: 0,
        abortSignal: AbortSignal.timeout(GEMINI_TIMEOUT_MS),
      },
    })
    return response.text ?? ''
  }
}
