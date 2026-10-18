import { test } from 'node:test'
import assert from 'node:assert/strict'
import { ActionSchema, HISTORY_HEADER, PENDING_HEADER, VOICE_HEADER, VoiceActionSchema, buildPrompt, parseMessage } from './parser.ts'

const categories = ['Vivienda', 'Comida', 'Transporte', 'Ocio', 'Salud', 'Suplementos', 'Suscripciones', 'Deudas', 'Otros']
const input = { text: 'nafta 45 ayer', categories, recurringNames: [], locale: 'es', today: '2026-10-01' }
const nafta = { accion: 'cargar', tipo: 'gasto', monto: 45, categoria: 'Transporte', dias_atras: 1 }
const audio = { data: new Uint8Array([0x4f, 0x67, 0x67, 0x53]), mimeType: 'audio/ogg; codecs=opus' }
const voiceInput = { ...input, text: '', audio }

/** A fake model that returns `outputs` in order (an `Error` is thrown) and records its prompts and audio. */
function fakeModel(...outputs) {
  const prompts = []
  const audios = []
  const model = async ({ prompt, audio }) => {
    prompts.push(prompt)
    audios.push(audio)
    const output = outputs[prompts.length - 1]
    if (output instanceof Error) throw output
    return output
  }
  return { model, prompts, audios }
}

test('valid JSON on the first call is parsed with one call', async () => {
  const { model, prompts, audios } = fakeModel(JSON.stringify(nafta))
  const action = await parseMessage(input, model)
  assert.equal(prompts.length, 1)
  assert.deepEqual(audios, [undefined])
  assert.deepEqual(action, { ...nafta, descripcion: null, recurrente: null, medio_pago: null })
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

  const withPending = buildPrompt({ ...input, text: 'comida', pending: { pregunta: 'categoria', tipo: 'gasto', monto: 50, diasAtras: 0 } })
  assert.ok(withPending.includes(PENDING_HEADER))
  assert.ok(withPending.includes('50'))
})

test('the history block appears only with history, in order, before the pending block', () => {
  assert.ok(!buildPrompt(input).includes(HISTORY_HEADER))
  assert.ok(!buildPrompt({ ...input, history: [] }).includes(HISTORY_HEADER))

  const prompt = buildPrompt({
    ...input,
    text: 'comida',
    history: [
      { direction: 'entrante', text: 'almuerzo 12' },
      { direction: 'saliente', text: 'Anotado ✅ Almuerzo · 12 € en Comida.' },
    ],
    pending: { pregunta: 'categoria', tipo: 'gasto', monto: 50, diasAtras: 0 },
  })
  const history = prompt.indexOf(HISTORY_HEADER)
  const user = prompt.indexOf('Usuario: almuerzo 12')
  const bot = prompt.indexOf('Mango: Anotado ✅ Almuerzo')
  assert.ok(history >= 0 && history < user && user < bot && bot < prompt.indexOf(PENDING_HEADER))
})

test('the creation pending block names the category and the similar one', () => {
  const prompt = buildPrompt({
    ...input,
    text: 'sí',
    pending: { pregunta: 'crear_categoria', nombre: 'Mascota', presupuesto: 200, parecida: 'Mascotas' },
  })
  const block = prompt.slice(prompt.indexOf(PENDING_HEADER))
  assert.ok(block.includes('"Mascota"'))
  assert.ok(block.includes('"Mascotas"'))
  assert.ok(block.includes('"confirmada":true'))
  assert.ok(block.includes('"presupuesto":200'))
})

test('crear_categoria: confirmada defaults to false, presupuesto must be positive', () => {
  assert.deepEqual(ActionSchema.parse({ accion: 'crear_categoria', nombre: 'Viajes' }), {
    accion: 'crear_categoria',
    nombre: 'Viajes',
    confirmada: false,
  })
  assert.equal(ActionSchema.safeParse({ accion: 'crear_categoria', nombre: 'Viajes', presupuesto: 0 }).success, false)
  assert.equal(ActionSchema.safeParse({ accion: 'crear_categoria', nombre: 'Viajes', presupuesto: 200 }).success, true)
})

test('the voice section and transcripcion appear only with audio; the text prompt has no trace of them', () => {
  const text = buildPrompt(input)
  assert.ok(!text.includes(VOICE_HEADER))
  assert.ok(!text.includes('transcripcion'))
  assert.ok(text.endsWith('MENSAJE\nnafta 45 ayer'))

  const voice = buildPrompt(voiceInput)
  assert.ok(voice.includes(VOICE_HEADER))
  assert.ok(voice.includes('"doce con cuarenta" → 12.4'))
  assert.ok(voice.includes('solo el primero'))
  assert.ok(voice.includes('{"accion":"borrar","transcripcion":string}'))
  assert.ok(voice.includes('{"accion":"no_entendido","transcripcion":string}'))
  assert.ok(voice.includes('"transcripcion":"borrá eso"'))
  assert.ok(!voice.includes('MENSAJE\nnafta'))
})

test('with audio the fake model receives the audio on both attempts and the action carries transcripcion', async () => {
  const heard = { ...nafta, transcripcion: 'nafta cuarenta y cinco ayer' }
  const { model, audios } = fakeModel('{"accion":', JSON.stringify(heard))
  const action = await parseMessage(voiceInput, model)
  assert.deepEqual(audios, [audio, audio])
  assert.deepEqual(action, { ...heard, descripcion: null, recurrente: null, medio_pago: null })
})

test('a voice cargar without transcripcion is a schema error that triggers the retry', async () => {
  const heard = { ...nafta, transcripcion: 'nafta cuarenta y cinco ayer' }
  const { model, prompts } = fakeModel(JSON.stringify(nafta), JSON.stringify(heard))
  const action = await parseMessage(voiceInput, model)
  assert.equal(prompts.length, 2)
  assert.ok(prompts[1].includes('transcripcion'))
  assert.equal(action.transcripcion, 'nafta cuarenta y cinco ayer')
})

test('an empty transcripcion is valid for voice; a text action with transcripcion is rejected', () => {
  assert.equal(VoiceActionSchema.safeParse({ accion: 'no_entendido', transcripcion: '' }).success, true)
  assert.equal(VoiceActionSchema.safeParse({ accion: 'consultar', consulta: 'mes', transcripcion: 'cómo vengo' }).success, true)
  assert.equal(ActionSchema.safeParse({ accion: 'borrar', transcripcion: 'borrá eso' }).success, false)
})

const cargar = (fields) => ({ accion: 'cargar', categoria: null, descripcion: null, dias_atras: 0, recurrente: null, ...fields })

test('medio_pago: a gasto or ingreso may carry one or none, ahorro none', () => {
  assert.equal(ActionSchema.parse(cargar({ tipo: 'gasto', monto: 15, categoria: 'Ocio', medio_pago: 'efectivo' })).medio_pago, 'efectivo')
  assert.equal(ActionSchema.parse(cargar({ tipo: 'ingreso', monto: 500 })).medio_pago, null)
  assert.equal(ActionSchema.safeParse(cargar({ tipo: 'gasto', monto: 15, medio_pago: 'cheque' })).success, false)
  assert.equal(ActionSchema.safeParse(cargar({ tipo: 'ahorro', monto: 200, medio_pago: 'tarjeta' })).success, false)
  assert.equal(ActionSchema.safeParse(cargar({ tipo: 'ahorro', monto: -100 })).success, true)
})

test('transferencia needs a positive monto and a medio_pago, and no categoria or recurrente', () => {
  assert.equal(ActionSchema.safeParse(cargar({ tipo: 'transferencia', monto: 200, medio_pago: 'efectivo' })).success, true)
  assert.equal(ActionSchema.safeParse(cargar({ tipo: 'transferencia', monto: 200 })).success, false)
  assert.equal(ActionSchema.safeParse(cargar({ tipo: 'transferencia', monto: 200, medio_pago: 'efectivo', categoria: 'Otros' })).success, false)
  assert.equal(ActionSchema.safeParse(cargar({ tipo: 'transferencia', monto: 200, medio_pago: 'efectivo', recurrente: 'Luz' })).success, false)
  assert.equal(ActionSchema.safeParse(cargar({ tipo: 'transferencia', monto: 0, medio_pago: 'efectivo' })).success, false)
  assert.equal(ActionSchema.safeParse(cargar({ tipo: 'transferencia', monto: -50, medio_pago: 'tarjeta' })).success, false)
})

test('a transfer without a destination is retried as any invalid output', async () => {
  const bad = JSON.stringify(cargar({ tipo: 'transferencia', monto: 200 }))
  const good = JSON.stringify(cargar({ tipo: 'transferencia', monto: 200, medio_pago: 'efectivo' }))
  const { model, prompts } = fakeModel(bad, good)
  const action = await parseMessage({ ...input, text: 'saqué 200' }, model)
  assert.equal(prompts.length, 2)
  assert.ok(prompts[1].includes('medio_pago'))
  assert.equal(action.medio_pago, 'efectivo')
})

test('repreguntar deposito: tipo ingreso, optional descripcion; categoria still works', () => {
  assert.equal(ActionSchema.safeParse({ accion: 'repreguntar', falta: 'deposito', tipo: 'ingreso', monto: 200 }).success, true)
  assert.equal(ActionSchema.safeParse({ accion: 'repreguntar', falta: 'deposito', tipo: 'ingreso', monto: 200, descripcion: 'Propinas' }).success, true)
  assert.equal(ActionSchema.safeParse({ accion: 'repreguntar', falta: 'deposito', tipo: 'gasto', monto: 200 }).success, false)
  assert.equal(ActionSchema.safeParse({ accion: 'repreguntar', falta: 'medio', tipo: 'gasto', monto: 200 }).success, false)
  assert.equal(ActionSchema.safeParse({ accion: 'repreguntar', falta: 'categoria', tipo: 'gasto', monto: 50 }).success, true)
})

test('the voice schema carries medio_pago and the transfer refinements', () => {
  assert.equal(VoiceActionSchema.parse({ ...cargar({ tipo: 'gasto', monto: 15, categoria: 'Ocio', medio_pago: 'efectivo' }), transcripcion: 'quince en efectivo' }).medio_pago, 'efectivo')
  assert.equal(VoiceActionSchema.safeParse({ ...cargar({ tipo: 'transferencia', monto: 200 }), transcripcion: 'saqué doscientos' }).success, false)
  assert.equal(VoiceActionSchema.safeParse({ accion: 'repreguntar', falta: 'deposito', tipo: 'ingreso', monto: 200, transcripcion: 'ingresé doscientos' }).success, true)
})

test('the prompt states the method and transfer rules, with examples in both languages', () => {
  const es = buildPrompt(input)
  assert.ok(es.includes('"medio_pago":"efectivo"|"tarjeta"|null'))
  assert.ok(es.includes('Mensaje: saqué 200'))
  assert.ok(es.includes('Mensaje: ingresé 200 en el banco'))
  assert.ok(es.includes('Nunca lo adivines'))
  const en = buildPrompt({ ...input, locale: 'en', categories: ['Leisure', 'Transport', 'Other'] })
  assert.ok(en.includes('Mensaje: took 200 out of the ATM'))
  assert.ok(en.includes('Mensaje: put 200 in the bank'))
})

test('the deposit pending block offers the transfer and the income with the pending amount', () => {
  const prompt = buildPrompt({ ...input, text: 'lo pasé del efectivo', pending: { pregunta: 'deposito', monto: 200, diasAtras: 1, descripcion: 'Propinas' } })
  const block = prompt.slice(prompt.indexOf(PENDING_HEADER))
  assert.ok(block.includes('"tipo":"transferencia"'))
  assert.ok(block.includes('"tipo":"ingreso"'))
  assert.ok(block.includes('"monto":200'))
  assert.ok(block.includes('"dias_atras":1'))
  assert.ok(block.includes('"medio_pago":"tarjeta"'))
  assert.ok(block.includes('"descripcion":"Propinas"'))
  assert.ok(!buildPrompt(input).includes('los pasó desde el efectivo'))
})

test('without the payment-method feature the prompt names no method, transfer or deposit', () => {
  const prompt = buildPrompt({ ...input, paymentMethods: false })
  for (const word of ['medio_pago', 'transferencia', 'deposito', 'efectivo', 'tarjeta']) assert.ok(!prompt.includes(word), word)
  assert.ok(prompt.includes('nafta 45 ayer'))
  const offered = buildPrompt(input)
  for (const word of ['medio_pago', 'transferencia', 'deposito']) assert.ok(offered.includes(word), word)
})
