import { test } from 'node:test'
import assert from 'node:assert/strict'
import { COUNTRIES, CURRENCIES, countryForTimezone, countryOf, normalizePhone, timezoneForCountry } from './countries.ts'

test('every country formats with Intl, has valid zones and a unique code', () => {
  // `Intl.supportedValuesOf('timeZone')` lists canonical names only (Node resolves
  // `America/Argentina/Buenos_Aires` to `America/Buenos_Aires`), so a zone is valid when
  // `DateTimeFormat` accepts it, links included.
  const zones = { has: (zone) => { try { new Intl.DateTimeFormat('en', { timeZone: zone }); return true } catch { return false } } }
  const codes = new Set()
  for (const country of COUNTRIES) {
    assert.doesNotThrow(() => new Intl.NumberFormat('es', { style: 'currency', currency: country.currency }).format(1), country.code)
    assert.match(country.currency, /^[A-Z]{3}$/)
    assert.match(country.callingCode, /^\+[1-9]\d{0,2}$/)
    assert.ok(country.timezones.length > 0, `${country.code} has a timezone`)
    for (const zone of country.timezones) assert.ok(zones.has(zone), `${country.code}: ${zone} is a supported zone`)
    assert.ok(!codes.has(country.code), `${country.code} appears once`)
    codes.add(country.code)
    assert.ok(new Intl.DisplayNames('es', { type: 'region' }).of(country.code), `${country.code} has a name`)
  }
})

test('Argentina is pesos, +54 and Buenos Aires first', () => {
  const argentina = countryOf('AR')
  assert.equal(argentina.currency, 'ARS')
  assert.equal(argentina.callingCode, '+54')
  assert.equal(argentina.timezones[0], 'America/Argentina/Buenos_Aires')
  assert.equal(argentina.timezones.length, 12)
  assert.equal(countryOf('XX'), null)
})

test('the currency list holds every currency once, plus EUR and USD', () => {
  assert.equal(new Set(CURRENCIES).size, CURRENCIES.length)
  assert.ok(CURRENCIES.includes('EUR'))
  assert.ok(CURRENCIES.includes('USD'))
  assert.ok(CURRENCIES.includes('ARS'))
  assert.deepEqual(CURRENCIES, [...CURRENCIES].sort())
})

test('the default country is the one whose zones hold the stored timezone', () => {
  assert.equal(countryForTimezone('America/Argentina/Cordoba'), 'AR')
  assert.equal(countryForTimezone('Europe/Dublin'), 'IE')
  assert.equal(countryForTimezone('Atlantic/Canary'), 'ES')
  assert.equal(countryForTimezone('UTC'), null)
  assert.equal(countryForTimezone('Asia/Tokyo'), null)
  assert.equal(countryForTimezone(null), null)
})

test('the timezone follows the country unless the stored one already belongs to it', () => {
  assert.equal(timezoneForCountry('AR', 'America/Argentina/Cordoba'), 'America/Argentina/Cordoba')
  assert.equal(timezoneForCountry('AR', 'Europe/Dublin'), 'America/Argentina/Buenos_Aires')
  assert.equal(timezoneForCountry('ES', 'Europe/Dublin'), 'Europe/Madrid')
  assert.equal(timezoneForCountry('ES', null), 'Europe/Madrid')
  assert.equal(timezoneForCountry('XX', 'Europe/Dublin'), null)
})

test('a phone is normalised to E.164 with the country prefix', () => {
  assert.equal(normalizePhone('11 5555 1234', 'AR'), '+541155551234')
  assert.equal(normalizePhone('+54 9 11 5555-1234', 'IE'), '+5491155551234')
  assert.equal(normalizePhone('0054 11 5555 1234', 'IE'), '+541155551234')
  // D11 adds the prefix and nothing else: a trunk zero stays (no per-country dialling rules).
  assert.equal(normalizePhone('85 152 8917', 'IE'), '+353851528917')
  assert.equal(normalizePhone('abc', 'AR'), null)
  assert.equal(normalizePhone('', 'AR'), null)
  assert.equal(normalizePhone('12', 'AR'), null)
  assert.equal(normalizePhone('11 5555 1234', 'XX'), null)
  assert.equal(normalizePhone('+1 (212) 555-0100', 'AR'), '+12125550100')
})
