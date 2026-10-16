import { test } from 'node:test'
import assert from 'node:assert/strict'
import { selectUpcomingCharges } from './upcoming-charges.ts'

const cards = [
  { id: 'debito', name: 'Débito', color: 'azul' },
  { id: 'credito', name: 'Crédito', color: 'arcoiris' },
]

const definition = (id, cardId) => ({ id, cardId, expectedAmount: 10, repetitions: null })

const row = (id, definitionId, day) => ({ id, name: id, amount: 10, date: '2026-09-01', fixed: { definitionId, day, charged: false } })

const groups = [
  {
    id: 'g',
    kind: 'category',
    name: 'Vivienda',
    color: 'rojo',
    total: 0,
    budget: null,
    expenses: [row('alquiler', 'alquiler', 1), row('parking', 'parking', 2), row('viejo', 'viejo', 3), row('huerfano', 'borrada', 4)],
    rowsLater: 0,
    showProgress: true,
  },
]

const definitions = [definition('alquiler', 'credito'), definition('parking', null), definition('viejo', 'borrada')]

test('a charge carries the card of its definition', () => {
  const [alquiler] = selectUpcomingCharges(groups, definitions, cards)
  assert.deepEqual(alquiler.card, { name: 'Crédito', color: 'arcoiris' })
})

test('a definition without a card gives no card', () => {
  const parking = selectUpcomingCharges(groups, definitions, cards).find((charge) => charge.id === 'parking')
  assert.equal(parking.card, null)
})

test('a card not in the list gives no card', () => {
  const viejo = selectUpcomingCharges(groups, definitions, cards).find((charge) => charge.id === 'viejo')
  assert.equal(viejo.card, null)
})

test('a missing definition still lists, with no card', () => {
  const huerfano = selectUpcomingCharges(groups, definitions, cards).find((charge) => charge.id === 'huerfano')
  assert.equal(huerfano.card, null)
  assert.equal(huerfano.expectedAmount, 10)
})

test('without cards every charge has none', () => {
  assert.ok(selectUpcomingCharges(groups, definitions).every((charge) => charge.card === null))
})
