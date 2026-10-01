import { test } from 'node:test'
import assert from 'node:assert/strict'
import { amountLocale, effectiveAmountFormat, formatAmount, formatAmountFigure, formatAmountParts } from './amount-format.ts'

// `Intl` separates the symbol with a no-break space; the specs write a plain one.
const plain = (text) => text.replace(/\s/g, ' ')
const es = (amount, extra = {}) => plain(formatAmount(amount, { locale: 'es', currency: 'ARS', amountFormat: 'abreviado', ...extra }))
const en = (amount, extra = {}) => plain(formatAmount(amount, { locale: 'en', currency: 'ARS', amountFormat: 'abreviado', ...extra }))

test('euros in Spanish are unchanged by the narrow symbol', () => {
  const eur = (amount) => plain(formatAmount(amount, { locale: 'es', currency: 'EUR' }))
  assert.equal(eur(2400), '2.400 €')
  assert.equal(eur(62.4), '62,40 €')
  assert.equal(eur(820), '820 €')
  assert.equal(formatAmount(2400, { locale: 'en', currency: 'EUR' }), '€2,400')
})

test('the locale is es-AR only for pesos in Spanish', () => {
  assert.equal(amountLocale('es', 'ARS'), 'es-AR')
  assert.equal(amountLocale('es', 'EUR'), 'es')
  assert.equal(amountLocale('en', 'ARS'), 'en')
})

test('pesos in Spanish, complete: symbol first, a space, then the figure', () => {
  const completo = (amount) => plain(formatAmount(amount, { locale: 'es', currency: 'ARS', amountFormat: 'completo' }))
  assert.equal(completo(350000), '$ 350.000')
  assert.equal(completo(-1500000.5), '-$ 1.500.000,50')
  assert.equal(completo(62.4), '$ 62,40')
  // No format given means complete.
  assert.equal(plain(formatAmount(350000, { locale: 'es', currency: 'ARS' })), '$ 350.000')
})

test('pesos in Spanish, abbreviated: the table of D12', () => {
  assert.equal(es(350000), '$ 350k')
  assert.equal(es(1500), '$ 1,5k')
  assert.equal(es(12345), '$ 12,3k')
  assert.equal(es(999950), '$ 1M')
  assert.equal(es(1500000), '$ 1,5M')
  assert.equal(es(12345678), '$ 12,3M')
  assert.equal(es(2500000000), '$ 2.500M')
  assert.equal(es(-1500000.5), '-$ 1,5M')
  assert.equal(es(62.4), '$ 62,40')
  assert.equal(es(1000), '$ 1k')
})

test('pesos in English, abbreviated', () => {
  assert.equal(en(350000), '$350k')
  assert.equal(en(-1500000.5), '-$1.5M')
  assert.equal(en(12345), '$12.3k')
  assert.equal(en(62.4), '$62.40')
})

test('the boundaries: 999,99 is full, 1 000 is 1k, 999 950 is 1M, a thousand million keeps its grouping', () => {
  assert.equal(es(999.99), '$ 999,99')
  assert.equal(es(1000), '$ 1k')
  assert.equal(es(999949), '$ 999,9k')
  assert.equal(es(999950), '$ 1M')
  assert.equal(es(1000000), '$ 1M')
  assert.equal(es(1000000000), '$ 1.000M')
  assert.equal(en(1000000000), '$1,000M')
})

test('rounding is half away from zero to one decimal, never cents', () => {
  assert.equal(es(1050), '$ 1,1k')
  assert.equal(es(1049), '$ 1k')
  assert.equal(es(-1050), '-$ 1,1k')
  assert.equal(es(1234.56), '$ 1,2k')
})

test('a euro account that held the abbreviated format reads the figure where the full form puts it', () => {
  assert.equal(plain(formatAmount(1500000, { locale: 'es', currency: 'EUR', amountFormat: 'abreviado' })), '1,5M €')
  assert.equal(formatAmount(1500000, { locale: 'en', currency: 'EUR', amountFormat: 'abreviado' }), '€1.5M')
})

test('the parts keep sign, symbol and figure apart, in display order', () => {
  const parts = formatAmountParts(-1500000.5, { locale: 'es', currency: 'ARS', amountFormat: 'abreviado' })
  assert.equal(parts.sign, '-')
  assert.equal(parts.symbol, '$')
  assert.equal(parts.figure, '1,5M')
  assert.equal(parts.symbolFirst, true)
  assert.deepEqual(
    parts.parts.map((part) => part.type),
    ['sign', 'symbol', 'literal', 'figure'],
  )

  const euros = formatAmountParts(820, { locale: 'es', currency: 'EUR' })
  assert.equal(euros.symbolFirst, false)
  assert.equal(euros.figure, '820')
  assert.equal(euros.sign, '')
  assert.deepEqual(
    euros.parts.map((part) => part.type),
    ['figure', 'literal', 'symbol'],
  )

  const signed = formatAmountParts(5, { locale: 'en', currency: 'EUR', signDisplay: 'always' })
  assert.equal(signed.sign, '+')
  assert.equal(signed.text, '+€5')
})

test('the counter figure rolls in the unit of its target', () => {
  const ars = { locale: 'es', currency: 'ARS', amountFormat: 'abreviado' }
  assert.equal(formatAmountFigure(12345, { ...ars, reference: 350000 }), '12,3k')
  assert.equal(formatAmountFigure(349800, { ...ars, reference: 350000 }), '349,8k')
  assert.equal(formatAmountFigure(350000, { ...ars, reference: 350000 }), '350k')
  assert.equal(formatAmountFigure(500, { ...ars, reference: 350000 }), '0,5k')
  assert.equal(formatAmountFigure(500000, { ...ars, reference: 1500000 }), '0,5M')
  // Without a reference, the value's own unit.
  assert.equal(formatAmountFigure(500, ars), '500')
  assert.equal(formatAmountFigure(1500, ars), '1,5k')
  // Unsigned: the sign is a part of its own.
  assert.equal(formatAmountFigure(-1500, ars), '1,5k')
})

test('the counter figure keeps the decimals of a complete target', () => {
  const eur = { locale: 'es', currency: 'EUR' }
  assert.equal(formatAmountFigure(31.2, { ...eur, reference: 62.4 }), '31,20')
  assert.equal(formatAmountFigure(410, { ...eur, reference: 820 }), '410')
  assert.equal(formatAmountFigure(1234.5, { ...eur, reference: 2400 }), '1.235')
  assert.equal(formatAmountFigure(1234.5, { locale: 'en', currency: 'EUR', reference: 2400 }), '1,235')
})

test('the format in effect is the stored one only for Argentina', () => {
  assert.equal(effectiveAmountFormat({ pais: 'AR', formato_montos: 'abreviado' }), 'abreviado')
  assert.equal(effectiveAmountFormat({ pais: 'AR', formato_montos: 'completo' }), 'completo')
  assert.equal(effectiveAmountFormat({ pais: 'UY', formato_montos: 'abreviado' }), 'completo')
  assert.equal(effectiveAmountFormat({ pais: null, formato_montos: 'abreviado' }), 'completo')
})
