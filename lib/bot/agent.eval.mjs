/**
 * `npm run test:agent`: runs the cases of `agent-cases.json` against real Gemini with fake tools
 * that answer a fixed account (`add-bot-agent-mode` D7; writes in `add-bot-agent-writes` D6).
 * Checks, per case: the read tools called, the writes proposed (`plan`: the loop never runs them),
 * the texts the reply must name, and that every figure in the reply was read from a tool or said
 * by the person (no invented number). Needs `GEMINI_API_KEY` and the network, so it is not part of
 * `test:unit`.
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

// The sixteen write tools, by hand (the real ones import Supabase through `@/`): same names, the
// gist of each description and the arguments the cases use. `confirm` keeps the loop from running them.
const id = { type: 'string' }
const scope = { type: 'string', enum: ['only_this_month', 'from_this_month'] }
const WRITE_TOOLS = [
  ['add_movement', 'Record a one-off movement: an expense (in a category), an income, a savings deposit or withdrawal, or a transfer. The date defaults to today. Never creates a fixed charge.', { kind: { type: 'string', enum: ['expense', 'income', 'savings', 'transfer'] }, amount: { type: 'number' }, description: { type: 'string' }, date: { type: 'string', description: 'YYYY-MM-DD' }, category_id: id, payment_method: { type: 'string' }, direction: { type: 'string' }, already_saved: { type: 'boolean' }, into: { type: 'string' } }],
  ['update_movement', 'Change a one-off movement by id: only the fields given change. A row of a fixed charge is refused: use update_fixed_charge.', { id, amount: { type: 'number' }, description: { type: 'string' }, date: { type: 'string' }, category_id: id, payment_method: { type: 'string' } }],
  ['delete_movement', 'Delete a one-off movement by id: it leaves every figure at once and can be brought back with restore_movement. A row of a fixed charge is refused: use delete_fixed_charge.', { id }],
  ['restore_movement', 'Undo delete_movement: the movement is back with the same id.', { id }],
  ['create_category', 'Create an expense category from the month given on (default the cycle in progress), with an optional budget.', { name: { type: 'string' }, color: { type: 'string' }, budget: { type: 'number' }, month: { type: 'string' }, scope }],
  ['update_category', 'Change a category’s name, colour, budget (a number, or null for none) or whether its card shows the budget bar. In the cycle in progress a budget change takes scope only_this_month or from_this_month (the default); in a projected month scope is required.', { id, month: { type: 'string' }, name: { type: 'string' }, color: { type: 'string' }, budget: { type: ['number', 'null'] }, show_progress: { type: 'boolean' }, scope }],
  ['delete_category', 'Delete a category from the month given. only_this_month hides it in that cycle alone; from_this_month ends it there. reassign_to names the category its expenses and fixed charges move to.', { id, scope, reassign_to: id, month: { type: 'string' } }],
  ['reorder_categories', 'Set the order categories are shown in: the ids of the cycle in progress, each once, in the new order.', { category_ids: { type: 'array', items: id } }],
  ['create_fixed_charge', 'Create a fixed charge (expense or income) that repeats every month on a day, with amount, category and optional instalments.', { kind: { type: 'string' }, name: { type: 'string' }, amount: { type: 'number' }, day: { type: 'integer' }, category_id: id, repetitions: { type: 'integer' } }],
  ['update_fixed_charge', 'Change a fixed charge: amount, day, name, category, card, reminder; scope only_this_month or from_this_month.', { id, amount: { type: 'number' }, day: { type: 'integer' }, name: { type: 'string' }, category_id: id, scope, month: { type: 'string' } }],
  ['set_fixed_charged', 'Mark a fixed charge as charged (true) or pending (false) in the month given, default the cycle in progress.', { id, charged: { type: 'boolean' }, month: { type: 'string' } }],
  ['delete_fixed_charge', 'Stop or delete a fixed charge: stop, only_this_month, from_this_month or everywhere.', { id, mode: { type: 'string', enum: ['stop', 'only_this_month', 'from_this_month', 'everywhere'] }, month: { type: 'string' } }],
  ['restore_fixed_charge_month', 'Bring back a fixed charge’s row deleted for one month.', { id, month: { type: 'string' } }],
  ['create_card', 'Create a card (a name and a colour) and optionally assign fixed charges to it.', { name: { type: 'string' }, color: { type: 'string' }, fixed_charge_ids: { type: 'array', items: id } }],
  ['update_card', 'Change a card’s name, colour or the fixed charges on it.', { id, name: { type: 'string' }, color: { type: 'string' }, fixed_charge_ids: { type: 'array', items: id } }],
  ['delete_card', 'Delete a card; its fixed charges are left without a card.', { id }],
].map(([name, description, properties]) => ({ name, description, parameters: { type: 'object', properties }, confirm: true, run: async () => ({ ok: true }) }))

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

/** Case, accents and WhatsApp bold aside: "café *3 €*" names "café 3". */
const loose = (text) =>
  text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replaceAll('*', '')
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
  const tools = [
    ...Object.entries(results).map(([name, result]) => ({
      name,
      description: `${name} (see the real tool)`,
      parameters: { type: 'object', properties: { month: { type: 'string' }, kind: { type: 'string' } } },
      run: async (args) => {
        calls.push(name)
        void args
        return result
      },
    })),
    ...WRITE_TOOLS,
  ]
  const call = createGeminiAgentCall(evalModel, evalModel)
  const started = performance.now()
  const result = await runAgent({ system, history: [], message: caso.mensaje, tools, call })
  const ms = Math.round(performance.now() - started)
  const problems = []
  const plan = caso.eval.plan ?? []
  const expectedKind = plan.length > 0 ? 'confirm' : 'answered'
  if (result.kind !== expectedKind) problems.push(`result ${result.kind}, expected ${expectedKind}`)
  const text = result.kind === 'unavailable' ? '' : result.text
  // The plan: every expected write once, with the arguments given (a subset), and no other write.
  const proposed = result.kind === 'confirm' ? [...result.calls] : []
  for (const expected of plan) {
    const at = proposed.findIndex((call) => call.name === expected.name && Object.entries(expected.args).every(([key, value]) => JSON.stringify(call.args[key]) === JSON.stringify(value)))
    if (at < 0) problems.push(`did not propose ${expected.name} ${JSON.stringify(expected.args)}`)
    else proposed.splice(at, 1)
  }
  for (const call of proposed) problems.push(`also proposed ${call.name} ${JSON.stringify(call.args)}`)
  const called = new Set(calls)
  for (const name of caso.eval.herramientas ?? []) if (!called.has(name)) problems.push(`did not call ${name}`)
  if (caso.eval.alguna && caso.eval.herramientas === undefined && !caso.eval.alguna.some((name) => called.has(name))) problems.push(`called none of ${caso.eval.alguna.join('/')}`)
  // `herramientas: []` with `alguna`: reading those is allowed, not required; any other call is for nothing.
  const allowed = new Set([...(caso.eval.herramientas ?? []), ...(caso.eval.alguna ?? [])])
  const extra = calls.filter((name) => !allowed.has(name))
  if ((caso.eval.herramientas ?? []).length === 0 && extra.length > 0) problems.push(`called ${extra.join(', ')} for nothing`)
  for (const part of caso.eval.menciona ?? []) if (!loose(text).includes(loose(part))) problems.push(`does not name "${part}"`)
  // Examples of what to write («súper 35», "café 3") and the person's own figures are not invented either.
  // "7,000" said by the person may be 7 or 7000: both readings count as said.
  const said = new Set([...figuresOf(caso.mensaje), ...[...caso.mensaje.matchAll(/\d[\d.,]*/g)].map((m) => Number(m[0].replace(/[.,]/g, '')))])
  const invented = figuresOf(text.replace(/«[^»]*»|"[^"]*"|“[^”]*”/g, '')).filter((n) => !known.has(n) && !said.has(n))
  if (invented.length > 0) problems.push(`figures not read: ${invented.join(', ')}`)
  if (text.length > 600) problems.push(`too long (${text.length} chars)`)

  if (problems.length === 0) {
    const planned = result.kind === 'confirm' ? ` → ${result.calls.map((call) => `${call.name} ${JSON.stringify(call.args)}`).join('; ')}` : ''
    console.log(`ok    ${caso.mensaje} (${ms} ms, ${calls.join(', ') || 'no tools'}${planned})\n      ${text.replaceAll('\n', '\n      ')}`)
  } else {
    failures++
    console.log(`FAIL  ${caso.mensaje} (${ms} ms, ${calls.join(', ') || 'no tools'})\n      ${problems.join('; ')}\n      ${text.replaceAll('\n', '\n      ')}`)
  }
}

console.log(failures === 0 ? 'all cases passed' : `${failures} case(s) failed`)
process.exit(failures === 0 ? 0 : 1)
