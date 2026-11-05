import { GoogleGenAI, ThinkingLevel, type Content, type ContentListUnion } from '@google/genai'

import type { AgentCall, AgentContent } from './agent'
import type { Model } from './parser'

/** Pinned by name, not an alias: an alias can move to another model and silently change the eval. */
export const GEMINI_MODEL = 'gemini-3.8-flash'

/**
 * The call after a failed one (a hang, a 503): another model, so one model's bad minute does not
 * take both attempts (26/10: two hung calls of 20 s each ended in "volvé a mandarlo"). Pinned too.
 */
export const GEMINI_FALLBACK_MODEL = 'gemini-3.7-flash'

/**
 * Per call. Two attempts plus the reads, the write and the send must fit in the webhook's 60 s
 * (`maxDuration`); a hung call used to eat all of it and the function died without replying.
 * A 34 s voice note measured 7.4 s at worst (`add-voice-messages` design), so 12 s still holds it.
 */
export const GEMINI_TIMEOUT_MS = 12_000

/**
 * Passed on every text call when set (`add-bot-batch-loads` D6); a voice note, and any call while
 * unset, runs the model's default thinking. With `LOW` every text case of `npm run test:parser`
 * passed on both models and a list of 12 parses in 4–5 s instead of 11–24 s, past the timeout;
 * voice transcriptions came back in digits ("café 350" for "café tres cincuenta"), so voice keeps
 * the default.
 */
export const GEMINI_TEXT_THINKING_LEVEL: ThinkingLevel | undefined = ThinkingLevel.LOW

/**
 * The parser's `model` over Gemini (design D1): JSON mode, temperature 0. The key is read inside
 * the function, not at module scope, so it comes from the runtime environment. A voice note goes
 * as a second, inline part of the same request (`add-voice-messages` D4): the bytes never leave
 * memory and nothing of them is logged. Once a call throws, the next ones go to `fallback`; a
 * retry after an invalid answer stays on `model`.
 */
export function createGeminiModel(model = GEMINI_MODEL, fallback = GEMINI_FALLBACK_MODEL): Model {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) throw new Error('Missing GEMINI_API_KEY')

  const ai = new GoogleGenAI({ apiKey })
  let failed = false

  return async ({ prompt, audio }) => {
    const contents: ContentListUnion = audio
      ? [{ role: 'user', parts: [{ text: prompt }, { inlineData: { mimeType: audio.mimeType, data: Buffer.from(audio.data).toString('base64') } }] }]
      : prompt
    try {
      const response = await ai.models.generateContent({
        model: failed ? fallback : model,
        contents,
        config: {
          responseMimeType: 'application/json',
          temperature: 0,
          abortSignal: AbortSignal.timeout(GEMINI_TIMEOUT_MS),
          ...(GEMINI_TEXT_THINKING_LEVEL && !audio ? { thinkingConfig: { thinkingLevel: GEMINI_TEXT_THINKING_LEVEL } } : {}),
        },
      })
      return response.text ?? ''
    } catch (error) {
      failed = true
      throw error
    }
  }
}

/**
 * The agent's model call (`add-bot-agent-mode` D4): the same models, timeout per call and switch to
 * the fallback as the parser, with the tools as function declarations and the system prompt as
 * `systemInstruction`. Text out, not JSON. The candidate's content goes back as it came (thought
 * signatures included), so the next call sees its own tool calls.
 */
export function createGeminiAgentCall(model = GEMINI_MODEL, fallback = GEMINI_FALLBACK_MODEL): AgentCall {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) throw new Error('Missing GEMINI_API_KEY')

  const ai = new GoogleGenAI({ apiKey })
  let failed = false

  return async ({ system, contents, tools, signal }) => {
    try {
      const response = await ai.models.generateContent({
        model: failed ? fallback : model,
        contents: contents as Content[],
        config: {
          systemInstruction: system,
          temperature: 0.2,
          abortSignal: AbortSignal.any([AbortSignal.timeout(GEMINI_TIMEOUT_MS), signal]),
          ...(GEMINI_TEXT_THINKING_LEVEL ? { thinkingConfig: { thinkingLevel: GEMINI_TEXT_THINKING_LEVEL } } : {}),
          ...(tools
            ? { tools: [{ functionDeclarations: tools.map((tool) => ({ name: tool.name, description: tool.description, parametersJsonSchema: tool.parameters })) }] }
            : {}),
        },
      })
      const content = response.candidates?.[0]?.content
      const text = (content?.parts ?? [])
        .filter((part) => typeof part.text === 'string' && !part.thought)
        .map((part) => part.text)
        .join('')
      const functionCalls = (response.functionCalls ?? []).flatMap((call) => (call.name ? [{ name: call.name, args: call.args, id: call.id }] : []))
      return { text, functionCalls, content: content as AgentContent | undefined }
    } catch (error) {
      failed = true
      throw error
    }
  }
}
