import { GoogleGenAI } from '@google/genai'

import type { Model } from './parser'

/** Pinned by name, not an alias: an alias can move to another model and silently change the eval. */
export const GEMINI_MODEL = 'gemini-3.8-flash'

/**
 * The parser's `model` over Gemini (design D1): JSON mode, temperature 0. The key is read inside
 * the function, not at module scope, so it comes from the runtime environment.
 */
export function createGeminiModel(): Model {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) throw new Error('Missing GEMINI_API_KEY')

  const ai = new GoogleGenAI({ apiKey })

  return async (prompt) => {
    const response = await ai.models.generateContent({
      model: GEMINI_MODEL,
      contents: prompt,
      config: { responseMimeType: 'application/json', temperature: 0 },
    })
    return response.text ?? ''
  }
}
