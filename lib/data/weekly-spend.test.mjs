import { test } from 'node:test'
import assert from 'node:assert/strict'
import { currentWeekIndex, dailyTotals, localDayOf, spentRows, weeklyTopCategories, weeksOfCycle } from './weekly-spend.ts'

const group = (id, color, expenses, name = id) => ({
  id,
  kind: 'category',
  name,
  color,
  total: expenses.reduce((sum, e) => sum + e.amount, 0),
  budget: null,
  expenses,
  rowsLater: 0,
  showProgress: true,
})
const row = (id, amount, date, extra = {}) => ({ id, name: id, amount, date, ...extra })
const range = (week) => [week.start, week.end]

test('a 30-day cycle has five weeks and the current one holds today', () => {
  const weeks = weeksOfCycle('2026-09-01', '2026-09-30', '2026-09-22')
  assert.deepEqual(weeks.map(range), [
    ['2026-09-01', '2026-09-07'],
    ['2026-09-08', '2026-09-14'],
    ['2026-09-15', '2026-09-21'],
    ['2026-09-22', '2026-09-28'],
    ['2026-09-29', '2026-09-30'],
  ])
  assert.deepEqual(weeks.map((w) => w.index), [1, 2, 3, 4, 5])
  assert.equal(currentWeekIndex(weeks), 4)
})

test('a 31-day cycle ends with a three-day week', () => {
  const weeks = weeksOfCycle('2026-10-01', '2026-10-31', '2026-10-31')
  assert.equal(weeks.length, 5)
  assert.deepEqual(range(weeks[4]), ['2026-10-29', '2026-10-31'])
  assert.equal(currentWeekIndex(weeks), 5)
})

test('a cycle from the 28th crosses the month and ends with a two-day week', () => {
  const weeks = weeksOfCycle('2026-09-28', '2026-10-27', '2026-10-03')
  assert.deepEqual(range(weeks[0]), ['2026-09-28', '2026-10-04'])
  assert.deepEqual(range(weeks.at(-1)), ['2026-10-26', '2026-10-27'])
  assert.equal(weeks.length, 5)
  assert.equal(currentWeekIndex(weeks), 1)
})

test('a past cycle takes its last week as current, and a future one its first', () => {
  assert.equal(currentWeekIndex(weeksOfCycle('2026-09-01', '2026-09-30', '2026-10-15')), 5)
  assert.equal(currentWeekIndex(weeksOfCycle('2026-09-01', '2026-09-30', '2026-08-15')), 1)
})

test('a 28-day cycle is exactly four weeks', () => {
  assert.equal(weeksOfCycle('2026-02-01', '2026-02-28', '2026-02-10').length, 4)
})

test('local day of a boundary instant in Dublin and Buenos Aires', () => {
  // 23:30 UTC on the 7th: already the 8th in Dublin (UTC+1 in September), still the 7th in Buenos Aires (UTC−3).
  assert.equal(localDayOf('2026-09-07T23:30:00Z', 'Europe/Dublin'), '2026-09-08')
  assert.equal(localDayOf('2026-09-07T23:30:00Z', 'America/Argentina/Buenos_Aires'), '2026-09-07')
  // 02:30 UTC on the 8th: the 8th in Dublin, the 7th in Buenos Aires.
  assert.equal(localDayOf('2026-09-08T02:30:00Z', 'Europe/Dublin'), '2026-09-08')
  assert.equal(localDayOf('2026-09-08T02:30:00Z', 'America/Argentina/Buenos_Aires'), '2026-09-07')
  // Dublin in January is UTC+0.
  assert.equal(localDayOf('2026-01-07T23:30:00Z', 'Europe/Dublin'), '2026-01-07')
})

test('pending and projected charges are not spent; confirmed charges and plain rows are', () => {
  const groups = [
    group('transporte', 'azul_apagado', [
      row('gasolina', 80, '2026-09-04T08:00:00Z'),
      row('parking', 50, '2026-09-15T08:00:00Z', { fixed: { definitionId: 'def-parking', day: 15, charged: false } }),
      row('peaje', 12, '2026-09-16T08:00:00Z', { fixed: { definitionId: 'def-peaje', day: 16, charged: true } }),
      row('proj:seguro', 90, '2026-09-20T12:00:00Z', { fixed: { definitionId: 'def-seguro', day: 20, charged: false }, projected: true }),
    ]),
  ]
  const rows = spentRows(groups, 'Europe/Madrid')
  assert.deepEqual(
    rows.map((r) => [r.amount, r.day]),
    [
      [80, '2026-09-04'],
      [12, '2026-09-16'],
    ],
  )
  const weeks = weeksOfCycle('2026-09-01', '2026-09-30', '2026-09-22')
  assert.equal(weeklyTopCategories(groups, weeks[2], 'Europe/Madrid').total, 12)
  assert.equal(weeklyTopCategories(groups, weeks[0], 'Europe/Madrid').items[0].amount, 80)
})

test('a row at 23:30 UTC on the 7th counts in week 2 for Madrid', () => {
  const groups = [group('comida', 'naranja_calido', [row('cafe', 10, '2026-09-07T23:30:00Z')])]
  const weeks = weeksOfCycle('2026-09-01', '2026-09-30', '2026-09-22')
  assert.equal(weeklyTopCategories(groups, weeks[0], 'Europe/Madrid').total, 0)
  assert.equal(weeklyTopCategories(groups, weeks[1], 'Europe/Madrid').total, 10)
  assert.equal(weeklyTopCategories(groups, weeks[0], 'America/Argentina/Buenos_Aires').total, 10)
})

test('the week ranks categories, skips empty ones and folds the rest into Otras', () => {
  const groups = [
    group('a', 'rojo', [row('a1', 100, '2026-09-02T10:00:00Z'), row('a2', 50, '2026-09-03T10:00:00Z')]),
    group('b', 'coral', [row('b1', 120, '2026-09-02T10:00:00Z')]),
    group('c', 'rosa', [row('c1', 30, '2026-09-02T10:00:00Z')]),
    group('d', 'celeste', [row('d1', 40, '2026-09-02T10:00:00Z')]),
    group('e', 'turquesa', [row('e1', 60, '2026-09-02T10:00:00Z')]),
    group('f', 'granate', [row('f1', 20, '2026-09-02T10:00:00Z')]),
    group('g', 'blanco', [row('g1', 10, '2026-09-02T10:00:00Z')]),
    group('h', 'gris_calido', [row('h1', 999, '2026-09-20T10:00:00Z')]),
    group('empty', 'gris_oscuro', []),
  ]
  const week = { start: '2026-09-01', end: '2026-09-07' }
  const { items, total } = weeklyTopCategories(groups, week, 'Europe/Madrid')
  assert.equal(total, 430)
  assert.deepEqual(
    items.map((i) => [i.id, i.amount]),
    [
      ['a', 150],
      ['b', 120],
      ['e', 60],
      ['d', 40],
      ['c', 30],
      [null, 30],
    ],
  )
  const others = items.at(-1)
  assert.equal(others.folded, 2)
  assert.equal(others.rows, 2)
  assert.equal(others.color, null)
  assert.equal(items[0].rows, 2)
  assert.ok(Math.abs(items[0].share - 150 / 430) < 1e-9)
  assert.ok(Math.abs(items.reduce((sum, i) => sum + i.share, 0) - 1) < 1e-9)
})

test('exactly five categories do not fold, and an empty week has no items', () => {
  const groups = ['a', 'b', 'c', 'd', 'e'].map((id, i) => group(id, 'rojo', [row(id, 10 * (i + 1), '2026-09-02T10:00:00Z')]))
  const { items } = weeklyTopCategories(groups, { start: '2026-09-01', end: '2026-09-07' }, 'Europe/Madrid')
  assert.equal(items.length, 5)
  assert.ok(items.every((i) => i.id != null))
  const empty = weeklyTopCategories(groups, { start: '2026-09-08', end: '2026-09-14' }, 'Europe/Madrid')
  assert.deepEqual(empty, { items: [], total: 0 })
})

test('daily totals cover every day, mark today and the future, and ignore pending charges', () => {
  const groups = [
    group('a', 'rojo', [
      row('a1', 100, '2026-09-01T10:00:00Z'),
      row('a2', 50, '2026-09-03T10:00:00Z'),
      row('a3', 25, '2026-09-03T12:00:00Z'),
      row('pending', 70, '2026-09-22T10:00:00Z', { fixed: { definitionId: 'd', day: 22, charged: false } }),
    ]),
  ]
  const days = dailyTotals(groups, '2026-09-01', '2026-09-30', 'Europe/Madrid', '2026-09-22')
  assert.equal(days.length, 30)
  assert.equal(days[0].day, 1)
  assert.deepEqual([days[2].total, days[2].rows], [75, 2])
  assert.equal(days[21].today, true)
  assert.equal(days[21].total, 0)
  assert.equal(days[21].step, 0)
  assert.ok(days.slice(22).every((d) => d.future && d.step === 0))
  assert.ok(days.slice(0, 22).every((d) => !d.future))
})

test('quantile steps: four or more days spread over 1–4, ties share a step', () => {
  const at = (day, amount) => row(`r${day}-${amount}`, amount, `2026-09-${String(day).padStart(2, '0')}T10:00:00Z`)
  const groups = [group('a', 'rojo', [at(1, 10), at(2, 10), at(3, 10), at(4, 50), at(5, 80), at(6, 200), at(7, 500), at(8, 1000)])]
  const steps = dailyTotals(groups, '2026-09-01', '2026-09-30', 'Europe/Madrid', '2026-09-30')
    .slice(0, 9)
    .map((d) => d.step)
  // 10,10,10 share the lowest step; only the heaviest day is the darkest; nothing on the 9th.
  assert.deepEqual(steps, [1, 1, 1, 2, 2, 3, 3, 4, 0])
})

test('quantile steps with fewer than four spending days', () => {
  const at = (day, amount) => row(`r${day}`, amount, `2026-09-${String(day).padStart(2, '0')}T10:00:00Z`)
  const steps = (rows) =>
    dailyTotals([group('a', 'rojo', rows)], '2026-09-01', '2026-09-30', 'Europe/Madrid', '2026-09-30')
      .filter((d) => d.total > 0)
      .map((d) => d.step)
  assert.deepEqual(steps([at(1, 40)]), [4])
  assert.deepEqual(steps([at(1, 40), at(2, 10)]), [4, 1])
  assert.deepEqual(steps([at(1, 40), at(2, 10), at(3, 20)]), [4, 1, 2])
  assert.deepEqual(steps([at(1, 40), at(2, 40)]), [4, 4])
})

test('the demo cycle: 1 September is the darkest, 11 September has nothing, 3 September holds three rows', () => {
  const groups = [
    group('vivienda', 'gris_oscuro', [
      row('alquiler', 820, '2026-09-01T09:00:00Z', { fixed: { definitionId: 'def-alquiler', day: 1, charged: true } }),
      row('internet', 45, '2026-09-03T09:00:00Z', { fixed: { definitionId: 'def-internet', day: 3, charged: true } }),
    ]),
    group('comida', 'naranja_calido', [
      row('supermercado', 180, '2026-09-03T12:00:00Z'),
      row('cafe', 62.4, '2026-09-02T23:30:00Z'),
      row('restaurante', 67.6, '2026-09-07T20:00:00Z'),
    ]),
  ]
  const days = dailyTotals(groups, '2026-09-01', '2026-09-30', 'Europe/Dublin', '2026-09-30')
  assert.equal(days[0].step, 4)
  assert.ok(days[2].step < 4)
  assert.equal(days[10].step, 0)
  assert.deepEqual([Math.round(days[2].total * 100) / 100, days[2].rows], [287.4, 3])
})
