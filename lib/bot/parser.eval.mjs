/**
 * `npm run test:parser`: runs `parser-cases.json` and the recorded voice notes of
 * `voice-cases/voice-cases.json` against real Gemini (design D13; `add-voice-messages` D10).
 * Needs `GEMINI_API_KEY` and the network, so it is not part of `test:unit`. Cases run one after
 * the other; the paid tier (1000 requests per minute, ARCHITECTURE.md §1) needs no pacing.
 */

import { existsSync, readFileSync } from 'node:fs'
import { createGeminiModel } from './gemini.ts'
import { parseMessage } from './parser.ts'

const { categorias, casos } = JSON.parse(readFileSync(new URL('./parser-cases.json', import.meta.url), 'utf8'))
const voiceCases = JSON.parse(readFileSync(new URL('./voice-cases/voice-cases.json', import.meta.url), 'utf8')).casos

/**
 * Cases that need recurring names; kept here, not in the recorded set. A case in either list may
 * carry `pending`, the channel's question (`PendingQuestion`), passed through as is.
 */
const extra = [
  {
    mensaje: 'netflix 13',
    recurringNames: ['Netflix'],
    esperado: { accion: 'cargar', tipo: 'gasto', monto: 13, recurrente: 'Netflix' },
  },
  {
    mensaje: 'cobré 2100',
    recurringNames: ['Sueldo'],
    esperado: { accion: 'cargar', tipo: 'ingreso', monto: 2100, recurrente: null },
  },
  {
    mensaje: 'comida',
    pending: { pregunta: 'categoria', tipo: 'gasto', monto: 50, diasAtras: 0 },
    esperado: { accion: 'cargar', tipo: 'gasto', monto: 50, categoria: 'Comida' },
  },
]

const model = createGeminiModel()
const today = new Date().toISOString().slice(0, 10)
let failures = 0

/** Case, accents and punctuation ignored, spaces collapsed: "¿Cómo vengo?" and "como vengo" are the same. */
const loose = (text) =>
  text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()

function matches(caso, action) {
  const fields = Object.entries(caso.esperado).every(([key, expected]) =>
    key === 'categoria' && typeof expected === 'string'
      ? typeof action[key] === 'string' && action[key].toLowerCase() === expected.toLowerCase()
      : action[key] === expected,
  )
  const heard = caso.transcripcion === undefined || (typeof action.transcripcion === 'string' && loose(action.transcripcion) === loose(caso.transcripcion))
  return fields && heard
}

function report(label, caso, action, ms) {
  if (matches(caso, action)) {
    console.log(`ok    ${label} (${ms} ms)`)
  } else {
    failures++
    const expected = { ...caso.esperado, ...(caso.transcripcion === undefined ? {} : { transcripcion: caso.transcripcion }) }
    console.log(`FAIL  ${label} (${ms} ms)\n      expected ${JSON.stringify(expected)}\n      got      ${JSON.stringify(action)}`)
  }
}

for (const caso of [...casos, ...extra]) {
  const started = performance.now()
  const action = await parseMessage(
    {
      text: caso.mensaje,
      categories: categorias,
      recurringNames: caso.recurringNames ?? [],
      locale: 'es',
      today,
      pending: caso.pending,
    },
    model,
  )
  report(caso.mensaje, caso, action, Math.round(performance.now() - started))
}

// The recorded notes go to the model as audio, with the same categories (`bot-message-parsing`, *Voice cases run too*).
for (const caso of voiceCases) {
  const url = new URL(`./voice-cases/${caso.archivo}`, import.meta.url)
  if (!existsSync(url)) {
    failures++
    console.log(`FAIL  🎤 ${caso.archivo}\n      missing: record it on WhatsApp and export it as Ogg/Opus into lib/bot/voice-cases/`)
    continue
  }
  const data = new Uint8Array(readFileSync(url))
  const started = performance.now()
  const action = await parseMessage(
    {
      text: '',
      audio: { data, mimeType: 'audio/ogg; codecs=opus' },
      categories: categorias,
      recurringNames: caso.recurringNames ?? [],
      locale: 'es',
      today,
      pending: caso.pending,
    },
    model,
  )
  report(`🎤 ${caso.archivo}`, caso, action, Math.round(performance.now() - started))
}

const total = casos.length + extra.length + voiceCases.length
console.log(`\n${total - failures}/${total} passed`)
process.exit(failures > 0 ? 1 : 0)
