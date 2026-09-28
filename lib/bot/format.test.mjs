import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { daysBefore, formatBotAmount, formatBotDay } from './format.ts'

const es = JSON.parse(readFileSync(new URL('../../messages/es.json', import.meta.url), 'utf8')).bot
const en = JSON.parse(readFileSync(new URL('../../messages/en.json', import.meta.url), 'utf8')).bot
const plain = (text) => text.replace(/\s/g, ' ')

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
