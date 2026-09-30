import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createTranslator } from 'use-intl/core'
import { getBudgetStatus } from '../data/budget.ts'
import { confirmationText, daysBefore, formatBotAmount, formatBotDay, loadIcon, topCategories } from './format.ts'

const es = JSON.parse(readFileSync(new URL('../../messages/es.json', import.meta.url), 'utf8')).bot
const en = JSON.parse(readFileSync(new URL('../../messages/en.json', import.meta.url), 'utf8')).bot
const plain = (text) => text.replace(/\s/g, ' ')

const today = '2026-10-01'
const fmt = (locale) => ({
  locale,
  currency: 'EUR',
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

test('the month query lists spent categories, largest first, at most five', () => {
  const groups = [
    ['Otros', 20], ['Comida', 280], ['Vivienda', 700], ['Salud', 40], ['Deudas', 0], ['Ocio', 80], ['Transporte', 120],
  ].map(([name, total]) => ({ name, total }))
  assert.deepEqual(
    topCategories(groups).map((g) => g.name),
    ['Vivienda', 'Comida', 'Transporte', 'Ocio', 'Salud'],
  )
  assert.deepEqual(topCategories([{ name: 'Comida', total: 0 }]), [])
})

test('amounts look like the web', () => {
  assert.equal(plain(formatBotAmount('es', 'EUR', 45)), '45 €')
  assert.equal(formatBotAmount('en', 'EUR', 45.5), '€45.50')
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
