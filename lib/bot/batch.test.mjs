import { test } from 'node:test'
import assert from 'node:assert/strict'
import { MAX_BATCH_ROWS, loadExternalIds, matchRow, precheckItem, rowExternalId, rowToCorrect, rowsToDelete, runBatch } from './batch.ts'

const account = {
  paymentMethods: false,
  categories: [{ id: 'c-comida', nombre: 'Comida' }, { id: 'c-otros', nombre: 'Otros' }],
  recurring: [{ nombre: 'Spotify', categoria_id: 'c-comida' }],
}
const item = (fields) => ({ tipo: 'gasto', monto: 10, categoria: null, descripcion: null, recurrente: null, ...fields })

/** Steps over plain items `{ name, skip?, charged?, fails? }`, recording every call. */
function fakeSteps({ quotaLeft = Infinity } = {}) {
  const calls = { quota: 0, writes: [] }
  const steps = {
    precheck: (it) => (it.skip ? { name: it.name, amount: 1, reason: it.skip } : null),
    quota: async () => {
      calls.quota += 1
      return calls.quota <= quotaLeft
    },
    write: async (it, externalId) => {
      if (it.fails) throw new Error('write failed')
      calls.writes.push([it.name, externalId])
      if (it.charged) return { skipped: { name: it.name, amount: 1, reason: 'cobrado' } }
      return { written: it.name }
    },
  }
  return { steps, calls }
}
const named = (...names) => names.map((name) => ({ name }))

test('the first written row keeps the message id, the rest get #n', () => {
  assert.equal(rowExternalId('wamid.A', 1), 'wamid.A')
  assert.equal(rowExternalId('wamid.A', 2), 'wamid.A#2')
  assert.equal(rowExternalId('wamid.A', 10), 'wamid.A#10')
})

test('a transfer is skipped only for an account without payment methods', () => {
  const transfer = item({ tipo: 'transferencia', monto: 200 })
  assert.deepEqual(precheckItem(transfer, account), { name: null, amount: 200, reason: 'transferencia' })
  assert.equal(precheckItem(transfer, { ...account, paymentMethods: true }), null)
})

test('an expense goes to its category, else Otros, and is skipped only with neither', () => {
  assert.equal(precheckItem(item({ categoria: 'comida' }), account), null)
  assert.equal(precheckItem(item({ categoria: 'Viajes', descripcion: 'Tren' }), account), null)
  assert.equal(precheckItem(item({}), account), null)
  const sinOtros = { ...account, categories: [{ id: 'c-comida', nombre: 'Comida' }] }
  assert.deepEqual(precheckItem(item({ categoria: 'Viajes', descripcion: 'Tren', monto: 30 }), sinOtros), { name: 'Tren', amount: 30, reason: 'sinCategoria' })
  // A named fixed expense files under its definition's category, whatever the item says.
  assert.equal(precheckItem(item({ recurrente: 'spotify', categoria: 'Viajes' }), sinOtros), null)
})

test('incomes and savings are never skipped before the write', () => {
  assert.equal(precheckItem(item({ tipo: 'ingreso', monto: 500 }), { ...account, categories: [] }), null)
  assert.equal(precheckItem(item({ tipo: 'ahorro', monto: -100 }), { ...account, categories: [] }), null)
})

test('items are written in order, and a skipped item takes no number', async () => {
  const { steps, calls } = fakeSteps()
  const outcome = await runBatch([{ name: 'súper' }, { name: 'spotify', charged: true }, { name: 'nafta' }, { name: 'bolsas', skip: 'sinCategoria' }, { name: 'cine' }], 'm', steps)
  assert.deepEqual(outcome.rows, ['súper', 'nafta', 'cine'])
  assert.deepEqual(calls.writes, [['súper', 'm'], ['spotify', 'm#2'], ['nafta', 'm#2'], ['cine', 'm#3']])
  assert.deepEqual(outcome.skipped.map((s) => [s.name, s.reason]), [['spotify', 'cobrado'], ['bolsas', 'sinCategoria']])
  assert.equal(outcome.leftOut, null)
  // A precheck skip spends no load of the daily limit; a skip found on the write already did.
  assert.equal(calls.quota, 4)
})

test('at most 10 rows: the rest are left out by the limit', async () => {
  const { steps, calls } = fakeSteps()
  const items = named(...Array.from({ length: 12 }, (_, i) => `g${i + 1}`))
  const outcome = await runBatch(items, 'm', steps)
  assert.equal(outcome.rows.length, MAX_BATCH_ROWS)
  assert.deepEqual(outcome.leftOut, { count: 2, reason: 'limite' })
  assert.equal(calls.writes.at(-1)[1], 'm#10')
  assert.equal(calls.quota, 10)
})

test('the first refused quota ends the batch, keeping what was written', async () => {
  const { steps, calls } = fakeSteps({ quotaLeft: 2 })
  const outcome = await runBatch(named('a', 'b', 'c', 'd'), 'm', steps)
  assert.deepEqual(outcome.rows, ['a', 'b'])
  assert.deepEqual(outcome.leftOut, { count: 2, reason: 'tope' })
  assert.equal(calls.writes.length, 2)
})

test('a failed write ends the batch after a row, and goes up before any', async () => {
  const { steps } = fakeSteps()
  const outcome = await runBatch([{ name: 'a' }, { name: 'b', fails: true }, { name: 'c' }], 'm', steps)
  assert.deepEqual(outcome.rows, ['a'])
  assert.deepEqual(outcome.leftOut, { count: 2, reason: 'error' })

  await assert.rejects(runBatch([{ name: 'a', fails: true }, { name: 'b' }], 'm', fakeSteps().steps), /write failed/)
})

test('a batch where every item is skipped writes nothing', async () => {
  const { steps, calls } = fakeSteps()
  const outcome = await runBatch([{ name: 'spotify', charged: true }, { name: 'netflix', charged: true }], 'm', steps)
  assert.deepEqual(outcome.rows, [])
  assert.equal(outcome.skipped.length, 2)
  assert.deepEqual(calls.writes.map(([, id]) => id), ['m', 'm'])
})

test('a load is read by the plain id and #2…#10, from the id of any of its rows', () => {
  const ids = ['wamid.A', ...Array.from({ length: 9 }, (_, i) => `wamid.A#${i + 2}`)]
  assert.deepEqual(loadExternalIds('wamid.A'), ids)
  assert.deepEqual(loadExternalIds('wamid.A#3'), ids)
})

const row = (descripcion, categoria) => ({ descripcion, categoria: categoria ? { nombre: categoria } : null })
const super25 = row('Súper', 'Comida')
const nafta = row('Nafta', 'Transporte')
const cine = row('Cine', 'Ocio')
const list = [super25, nafta, cine]

test('a name matches one row by description, else by category, case and accents aside', () => {
  assert.equal(matchRow(list, 'nafta'), nafta)
  assert.equal(matchRow(list, 'SUPER'), super25)
  assert.equal(matchRow(list, 'ocio'), cine)
  // A description wins over a category with the same name.
  assert.equal(matchRow([row('Comida', 'Otros'), row('Pan', 'Comida')], 'comida').descripcion, 'Comida')
})

test('a name matching none or several rows matches nothing', () => {
  assert.equal(matchRow(list, 'bolsas'), null)
  assert.equal(matchRow([row('Pan', 'Comida'), row('Leche', 'Comida')], 'comida'), null)
  assert.equal(matchRow([row('Café', 'Comida'), row('café', 'Ocio')], 'cafe'), null)
})

test('borrar: the whole load without a name, the named row with one, null when it must ask', () => {
  assert.deepEqual(rowsToDelete(list, null), list)
  assert.deepEqual(rowsToDelete(list, undefined), list)
  assert.deepEqual(rowsToDelete(list, 'cine'), [cine])
  assert.equal(rowsToDelete(list, 'bolsas'), null)
  // One row is deleted whatever the name says.
  assert.deepEqual(rowsToDelete([nafta], 'cine'), [nafta])
})

test('corregir: the single row, else only the named one', () => {
  assert.equal(rowToCorrect([nafta], null), nafta)
  assert.equal(rowToCorrect([nafta], 'cine'), nafta)
  assert.equal(rowToCorrect(list, 'la nafta'), null)
  assert.equal(rowToCorrect(list, 'nafta'), nafta)
  assert.equal(rowToCorrect(list, null), null)
  assert.equal(rowToCorrect(list.slice(0, 2), 'cine'), null)
})
