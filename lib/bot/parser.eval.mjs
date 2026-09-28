/**
 * `npm run test:parser`: runs `parser-cases.json` against real Gemini (design D13). Needs
 * `GEMINI_API_KEY` and the network, so it is not part of `test:unit`. Cases run one after the
 * other; the paid tier (1000 requests per minute, ARCHITECTURE.md §1) needs no pacing.
 */

import { readFileSync } from 'node:fs'
import { createGeminiModel } from './gemini.ts'
import { parseMessage } from './parser.ts'

const { categorias, casos } = JSON.parse(readFileSync(new URL('./parser-cases.json', import.meta.url), 'utf8'))

/** Cases that need recurring names or a pending question; kept here, not in the recorded set. */
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
    pending: { tipo: 'gasto', monto: 50, diasAtras: 0 },
    esperado: { accion: 'cargar', tipo: 'gasto', monto: 50, categoria: 'Comida' },
  },
]

const model = createGeminiModel()
const today = new Date().toISOString().slice(0, 10)
let failures = 0

for (const caso of [...casos, ...extra]) {
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

  const ok = Object.entries(caso.esperado).every(([key, expected]) =>
    key === 'categoria' && typeof expected === 'string'
      ? typeof action[key] === 'string' && action[key].toLowerCase() === expected.toLowerCase()
      : action[key] === expected,
  )

  if (ok) {
    console.log(`ok    ${caso.mensaje}`)
  } else {
    failures++
    console.log(`FAIL  ${caso.mensaje}\n      expected ${JSON.stringify(caso.esperado)}\n      got      ${JSON.stringify(action)}`)
  }
}

const total = casos.length + extra.length
console.log(`\n${total - failures}/${total} passed`)
process.exit(failures > 0 ? 1 : 0)
