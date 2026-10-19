import { test } from 'node:test'
import assert from 'node:assert/strict'
import { z } from 'zod'
import { callTool } from './envelope.ts'
import { McpToolError } from './errors.ts'

const hints = { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false }
const tool = (run) => ({
  name: 'add_movement',
  title: 'Add a movement',
  description: '',
  input: z.object({ amount: z.number().positive(), description: z.string().optional() }),
  annotations: hints,
  run,
})

function deps(lines, context = async () => ({ usuarioId: '0123456789abcdef' })) {
  let t = 1000
  return { context, userIdOf: (c) => c.usuarioId, clientId: 'client-1', log: (line) => lines.push(line), now: () => (t += 7) }
}

test('a result travels as structured content and the same JSON text', async () => {
  const lines = []
  const result = await callTool(tool(async (_c, input) => ({ id: 'm1', amount: input.amount, currency: 'EUR' })), { amount: 12.5 }, deps(lines))
  assert.equal(result.isError, undefined)
  assert.deepEqual(result.structuredContent, { id: 'm1', amount: 12.5, currency: 'EUR' })
  assert.deepEqual(JSON.parse(result.content[0].text), result.structuredContent)
})

test('the log line names tool, client, short user, outcome and ms, and nothing of the content', async () => {
  const lines = []
  await callTool(tool(async () => ({ id: 'm1' })), { amount: 12.5, description: 'Café secreto' }, deps(lines))
  assert.deepEqual(lines, ['mcp tool=add_movement client=client-1 user=01234567 result=ok ms=7'])
  assert.doesNotMatch(lines[0], /12\.5|Café/)
})

test('a bad input is invalid-input, with no context built and nothing run', async () => {
  const lines = []
  let ran = false
  let built = false
  const result = await callTool(
    tool(async () => ((ran = true), {})),
    { amount: -3 },
    deps(lines, async () => ((built = true), { usuarioId: 'x' })),
  )
  assert.equal(result.isError, true)
  assert.equal(result.structuredContent.code, 'invalid-input')
  assert.equal(ran, false)
  assert.equal(built, false)
  assert.match(lines[0], /user=- result=invalid-input/)
})

test('a refusal and an unknown error become error results with their code', async () => {
  const lines = []
  const refused = await callTool(tool(async () => { throw new McpToolError('fixed-row', 'Use update_fixed_charge.') }), { amount: 1 }, deps(lines))
  assert.deepEqual(refused.structuredContent, { code: 'fixed-row', message: 'Use update_fixed_charge.' })
  const original = console.error
  console.error = () => {}
  try {
    const failed = await callTool(tool(async () => { throw new Error('db exploded') }), { amount: 1 }, deps(lines))
    assert.equal(failed.structuredContent.code, 'failed')
  } finally {
    console.error = original
  }
  assert.match(lines[1], /result=failed/)
})

test('an account that is not ready fails every call', async () => {
  const lines = []
  const result = await callTool(
    tool(async () => ({})),
    { amount: 1 },
    deps(lines, async () => { throw new McpToolError('account-not-ready', 'Finish the setup.') }),
  )
  assert.equal(result.structuredContent.code, 'account-not-ready')
})
