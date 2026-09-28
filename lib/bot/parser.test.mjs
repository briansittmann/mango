import { test } from 'node:test'
import assert from 'node:assert/strict'
import { ActionSchema, PENDING_HEADER, buildPrompt, parseMessage } from './parser.ts'

const categories = ['Vivienda', 'Comida', 'Transporte', 'Ocio', 'Salud', 'Suplementos', 'Suscripciones', 'Deudas', 'Otros']
const input = { text: 'nafta 45 ayer', categories, recurringNames: [], locale: 'es', today: '2026-10-01' }
const nafta = { accion: 'cargar', tipo: 'gasto', monto: 45, categoria: 'Transporte', dias_atras: 1 }

/** A fake model that returns `outputs` in order (an `Error` is thrown) and records its prompts. */
function fakeModel(...outputs) {
  const prompts = []
  const model = async (prompt) => {
    prompts.push(prompt)
    const output = outputs[prompts.length - 1]
    if (output instanceof Error) throw output
    return output
  }
  return { model, prompts }
}

test('valid JSON on the first call is parsed with one call', async () => {
  const { model, prompts } = fakeModel(JSON.stringify(nafta))
  const action = await parseMessage(input, model)
  assert.equal(prompts.length, 1)
  assert.deepEqual(action, { ...nafta, descripcion: null, recurrente: null })
})

test('broken JSON then valid JSON: two calls, the retry carries the previous output', async () => {
  const { model, prompts } = fakeModel('{"accion":"cargar","tipo":', JSON.stringify(nafta))
  const action = await parseMessage(input, model)
  assert.equal(prompts.length, 2)
  assert.equal(action.accion, 'cargar')
  assert.equal(action.monto, 45)
  assert.ok(prompts[1].includes('{"accion":"cargar","tipo":'))
})

test('two invalid outputs → no_entendido with exactly two calls, and the retry names the issue', async () => {
  const bad = JSON.stringify({ accion: 'bailar' })
  const { model, prompts } = fakeModel(bad, bad, bad)
  const action = await parseMessage(input, model)
  assert.deepEqual(action, { accion: 'no_entendido' })
  assert.equal(prompts.length, 2)
  assert.ok(prompts[1].includes('accion'))
})

test('a model that throws twice → no_disponible', async () => {
  const { model, prompts } = fakeModel(new Error('503'), new Error('503'), new Error('503'))
  const action = await parseMessage(input, model)
  assert.deepEqual(action, { accion: 'no_disponible' })
  assert.equal(prompts.length, 2)
})

test('a throw then an invalid output → no_entendido', async () => {
  const { model } = fakeModel(new Error('503'), JSON.stringify({ accion: 'bailar' }))
  assert.deepEqual(await parseMessage(input, model), { accion: 'no_entendido' })
})

test('a throw then a valid output → that action', async () => {
  const { model } = fakeModel(new Error('503'), JSON.stringify(nafta))
  assert.equal((await parseMessage(input, model)).accion, 'cargar')
})

test('monto as a string is rejected', () => {
  assert.equal(ActionSchema.safeParse({ ...nafta, monto: '45' }).success, false)
})

test('ahorro with monto 0 is rejected; negative ahorro and positive gasto pass', () => {
  assert.equal(ActionSchema.safeParse({ accion: 'cargar', tipo: 'ahorro', monto: 0 }).success, false)
  assert.equal(ActionSchema.safeParse({ accion: 'cargar', tipo: 'ahorro', monto: -100 }).success, true)
  assert.equal(ActionSchema.safeParse({ accion: 'cargar', tipo: 'gasto', monto: -5 }).success, false)
})

test('fields outside the contract are rejected', () => {
  assert.equal(ActionSchema.safeParse({ accion: 'borrar', monto: 3 }).success, false)
  assert.equal(ActionSchema.safeParse({ accion: 'corregir' }).success, false)
})

test('the prompt lists every category and has the pending block only when pending is set', () => {
  const plain = buildPrompt(input)
  for (const name of categories) assert.ok(plain.includes(name), name)
  assert.ok(!plain.includes(PENDING_HEADER))

  const withPending = buildPrompt({ ...input, text: 'comida', pending: { tipo: 'gasto', monto: 50, diasAtras: 0 } })
  assert.ok(withPending.includes(PENDING_HEADER))
  assert.ok(withPending.includes('50'))
})
