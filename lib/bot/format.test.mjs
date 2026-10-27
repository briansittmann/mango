import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createTranslator } from 'use-intl/core'
import { getBudgetStatus } from '../data/budget.ts'
import { batchConfirmationText, confirmationText, daysBefore, formatBotAmount, formatBotDay, loadIcon, topCategories, whichRowText } from './format.ts'

const es = JSON.parse(readFileSync(new URL('../../messages/es.json', import.meta.url), 'utf8')).bot
const en = JSON.parse(readFileSync(new URL('../../messages/en.json', import.meta.url), 'utf8')).bot
const plain = (text) => text.replace(/\s/g, ' ')

const today = '2026-10-01'
const fmt = (locale, currency = 'EUR', amountFormat = 'completo') => ({
  locale,
  currency,
  amountFormat,
  today,
  t: createTranslator({ locale, messages: { bot: locale === 'es' ? es : en }, namespace: 'bot' }),
})
const budget = (spent) => getBudgetStatus({ amount: 100, spent, currentDay: 4, cycleDays: 30 })

test('an expense names itself, then its category when it differs', () => {
  const nafta = { tipo: 'gasto', amount: 45, date: '2026-09-30', name: 'Nafta', category: 'Transporte', budget: null }
  assert.equal(plain(confirmationText(fmt('es'), nafta)), 'Anotado ✅ Nafta · 45 € en Transporte, ayer.')
  assert.equal(confirmationText(fmt('en'), nafta), 'Logged ✅ Nafta · €45 in Transporte, yesterday.')
  assert.equal(
    plain(confirmationText(fmt('es'), { ...nafta, date: today, name: null, category: 'Comida' })),
    'Anotado ✅ Comida · 45 €.',
  )
  assert.equal(plain(confirmationText(fmt('es'), { ...nafta, date: today, name: 'comida', category: 'Comida' })), 'Anotado ✅ comida · 45 €.')
})

test('the day is omitted today and is a calendar date before yesterday', () => {
  const load = { tipo: 'gasto', amount: 3, name: 'Café', category: 'Ocio', budget: null }
  assert.equal(plain(confirmationText(fmt('es'), { ...load, date: today })), 'Anotado ✅ Café · 3 € en Ocio.')
  assert.match(plain(confirmationText(fmt('es'), { ...load, date: '2026-09-28' })), /en Ocio, 28 sept?\.?\.$/)
})

test('an income falls back to "Ingreso"; savings name their type', () => {
  assert.equal(plain(confirmationText(fmt('es'), { tipo: 'ingreso', amount: 500, date: today, name: 'Propina' })), 'Anotado 💰 Propina · 500 €.')
  assert.equal(plain(confirmationText(fmt('es'), { tipo: 'ingreso', amount: 500, date: today, name: null })), 'Anotado 💰 Ingreso · 500 €.')
  assert.equal(plain(confirmationText(fmt('es'), { tipo: 'ahorro', amount: 50, date: today })), 'Anotado 🐷 Ahorro · 50 €.')
  assert.equal(plain(confirmationText(fmt('es'), { tipo: 'ahorro', amount: -100, date: today })), 'Anotado 🏦 Retiro del ahorro · 100 €.')
  assert.deepEqual(
    [loadIcon({ tipo: 'gasto', amount: 1 }), loadIcon({ tipo: 'ingreso', amount: 1 }), loadIcon({ tipo: 'ahorro', amount: 1 }), loadIcon({ tipo: 'ahorro', amount: -1 })],
    ['✅', '💰', '🐷', '🏦'],
  )
})

test('the budget line takes the dashboard level: 🟢 at 79 %, 🟡 at 80 %, 🔴 at 100 %', () => {
  const load = (spent) => ({ tipo: 'gasto', amount: 15, date: today, name: 'Proteína', category: 'Suplementos', budget: budget(spent) })
  assert.equal(
    plain(confirmationText(fmt('es'), load(79))),
    'Anotado ✅ Proteína · 15 € en Suplementos. Llevás 79 € de 100 € este mes 🟢',
  )
  assert.ok(confirmationText(fmt('es'), load(80)).endsWith('🟡'))
  assert.ok(confirmationText(fmt('es'), load(100)).endsWith('🔴'))
  assert.ok(confirmationText(fmt('en'), load(115)).includes("You've spent €115 of €100 this month 🔴"))
})

test('the month query lists spent categories, largest first, at most five, and sums the rest', () => {
  const groups = [
    ['Otros', 20], ['Comida', 280], ['Vivienda', 700], ['Salud', 40], ['Deudas', 0], ['Ocio', 80], ['Transporte', 120], ['Suplementos', 15],
  ].map(([name, total]) => ({ name, total }))
  const { top, rest } = topCategories(groups)
  assert.deepEqual(top.map((g) => g.name), ['Vivienda', 'Comida', 'Transporte', 'Ocio', 'Salud'])
  assert.deepEqual(rest, { count: 2, total: 35 })
  assert.deepEqual(topCategories([{ name: 'Comida', total: 0 }]), { top: [], rest: { count: 0, total: 0 } })
})

test('amounts look like the web', () => {
  assert.equal(plain(formatBotAmount('es', 'EUR', 45)), '45 €')
  assert.equal(formatBotAmount('en', 'EUR', 45.5), '€45.50')
  assert.equal(plain(formatBotAmount('es', 'ARS', 15000)), '$ 15.000')
  assert.equal(plain(formatBotAmount('es', 'ARS', 15000, 'abreviado')), '$ 15k')
  assert.equal(formatBotAmount('en', 'ARS', 1500000, 'abreviado'), '$1.5M')
})

test('pesos follow the account format in effect: abbreviated and complete', () => {
  const pesos = (spent) =>
    getBudgetStatus({ amount: 300000, spent, currentDay: 4, cycleDays: 30 })
  const load = { tipo: 'gasto', amount: 15000, date: today, name: 'Súper', category: 'Comida', budget: pesos(48000) }
  assert.equal(
    plain(confirmationText(fmt('es', 'ARS', 'abreviado'), load)),
    'Anotado ✅ Súper · $ 15k en Comida. Llevás $ 48k de $ 300k este mes 🟢',
  )
  assert.equal(
    plain(confirmationText(fmt('es', 'ARS', 'completo'), load)),
    'Anotado ✅ Súper · $ 15.000 en Comida. Llevás $ 48.000 de $ 300.000 este mes 🟢',
  )
})

test('today, yesterday, then a short date', () => {
  const t = (key) => es[key]
  assert.equal(formatBotDay('es', '2026-10-01', '2026-10-01', t), 'hoy')
  assert.equal(formatBotDay('es', '2026-10-01', '2026-09-30', t), 'ayer')
  assert.equal(formatBotDay('en', '2026-10-01', '2026-09-30', (key) => en[key]), 'yesterday')
  assert.match(formatBotDay('es', '2026-10-01', '2026-09-28', t), /^28 sept?\.?$/)
})

test('daysBefore crosses month and year boundaries', () => {
  assert.equal(daysBefore('2026-10-01', 1), '2026-09-30')
  assert.equal(daysBefore('2027-01-02', 3), '2026-12-30')
})

test('the method is named only when the message said it, after the category and the day', () => {
  const cervezas = { tipo: 'gasto', amount: 15, date: today, name: 'Cervezas', category: 'Ocio', budget: null }
  assert.equal(plain(confirmationText(fmt('es'), { ...cervezas, method: 'efectivo' })), 'Anotado ✅ Cervezas · 15 € en Ocio, en efectivo.')
  assert.equal(plain(confirmationText(fmt('es'), { ...cervezas, method: 'tarjeta', date: '2026-09-30' })), 'Anotado ✅ Cervezas · 15 € en Ocio, ayer, con tarjeta.')
  assert.equal(confirmationText(fmt('en'), { ...cervezas, method: 'efectivo' }), 'Logged ✅ Cervezas · €15 in Ocio, in cash.')
  // A method taken from the default is not set on the summary, so nothing is named.
  assert.equal(plain(confirmationText(fmt('es'), cervezas)), 'Anotado ✅ Cervezas · 15 € en Ocio.')
  assert.equal(plain(confirmationText(fmt('es'), { tipo: 'ingreso', amount: 200, date: today, name: 'Propinas', method: 'tarjeta' })), 'Anotado 💰 Propinas · 200 €, con tarjeta.')
})

test('the method goes before the budget line', () => {
  const load = { tipo: 'gasto', amount: 15, date: today, name: 'Cervezas', category: 'Ocio', budget: budget(48), method: 'efectivo' }
  assert.equal(plain(confirmationText(fmt('es'), load)), 'Anotado ✅ Cervezas · 15 € en Ocio, en efectivo. Llevás 48 € de 100 € este mes 🟢')
})

test('a transfer names its direction, with the day when it is not today and no budget line', () => {
  assert.equal(plain(confirmationText(fmt('es'), { tipo: 'transferencia', amount: 200, date: today, into: 'efectivo' })), 'Anotado 🔁 Tarjeta a efectivo · 200 €.')
  assert.equal(plain(confirmationText(fmt('es'), { tipo: 'transferencia', amount: 120, date: '2026-09-30', into: 'tarjeta' })), 'Anotado 🔁 Efectivo a tarjeta · 120 €, ayer.')
  assert.equal(confirmationText(fmt('en'), { tipo: 'transferencia', amount: 200, date: today, into: 'efectivo' }), 'Logged 🔁 Card to cash · €200.')
  assert.equal(loadIcon({ tipo: 'transferencia', amount: 200 }), '🔁')
})

const batchRows = [
  { tipo: 'gasto', amount: 25, date: today, name: 'Súper', category: 'Comida', budget: budget(25) },
  { tipo: 'gasto', amount: 40, date: '2026-09-30', name: 'Nafta', category: 'Transporte', budget: null, method: 'efectivo' },
  { tipo: 'ingreso', amount: 500, date: today, name: 'Propina' },
]

test('a batch lists its rows without the budget line or the method, and names what was left out', () => {
  const notLoaded = { skipped: [{ name: 'Spotify', amount: 7, reason: 'cobrado' }], leftOut: { count: 2, reason: 'limite' } }
  assert.equal(
    plain(batchConfirmationText(fmt('es'), batchRows, notLoaded)),
    plain('Anotado ✅ 3 movimientos:\n✅ Súper · 25 € en Comida\n✅ Nafta · 40 € en Transporte, ayer\n💰 Propina · 500 €\nNo anoté: Spotify (ya estaba cobrado) y 2 más (máximo 10 por mensaje, mandalos en otro).'),
  )
  assert.equal(
    batchConfirmationText(fmt('en'), batchRows, notLoaded),
    'Logged ✅ 3 movements:\n✅ Súper · €25 in Comida\n✅ Nafta · €40 in Transporte, yesterday\n💰 Propina · €500\nNot logged: Spotify (already charged) and 2 more (at most 10 per message, send them in another one).',
  )
})

test('a batch with nothing left out has no "No anoté" line; savings and transfers name their type', () => {
  const rows = [
    { tipo: 'ahorro', amount: -100, date: today },
    { tipo: 'transferencia', amount: 200, date: today, into: 'efectivo' },
    { tipo: 'gasto', amount: 3, date: today, name: null, category: 'Otros', budget: null },
  ]
  assert.equal(
    plain(batchConfirmationText(fmt('es'), rows, { skipped: [], leftOut: null })),
    plain('Anotado ✅ 3 movimientos:\n🏦 Retiro del ahorro · 100 €\n🔁 Tarjeta a efectivo · 200 €\n✅ Otros · 3 €'),
  )
})

test('a batch with one row written still reads as a batch, with the daily limit named', () => {
  const notLoaded = { skipped: [], leftOut: { count: 2, reason: 'tope' } }
  assert.equal(
    plain(batchConfirmationText(fmt('es'), batchRows.slice(0, 1), notLoaded)),
    plain('Anotado ✅ 1 movimiento:\n✅ Súper · 25 € en Comida\nNo anoté: 2 movimientos (llegaste al tope de hoy).'),
  )
  assert.equal(batchConfirmationText(fmt('en'), batchRows.slice(0, 1), notLoaded), 'Logged ✅ 1 movement:\n✅ Súper · €25 in Comida\nNot logged: 2 movements (you reached today\'s limit).')
})

test('a batch with nothing written says why, by name or by amount', () => {
  const notLoaded = { skipped: [{ name: 'Spotify', amount: 7, reason: 'cobrado' }, { name: null, amount: 10, reason: 'sinCategoria' }], leftOut: null }
  assert.equal(plain(batchConfirmationText(fmt('es'), [], notLoaded)), plain('🤷 No anoté nada: Spotify (ya estaba cobrado) y 10 € (no encontré la categoría).'))
  assert.equal(batchConfirmationText(fmt('en'), [], notLoaded), '🤷 Nothing logged: Spotify (already charged) and €10 (no category found).')
})

test('the answer buttons fit WhatsApp\'s 20-character reply titles', () => {
  for (const messages of [es, en]) {
    for (const key of ['botonDesdeEfectivo', 'botonIngresoNuevo', 'botonCargarAparte', 'botonEraEse']) assert.ok(messages[key].length <= 20, `${key}: ${messages[key]}`)
  }
})

test('a list that names no single row lists its rows and gives an example', () => {
  const rows = [{ name: 'Súper', amount: 25 }, { name: 'Nafta', amount: 40 }, { name: 'Cine', amount: 12 }]
  assert.equal(plain(whichRowText(fmt('es'), 'cualCorregir', rows)), plain('🤔 ¿Cuál? Súper 25 €, Nafta 40 € o Cine 12 €. Decime, por ejemplo, «súper era 40».'))
  assert.equal(whichRowText(fmt('en'), 'cualCorregir', rows), '🤔 Which one? Súper €25, Nafta €40, or Cine €12. Tell me, for example, «the súper was 40».')
  assert.equal(
    plain(whichRowText(fmt('es'), 'cualBorrar', rows.slice(0, 2))),
    plain('🤔 ¿Cuál borro? Súper 25 € o Nafta 40 €. Decime, por ejemplo, «borrá súper», o «borrá eso» para borrar todos.'),
  )
})
