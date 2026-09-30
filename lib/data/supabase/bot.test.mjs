import { test } from 'node:test'
import assert from 'node:assert/strict'
import { categoriesAliveIn, normalizeName, similarCategory } from './bot.ts'

const BRIAN = ['Vivienda', 'Comida', 'Transporte', 'Ocio', 'Salud', 'Suplementos', 'Suscripciones', 'Deudas', 'Otros'].map(
  (nombre) => ({ nombre }),
)

test('similarCategory: same name, similar name, or none', () => {
  const withPets = [...BRIAN, { nombre: 'Mascotas' }]
  assert.deepEqual(similarCategory('mascotas', withPets), { kind: 'same', category: { nombre: 'Mascotas' } })
  assert.deepEqual(similarCategory('Mascota', withPets), { kind: 'similar', category: { nombre: 'Mascotas' } })
  assert.equal(similarCategory('Viajes', BRIAN), null)
  assert.equal(similarCategory('Oficio', [{ nombre: 'Ocio' }])?.kind, 'similar')
  assert.equal(similarCategory('Música', BRIAN), null)
})

test('normalizeName ignores case and accents', () => {
  assert.equal(normalizeName('Súper'), normalizeName('super'))
  assert.equal(normalizeName('SALUD'), 'salud')
  assert.equal(normalizeName('Música '), 'musica')
})

test('the bot only sees categories alive in the cycle in progress', () => {
  const rows = [
    { id: 'comida', nombre: 'Comida', desde_ciclo: null, hasta_ciclo: null },
    { id: 'ocio', nombre: 'Ocio', desde_ciclo: null, hasta_ciclo: '2026-08-28' },
    { id: 'viajes', nombre: 'Viajes', desde_ciclo: '2026-12-28', hasta_ciclo: null },
    { id: 'salud', nombre: 'Salud', desde_ciclo: null, hasta_ciclo: null },
  ]
  assert.deepEqual(
    categoriesAliveIn(rows, ['salud'], '2026-09-28').map((c) => c.nombre),
    ['Comida'],
  )
})
