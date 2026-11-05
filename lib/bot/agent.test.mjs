import { test } from 'node:test'
import assert from 'node:assert/strict'
import { AGENT_TIMEOUT_MS, MAX_AGENT_STEPS, buildAgentPrompt, runAgent } from './agent.ts'

const summary = { currency: 'EUR', free_margin: 864, categories: [{ name: 'Comida', total: 86.88, budget: { amount: 300, spent: 86.88, remaining: 213.12 } }] }

/** A tool that records its arguments and answers `result` (an `Error` makes it answer an error object, as the envelope does). */
function fakeTool(name, result = summary) {
  const calls = []
  return {
    calls,
    tool: {
      name,
      description: `${name} description`,
      parameters: { type: 'object', properties: { month: { type: 'string' } } },
      run: async (args) => {
        calls.push(args)
        return result instanceof Error ? { code: 'failed', message: result.message } : result
      },
    },
  }
}

/** A model that answers `responses` in order (an `Error` is thrown) and records every request. */
function fakeCall(...responses) {
  const requests = []
  const call = async (request) => {
    requests.push(request)
    const response = responses[requests.length - 1]
    if (response instanceof Error) throw response
    return response
  }
  return { call, requests }
}

const text = (t) => ({ text: t, functionCalls: [] })
const calls = (...functionCalls) => ({ text: '', functionCalls, content: { role: 'model', parts: functionCalls.map((functionCall) => ({ functionCall })) } })
const base = { system: 'SYSTEM', history: [], message: '¿cómo vengo en Comida?' }

test('text without a function call is the answer, after one call', async () => {
  const { tool, calls: toolCalls } = fakeTool('get_summary')
  const { call, requests } = fakeCall(text('👋 Hola'))
  const result = await runAgent({ ...base, message: 'Hola', tools: [tool], call })
  assert.deepEqual(result, { kind: 'answered', text: '👋 Hola', toolCalls: [] })
  assert.equal(requests.length, 1)
  assert.equal(requests[0].system, 'SYSTEM')
  assert.deepEqual(requests[0].contents, [{ role: 'user', parts: [{ text: 'Hola' }] }])
  assert.deepEqual(requests[0].tools, [tool])
  assert.deepEqual(toolCalls, [])
})

test('a function call runs the tool, echoes the model turn and the result, and the next text answers', async () => {
  const { tool, calls: toolCalls } = fakeTool('get_summary')
  const { call, requests } = fakeCall(calls({ name: 'get_summary', args: { month: '2026-11' }, id: 'c1' }), text('📊 Comida: 86,88 € de 300 €'))
  const result = await runAgent({ ...base, tools: [tool], call })
  assert.deepEqual(result, { kind: 'answered', text: '📊 Comida: 86,88 € de 300 €', toolCalls: ['get_summary'] })
  assert.deepEqual(toolCalls, [{ month: '2026-11' }])
  assert.equal(requests.length, 2)
  const [, second] = requests
  assert.deepEqual(second.contents.slice(1), [
    { role: 'model', parts: [{ functionCall: { name: 'get_summary', args: { month: '2026-11' }, id: 'c1' } }] },
    { role: 'user', parts: [{ functionResponse: { name: 'get_summary', response: summary, id: 'c1' } }] },
  ])
})

test('several calls in one response run in parallel and come back in one user turn, without ids when the model gave none', async () => {
  const a = fakeTool('get_summary', { a: 1 })
  const b = fakeTool('list_movements', { b: 2 })
  const { call, requests } = fakeCall(calls({ name: 'get_summary', args: {} }, { name: 'list_movements', args: { kind: 'expense' } }), text('ok'))
  const result = await runAgent({ ...base, tools: [a.tool, b.tool], call })
  assert.deepEqual(result.toolCalls, ['get_summary', 'list_movements'])
  assert.deepEqual(requests[1].contents.at(-1), {
    role: 'user',
    parts: [{ functionResponse: { name: 'get_summary', response: { a: 1 } } }, { functionResponse: { name: 'list_movements', response: { b: 2 } } }],
  })
})

test('an unknown tool name goes back to the model as an error naming the tools, and nothing throws', async () => {
  const { tool } = fakeTool('get_summary')
  const { call, requests } = fakeCall(calls({ name: 'delete_everything', args: {} }), text('🤔 No puedo'))
  const result = await runAgent({ ...base, tools: [tool], call })
  assert.equal(result.kind, 'answered')
  const response = requests[1].contents.at(-1).parts[0].functionResponse.response
  assert.equal(response.code, 'unknown-tool')
  assert.match(response.message, /get_summary/)
})

test('a tool error is what the model reads; the loop goes on', async () => {
  const { tool } = fakeTool('get_summary', new Error('boom'))
  const { call, requests } = fakeCall(calls({ name: 'get_summary' }), text('🤔 No pude leer el resumen'))
  const result = await runAgent({ ...base, tools: [tool], call })
  assert.deepEqual(result, { kind: 'answered', text: '🤔 No pude leer el resumen', toolCalls: ['get_summary'] })
  assert.deepEqual(requests[1].contents.at(-1).parts[0].functionResponse.response, { code: 'failed', message: 'boom' })
})

test('the last step runs without tools and its text is the answer', async () => {
  const { tool } = fakeTool('get_summary')
  const responses = Array.from({ length: MAX_AGENT_STEPS - 1 }, () => calls({ name: 'get_summary', args: {} }))
  const { call, requests } = fakeCall(...responses, text('📊 Listo'))
  const result = await runAgent({ ...base, tools: [tool], call })
  assert.deepEqual(result, { kind: 'answered', text: '📊 Listo', toolCalls: Array(MAX_AGENT_STEPS - 1).fill('get_summary') })
  assert.equal(requests.length, MAX_AGENT_STEPS)
  assert.deepEqual(requests.slice(0, -1).map((request) => request.tools !== undefined), Array(MAX_AGENT_STEPS - 1).fill(true))
  assert.equal(requests.at(-1).tools, undefined)
})

test('a failed call is retried once with the same contents; two in a row are unavailable', async () => {
  const { tool } = fakeTool('get_summary')
  const retried = fakeCall(new Error('503'), text('👋'))
  assert.deepEqual(await runAgent({ ...base, tools: [tool], call: retried.call }), { kind: 'answered', text: '👋', toolCalls: [] })
  assert.deepEqual(retried.requests[0].contents, retried.requests[1].contents)

  const twice = fakeCall(new Error('503'), new Error('timeout'))
  assert.deepEqual(await runAgent({ ...base, tools: [tool], call: twice.call }), { kind: 'unavailable' })
  assert.equal(twice.requests.length, 2)
})

test('a response with neither text nor a call counts as a failure', async () => {
  const { tool } = fakeTool('get_summary')
  const { call, requests } = fakeCall(text('  '), text('👋 Hola'))
  assert.deepEqual(await runAgent({ ...base, tools: [tool], call }), { kind: 'answered', text: '👋 Hola', toolCalls: [] })
  assert.equal(requests.length, 2)
  const empty = fakeCall(text(''), text(''))
  assert.deepEqual(await runAgent({ ...base, tools: [tool], call: empty.call }), { kind: 'unavailable' })
})

test('the budget spent is unavailable, with no further call', async () => {
  const { tool } = fakeTool('get_summary')
  let t = 0
  const now = () => t
  const { call, requests } = fakeCall(calls({ name: 'get_summary', args: {} }), text('never'))
  const slowCall = async (request) => {
    t += AGENT_TIMEOUT_MS + 1
    return call(request)
  }
  assert.deepEqual(await runAgent({ ...base, tools: [tool], call: slowCall, now }), { kind: 'unavailable' })
  assert.equal(requests.length, 1)
})

test('the history goes first as previous turns, the user as user and the bot as model', async () => {
  const { tool } = fakeTool('get_summary')
  const { call, requests } = fakeCall(text('ok'))
  await runAgent({
    ...base,
    history: [
      { direction: 'entrante', text: 'almuerzo 12' },
      { direction: 'saliente', text: 'Anotado ✅ Almuerzo · 12 €' },
    ],
    tools: [tool],
    call,
  })
  assert.deepEqual(requests[0].contents, [
    { role: 'user', parts: [{ text: 'almuerzo 12' }] },
    { role: 'model', parts: [{ text: 'Anotado ✅ Almuerzo · 12 €' }] },
    { role: 'user', parts: [{ text: '¿cómo vengo en Comida?' }] },
  ])
})

test('the prompt names the account, the amount format, the cycle rules, the categories, the link and the read-only rule', () => {
  const prompt = buildAgentPrompt({
    locale: 'es',
    today: '2026-11-05',
    timezone: 'Europe/Madrid',
    currency: 'EUR',
    amountExample: '1.234,56 € o 300 €',
    categories: ['Comida', 'Ocio'],
    cycleRules: 'CYCLE RULES',
    link: 'https://www.usemango.dev/dashboard',
  })
  for (const part of ['2026-11-05', 'Europe/Madrid', 'EUR', '1.234,56 € o 300 €', 'CYCLE RULES', 'Comida, Ocio', 'https://www.usemango.dev/dashboard', 'voseo', 'get_summary', 'list_movements', 'list_fixed_charges', 'Solo leés']) {
    assert.ok(prompt.includes(part), `prompt lacks ${part}`)
  }
  assert.match(buildAgentPrompt({ locale: 'en', today: '', timezone: '', currency: '', amountExample: '', categories: [], cycleRules: '', link: '' }), /inglés/)
})
