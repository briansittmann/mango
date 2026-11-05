/**
 * `npm run test:agent`: runs the read cases of `agent-cases.json` against real Gemini with fake
 * tools that answer a fixed account (`add-bot-agent-mode` D7). Checks, per case: the tools called,
 * the texts the reply must name, and that every figure in the reply was read from a tool (no
 * invented number). Needs `GEMINI_API_KEY` and the network, so it is not part of `test:unit`.
 */

import { readFileSync } from 'node:fs'
import { buildAgentPrompt, runAgent } from './agent.ts'
import { GEMINI_MODEL, createGeminiAgentCall } from './gemini.ts'
import { MCP_INSTRUCTIONS } from '../mcp/instructions.ts'

const { casos } = JSON.parse(readFileSync(new URL('./agent-cases.json', import.meta.url), 'utf8'))

// A fixed account, shaped as `summaryOf`, `movementsOf` and `fixedChargesOf` shape theirs.
const summary = {
  currency: 'EUR',
  cycle: { month: '2026-11', start: '2026-11-01', end: '2026-11-30', in_progress: true, projected: false },
  income_total: 2400,
  expenses_total: 1236,
  savings: { cycle: 300, accumulated: 1200 },
  free_margin: 864,
  categories: [
    { id: 'c1', name: 'Vivienda', color: 'azul', total: 820, budget: null, show_progress: true },
    { id: 'c2', name: 'Comida', color: 'verde', total: 86.88, budget: { amount: 300, spent: 86.88, remaining: 213.12 }, show_progress: true },
    { id: 'c3', name: 'Transporte', color: 'naranja', total: 95.5, budget: null, show_progress: true },
    { id: 'c4', name: 'Ocio', color: 'rosa', total: 48, budget: { amount: 100, spent: 48, remaining: 52 }, show_progress: true },
    { id: 'c5', name: 'Salud', color: 'rojo', total: 24.9, budget: null, show_progress: true },
    { id: 'c6', name: 'Suscripciones', color: 'violeta', total: 12.99, budget: null, show_progress: true },
    { id: 'c7', name: 'Deportes', color: 'celeste', total: 50, budget: null, show_progress: true },
    { id: 'c8', name: 'Otros', color: 'gris', total: 97.73, budget: null, show_progress: true },
  ],
  cards: [],
}
const movements = {
  currency: 'EUR',
  cycle: summary.cycle,
  movements: [
    { id: 'm1', kind: 'expense', date: '2026-11-05', amount: 12.99, description: 'Netflix', category: 'Suscripciones', fixed: 'd2', charged: true },
    { id: 'm2', kind: 'expense', date: '2026-11-04', amount: 32.4, description: 'Súper', category: 'Comida' },
    { id: 'm3', kind: 'expense', date: '2026-11-03', amount: 54.48, description: 'Mercado', category: 'Comida' },
    { id: 'm4', kind: 'expense', date: '2026-11-02', amount: 48, description: 'Cine', category: 'Ocio' },
    { id: 'm5', kind: 'expense', date: '2026-11-01', amount: 820, description: 'Alquiler', category: 'Vivienda', fixed: 'd1', charged: true },
    { id: 'm6', kind: 'income', date: '2026-11-01', amount: 2400, description: 'Sueldo', fixed: 'd4', charged: true },
    { id: 'm7', kind: 'savings', date: '2026-11-01', amount: 300, description: null },
  ],
}
const fixed = {
  currency: 'EUR',
  cycle: summary.cycle,
  fixed_charges: [
    { id: 'd1', name: 'Alquiler', kind: 'expense', amount: 820, day: 1, category: 'Vivienda', active: true, this_month: { id: 'm5', amount: 820, date: '2026-11-01', charged: true } },
    { id: 'd2', name: 'Netflix', kind: 'expense', amount: 12.99, day: 5, category: 'Suscripciones', active: true, this_month: { id: 'm1', amount: 12.99, date: '2026-11-05', charged: true } },
    { id: 'd3', name: 'Gimnasio', kind: 'expense', amount: 50, day: 10, category: 'Deportes', active: true, this_month: { id: 'm8', amount: 50, date: '2026-11-10', charged: false } },
    { id: 'd4', name: 'Sueldo', kind: 'income', amount: 2400, day: 1, category: null, active: true, this_month: { id: 'm6', amount: 2400, date: '2026-11-01', charged: true } },
  ],
}
const results = { get_summary: summary, list_movements: movements, list_fixed_charges: fixed }

const today = '2026-11-05'
const system = buildAgentPrompt({
  locale: 'es',
  today,
  timezone: 'Europe/Madrid',
  currency: 'EUR',
  amountExample: '1.234,56 € o 300 €',
  categories: summary.categories.map((c) => c.name),
  cycleRules: MCP_INSTRUCTIONS,
  link: 'https://www.usemango.dev/dashboard',
  mcpUrl: 'https://www.usemango.dev/api/mcp',
})

/** Every number the fixtures carry, plus days of the month and the year: anything else in a reply was not read. */
const known = new Set([2026, ...Array.from({ length: 32 }, (_, i) => i)])
const collect = (value) => {
  if (typeof value === 'number') known.add(value)
  else if (value && typeof value === 'object') Object.values(value).forEach(collect)
}
collect(results)

const evalModel = process.env.GEMINI_EVAL_MODEL ?? GEMINI_MODEL
console.log(`model ${evalModel}`)
let failures = 0

const loose = (text) =>
  text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()

/** Figures as the bot writes them ("1.236,50", "86,88", "300"): thousands with a dot, decimals with a comma. */
function figuresOf(text) {
  return [...text.matchAll(/\d{1,3}(?:\.\d{3})+(?:,\d+)?|\d+(?:,\d+)?/g)].map((m) => Number(m[0].replaceAll('.', '').replace(',', '.')))
}

for (const caso of casos) {
  if (!caso.eval) {
    console.log(`skip  ${caso.mensaje}`)
    continue
  }
  const calls = []
  const tools = Object.entries(results).map(([name, result]) => ({
    name,
    description: `${name} (see the real tool)`,
    parameters: { type: 'object', properties: { month: { type: 'string' }, kind: { type: 'string' } } },
    run: async (args) => {
      calls.push(name)
      void args
      return result
    },
  }))
  const call = createGeminiAgentCall(evalModel, evalModel)
  const started = performance.now()
  const result = await runAgent({ system, history: [], message: caso.mensaje, tools, call })
  const ms = Math.round(performance.now() - started)
  const problems = []
  if (result.kind !== 'answered') problems.push(`result ${result.kind}`)
  const text = result.kind === 'answered' ? result.text : ''
  const called = new Set(calls)
  for (const name of caso.eval.herramientas ?? []) if (!called.has(name)) problems.push(`did not call ${name}`)
  if (caso.eval.alguna && caso.eval.herramientas === undefined && !caso.eval.alguna.some((name) => called.has(name))) problems.push(`called none of ${caso.eval.alguna.join('/')}`)
  // `herramientas: []` with `alguna`: reading those is allowed, not required; any other call is for nothing.
  const allowed = new Set([...(caso.eval.herramientas ?? []), ...(caso.eval.alguna ?? [])])
  const extra = calls.filter((name) => !allowed.has(name))
  if ((caso.eval.herramientas ?? []).length === 0 && extra.length > 0) problems.push(`called ${extra.join(', ')} for nothing`)
  for (const part of caso.eval.menciona ?? []) if (!loose(text).includes(loose(part))) problems.push(`does not name "${part}"`)
  // Examples of what to write («súper 35», "café 3") are not figures of the account.
  const invented = figuresOf(text.replace(/«[^»]*»|"[^"]*"|“[^”]*”/g, '')).filter((n) => !known.has(n))
  if (invented.length > 0) problems.push(`figures not read: ${invented.join(', ')}`)
  if (text.length > 600) problems.push(`too long (${text.length} chars)`)

  if (problems.length === 0) {
    console.log(`ok    ${caso.mensaje} (${ms} ms, ${calls.join(', ') || 'no tools'})\n      ${text.replaceAll('\n', '\n      ')}`)
  } else {
    failures++
    console.log(`FAIL  ${caso.mensaje} (${ms} ms, ${calls.join(', ') || 'no tools'})\n      ${problems.join('; ')}\n      ${text.replaceAll('\n', '\n      ')}`)
  }
}

console.log(failures === 0 ? 'all cases passed' : `${failures} case(s) failed`)
process.exit(failures === 0 ? 0 : 1)
