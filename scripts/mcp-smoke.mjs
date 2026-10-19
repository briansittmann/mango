// Smoke test of the MCP tools against the real database, as Brian (add-mcp-server D12, tasks 4.2–4.9).
//
//   SMOKE_EMAIL=<account> node --env-file=.env.local scripts/mcp-smoke.mjs [read] [movements] [categories] [fixed] [cards] [cleanup]
//
// Talks to `/api/mcp` of a running `next dev` (MCP_URL, default http://localhost:3000) with a real
// OAuth access token: it registers a throwaway client by DCR, approves it as Brian with a one-time
// sign-in (`generateLink`, no mail), and at the end revokes the grant and deletes the client.
// Every group except `read` writes: what it creates is named "Prueba MCP…" and hard-deleted at the
// end with the service role, which then counts what is left. Run them only with Brian's confirmation.

import { createClient } from '@supabase/supabase-js'
import { createHash, randomBytes, randomUUID } from 'node:crypto'
import assert from 'node:assert/strict'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const MCP_URL = process.env.MCP_URL ?? 'http://localhost:3000'
const EMAIL = process.env.SMOKE_EMAIL
if (!EMAIL) throw new Error('Set SMOKE_EMAIL to the account to run as (a test account for the write groups).')
const REDIRECT = 'http://localhost:9999/callback'
const admin = createClient(SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
const b64 = (b) => b.toString('base64url')

async function signIn(email) {
  const { data: link, error } = await admin.auth.admin.generateLink({ type: 'magiclink', email })
  if (error) throw error
  const client = createClient(SUPABASE_URL, ANON, { auth: { persistSession: false } })
  const { error: e2 } = await client.auth.verifyOtp({ token_hash: link.properties.hashed_token, type: 'magiclink' })
  if (e2) throw e2
  return client
}

async function usuarioIdOf(email) {
  const { data: link, error } = await admin.auth.admin.generateLink({ type: 'magiclink', email })
  if (error) throw error
  const { data } = await admin.from('usuarios').select('id').eq('auth_user_id', link.user.id).single()
  return data.id
}

async function connect(email) {
  const reg = await fetch(`${SUPABASE_URL}/auth/v1/oauth/clients/register`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ client_name: 'Mango smoke', redirect_uris: [REDIRECT], token_endpoint_auth_method: 'none', grant_types: ['authorization_code', 'refresh_token'], response_types: ['code'] }),
  }).then((r) => r.json())
  const clientId = reg.client_id
  const session = await signIn(email)
  // Revoking deletes the session; deleting the client alone is a soft delete that leaves it alive.
  const cleanup = async () => {
    for (let attempt = 0; attempt < 3; attempt++) {
      const revoked = await session.auth.oauth.revokeGrant({ clientId }).catch((error) => ({ error }))
      const deleted = await admin.auth.admin.oauth.deleteClient(clientId).catch((error) => ({ error }))
      if (!revoked.error && !deleted.error) break
      await new Promise((resolve) => setTimeout(resolve, 2000))
    }
    await session.auth.signOut({ scope: 'local' }).catch(() => {})
  }
  try {
    const verifier = b64(randomBytes(32))
    const q = new URLSearchParams({
      response_type: 'code', client_id: clientId, redirect_uri: REDIRECT, state: 's',
      code_challenge: b64(createHash('sha256').update(verifier).digest()), code_challenge_method: 'S256',
    })
    const authorize = await fetch(`${SUPABASE_URL}/auth/v1/oauth/authorize?${q}`, { redirect: 'manual' })
    const authorizationId = new URL(authorize.headers.get('location')).searchParams.get('authorization_id')
    await session.auth.oauth.getAuthorizationDetails(authorizationId)
    const { data, error } = await session.auth.oauth.approveAuthorization(authorizationId, { skipBrowserRedirect: true })
    if (error) throw error
    const tokens = await fetch(`${SUPABASE_URL}/auth/v1/oauth/token`, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ grant_type: 'authorization_code', code: new URL(data.redirect_url).searchParams.get('code'), code_verifier: verifier, client_id: clientId, redirect_uri: REDIRECT }),
    }).then((r) => r.json())
    if (!tokens.access_token) throw new Error(JSON.stringify(tokens))
    return { token: tokens.access_token, cleanup, usuarioId: await usuarioIdOf(email) }
  } catch (error) {
    await cleanup()
    throw error
  }
}

let rpcId = 0
async function rpc(token, method, params) {
  const res = await fetch(`${MCP_URL}/api/mcp`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', accept: 'application/json, text/event-stream', authorization: `Bearer ${token}`, 'mcp-protocol-version': '2025-06-18' },
    body: JSON.stringify({ jsonrpc: '2.0', id: ++rpcId, method, params }),
  })
  const text = await res.text()
  const line = text.split('\n').find((l) => l.startsWith('data: '))
  const body = JSON.parse(line ? line.slice(6) : text)
  if (body.error) throw new Error(`${method}: ${JSON.stringify(body.error)}`)
  return body.result
}

/**
 * Calls a tool; returns its structured content, or `{ error: code }` for an error result. An
 * error nobody checks for (no `isError` assertion follows) is logged, so a failed step says why.
 */
const READS = ['get_summary', 'list_movements', 'list_fixed_charges']

function caller(token) {
  return async (name, args = {}) => {
    let result
    // The local network to Supabase drops a connection now and then: a read that failed is tried
    // again, a write never (it may have been applied).
    for (let attempt = 1; ; attempt++) {
      result = await rpc(token, 'tools/call', { name, arguments: args }).catch((error) => {
        if (!READS.includes(name) || attempt === 3) throw error
        return { isError: true, structuredContent: { code: 'failed' } }
      })
      if (!(READS.includes(name) && result.isError && result.structuredContent?.code === 'failed' && attempt < 3)) break
      await new Promise((resolve) => setTimeout(resolve, 2000))
    }
    if (!result.isError) return result.structuredContent
    const error = { error: result.structuredContent?.code, message: result.structuredContent?.message }
    console.log(`  ${name} → ${error.error}: ${error.message}`)
    return error
  }
}

const groups = {
  async read(call) {
    const summary = await call('get_summary')
    console.log('get_summary', summary.cycle, { free_margin: summary.free_margin, income: summary.income_total, expenses: summary.expenses_total, savings: summary.savings })
    console.log('  categories', summary.categories.map((c) => `${c.name} ${c.total}${c.budget ? `/${c.budget.amount}` : ''}`).join(' · '))
    const sum = Math.round(summary.categories.reduce((s, c) => s + c.total, 0) * 100) / 100
    assert.equal(sum, summary.expenses_total, 'category totals add up to the expenses total')
    const projectedMonth = shift(summary.cycle.month, 2)
    const projected = await call('get_summary', { month: projectedMonth })
    assert.equal(projected.cycle.projected, true)
    console.log('get_summary', projected.cycle, { free_margin: projected.free_margin, income: projected.income_total, expenses: projected.expenses_total })
    const movements = await call('list_movements', { month: projectedMonth })
    assert.ok(movements.movements.some((m) => m.id.startsWith('proj:') && m.fixed?.projected), 'a projected month lists proj: rows')
    console.log('list_movements', projectedMonth, movements.movements.length, 'rows,', movements.movements.filter((m) => m.id.startsWith('proj:')).length, 'proj:')
    const current = await call('list_movements', { kind: 'expense' })
    console.log('list_movements expense', current.movements.length, 'rows; newest', current.movements[0]?.date)
    const fixed = await call('list_fixed_charges')
    console.log('list_fixed_charges', fixed.fixed_charges.length, 'definitions,', fixed.fixed_charges.filter((d) => d.active).length, 'active')
    assert.deepEqual(await call('get_summary', { month: shift(summary.cycle.month, 7) }).then((r) => r.error), 'out-of-range')
    assert.equal((await call('get_summary', { month: 'octubre' })).error, 'invalid-input')
    return { summary, projected }
  },
}

const created = { tx: new Set(), cats: new Set(), defs: new Set(), cards: new Set() }
const cat = (summary, name) => summary.categories.find((c) => c.name === name) ?? assert.fail(`no ${name}`)
const isError = (result, code) => assert.equal(result.error, code, `${code}: ${JSON.stringify(result)}`)
const round = (n) => Math.round(n * 100) / 100

Object.assign(groups, {
  async movements(call, { usuarioId }) {
    const s = await call('get_summary')
    const otros = cat(s, 'Otros')
    const ocio = cat(s, 'Ocio')
    const add = await call('add_movement', { kind: 'expense', amount: 4.5, description: 'Prueba MCP', category_id: otros.id })
    assert.ok(add.movement?.id, JSON.stringify(add))
    created.tx.add(add.movement.id)
    assert.deepEqual([add.movement.kind, add.movement.amount, add.movement.category.name, add.movement.cycle_month], ['expense', 4.5, 'Otros', s.cycle.month])
    const after = await call('get_summary')
    assert.equal(after.free_margin, round(s.free_margin - 4.5), 'free margin drops by 4.5')
    console.log('add_movement ok; free margin', s.free_margin, '->', after.free_margin)
    const up = await call('update_movement', { id: add.movement.id, amount: 5.25, category_id: ocio.id })
    assert.deepEqual([up.movement.amount, up.movement.category.name, up.movement.description], [5.25, 'Ocio', 'Prueba MCP'])
    const del = await call('delete_movement', { id: add.movement.id })
    assert.deepEqual([del.movement.deleted, del.restore_with], [true, 'restore_movement'])
    assert.ok(!(await call('list_movements', { kind: 'expense' })).movements.some((m) => m.id === add.movement.id))
    const back = await call('restore_movement', { id: add.movement.id })
    assert.equal(back.movement.deleted, false)
    assert.ok((await call('list_movements', { kind: 'expense' })).movements.some((m) => m.id === add.movement.id))
    await call('delete_movement', { id: add.movement.id })
    console.log('update / delete / restore / delete ok')

    const fixedRow = (await call('list_movements', { kind: 'expense' })).movements.find((m) => m.fixed && !m.fixed.projected)
    isError(await call('update_movement', { id: fixedRow.id, amount: 1 }), 'fixed-row')
    isError(await call('delete_movement', { id: fixedRow.id }), 'fixed-row')
    const proj = (await call('list_movements', { month: shift(s.cycle.month, 2) })).movements.find((m) => m.id.startsWith('proj:'))
    isError(await call('delete_movement', { id: proj.id }), 'fixed-row')

    const solo = await call('create_category', { name: 'Prueba MCP solo', month: shift(s.cycle.month, 2), scope: 'only_this_month' })
    created.cats.add(solo.category.id)
    isError(await call('add_movement', { kind: 'expense', amount: 1, category_id: solo.category.id }), 'category-not-alive')
    await call('delete_category', { id: solo.category.id, month: shift(s.cycle.month, 2), scope: 'from_this_month' })

    const { data: me } = await admin.from('usuarios').select('pais, medio_pago_habilitado').eq('id', usuarioId).single()
    if (me.medio_pago_habilitado === true || ['AR', 'UY', 'MX', 'CO'].includes(me.pais)) {
      console.log('(payment-methods-not-offered skipped: this account is offered the feature)')
    } else {
      isError(await call('add_movement', { kind: 'expense', amount: 1, category_id: otros.id, payment_method: 'efectivo' }), 'payment-methods-not-offered')
      isError(await call('add_movement', { kind: 'transfer', amount: 1, into: 'efectivo' }), 'payment-methods-not-offered')
    }
    isError(await call('delete_movement', { id: randomUUID() }), 'not-found')
    isError(await call('add_movement', { kind: 'expense', amount: 1, category_id: otros.id, date: '2031-01-01' }), 'out-of-range')
    isError(await call('add_movement', { kind: 'expense', amount: -1, category_id: otros.id }), 'invalid-input')
    const { data: foreign } = await admin.from('transacciones').select('id').neq('usuario_id', usuarioId).is('borrado_en', null).limit(1).maybeSingle()
    if (foreign) {
      isError(await call('delete_movement', { id: foreign.id }), 'not-found')
      const { data: still } = await admin.from('transacciones').select('borrado_en').eq('id', foreign.id).single()
      assert.equal(still.borrado_en, null, "another account's row is untouched")
    }
    console.log('refusals ok: fixed-row, category-not-alive, payment-methods-not-offered, not-found, out-of-range, invalid-input, foreign id')
  },

  async categories(call, { usuarioId }) {
    const s = await call('get_summary')
    const m2 = shift(s.cycle.month, 2)
    const otros = cat(s, 'Otros')
    const a = await call('create_category', { name: 'Prueba MCP', month: m2, scope: 'only_this_month' })
    assert.ok(a.category, JSON.stringify(a))
    created.cats.add(a.category.id)
    const has = async (month) => (await call('get_summary', { month })).categories.some((c) => c.id === a.category.id)
    assert.deepEqual([await has(s.cycle.month), await has(shift(s.cycle.month, 1)), await has(m2), await has(shift(s.cycle.month, 3))], [false, false, true, false])
    assert.equal((await call('update_category', { id: a.category.id, month: m2, name: 'Prueba MCP 2' })).category.name, 'Prueba MCP 2')
    isError(await call('update_category', { id: a.category.id, month: m2, budget: 50 }), 'invalid-input')
    await call('update_category', { id: a.category.id, month: m2, budget: 50, scope: 'only_this_month' })
    assert.equal((await call('get_summary', { month: m2 })).categories.find((c) => c.id === a.category.id).budget.amount, 50)
    isError(await call('create_category', { name: 'comida' }), 'duplicate-name')
    isError(await call('update_category', { id: a.category.id, month: m2, name: 'OTROS' }), 'duplicate-name')
    console.log('create only this month / rename / budget with and without scope / duplicate-name ok')

    const m2Start = (await call('get_summary', { month: m2 })).cycle.start
    const row = await call('add_movement', { kind: 'expense', amount: 3, description: 'Prueba MCP', category_id: a.category.id, date: m2Start })
    created.tx.add(row.movement.id)
    const refused = await call('delete_category', { id: a.category.id, month: m2, scope: 'from_this_month' })
    isError(refused, 'invalid-input')
    console.log('  without reassign_to:', refused.message)
    const done = await call('delete_category', { id: a.category.id, month: m2, scope: 'from_this_month', reassign_to: otros.id })
    assert.equal(done.moved_to, otros.id)
    assert.equal(await has(m2), false)
    const moved = (await call('list_movements', { month: m2, kind: 'expense' })).movements.find((m) => m.id === row.movement.id)
    assert.equal(moved.category.id, otros.id)
    await call('delete_movement', { id: row.movement.id })

    const b = await call('create_category', { name: 'Prueba MCP B' })
    created.cats.add(b.category.id)
    await call('delete_category', { id: b.category.id, scope: 'from_this_month' })
    assert.ok(!(await call('get_summary')).categories.some((c) => c.id === b.category.id))
    console.log('delete with and without reassign_to ok')

    const orderOf = async () => (await admin.from('categorias').select('id, orden').eq('usuario_id', usuarioId).order('orden')).data
    const before = await orderOf()
    await call('reorder_categories', { category_ids: s.categories.map((c) => c.id) })
    assert.deepEqual(await orderOf(), before, 'same list, same stored order')
    isError(await call('reorder_categories', { category_ids: s.categories.slice(1).map((c) => c.id) }), 'invalid-input')
    console.log('reorder with the same list: no change')
  },

  async fixed(call) {
    const s = await call('get_summary')
    const [m0, m1, m2, m3] = [0, 1, 2, 3].map((n) => shift(s.cycle.month, n))
    const otros = cat(s, 'Otros')
    const f = await call('create_fixed_charge', { kind: 'expense', name: 'Prueba MCP fijo', amount: 10, day: 15, category_id: otros.id })
    assert.ok(f.fixed_charge?.id, JSON.stringify(f))
    const id = f.fixed_charge.id
    created.defs.add(id)
    assert.equal(f.fixed_charge.this_month.amount, 10)
    const at = async (month) => (await call('list_fixed_charges', { month })).fixed_charges.find((d) => d.id === id)
    await call('update_fixed_charge', { id, month: m1, amount: 12, scope: 'only_this_month' })
    assert.deepEqual([(await at(m0)).this_month.amount, (await at(m1)).this_month.amount, (await at(m2)).this_month.amount, (await at(m2)).expected_amount], [10, 12, 10, 10])
    await call('update_fixed_charge', { id, month: m2, amount: 15, scope: 'from_this_month' })
    assert.deepEqual([(await at(m0)).this_month.amount, (await at(m1)).this_month.amount, (await at(m2)).this_month.amount, (await at(m3)).this_month.amount, (await at(m3)).expected_amount], [10, 12, 15, 15, 15])
    console.log('only this month vs from this month ok')
    isError(await call('update_fixed_charge', { id, amount: 11 }), 'invalid-input')
    isError(await call('update_fixed_charge', { id, month: shift(m0, -1), amount: 1, scope: 'only_this_month' }), 'out-of-range')
    const r = await call('update_fixed_charge', { id, reminder_days_before: 2 })
    assert.deepEqual([r.fixed_charge.reminder_days_before, r.fixed_charge.this_month.amount], [2, 10])
    assert.equal((await call('update_fixed_charge', { id, reminder_days_before: null })).fixed_charge.reminder_days_before, null)
    assert.equal((await call('set_fixed_charged', { id, charged: true })).fixed_charge.this_month.charged, true)
    assert.equal((await call('set_fixed_charged', { id, charged: false })).fixed_charge.this_month.charged, false)
    console.log('reminder without scope, month before refused, mark and unmark charged ok')

    const d1 = await call('delete_fixed_charge', { id, month: m1, mode: 'only_this_month' })
    assert.equal(d1.restore_with, 'restore_fixed_charge_month')
    assert.deepEqual((await at(m1)).this_month, { deleted: true })
    assert.equal((await call('restore_fixed_charge_month', { id, month: m1 })).fixed_charge.this_month.amount, 12)
    await call('delete_fixed_charge', { id, month: m2, mode: 'from_this_month' })
    assert.deepEqual([(await at(m1)).this_month.amount, (await at(m2)).active], [12, false])
    await call('delete_fixed_charge', { id, mode: 'stop' })
    assert.equal((await at(m0)).active, false)
    const all = await call('delete_fixed_charge', { id, mode: 'everywhere' })
    assert.ok(all.note)
    isError(await call('restore_fixed_charge_month', { id, month: m1 }), 'not-found')
    assert.equal(await at(m0), undefined)
    console.log('delete modes: only this month + restore, from this month, stop, everywhere ok')
  },
})

groups.cards = async (call) => {
  const s = await call('get_summary')
  const m0 = s.cycle.month
  const f = await call('create_fixed_charge', { kind: 'expense', name: 'Prueba MCP fijo tarjeta', amount: 7, day: 20, category_id: cat(s, 'Otros').id })
  assert.ok(f.fixed_charge?.id, JSON.stringify(f))
  const id = f.fixed_charge.id
  created.defs.add(id)
  const at = async (month) => (await call('list_fixed_charges', { month })).fixed_charges.find((d) => d.id === id)
    const c = await call('create_card', { name: 'Prueba MCP', color: 'rojo', fixed_charge_ids: [id] })
    created.cards.add(c.card.id)
    assert.deepEqual(c.card.fixed_charges.map((d) => d.id), [id])
    assert.equal((await at(m0)).card.id, c.card.id)
    isError(await call('create_card', { name: 'prueba mcp', color: 'azul_electrico' }), 'duplicate-name')
    isError(await call('update_card', { id: c.card.id, fixed_charge_ids: [randomUUID()] }), 'not-found')
    assert.equal((await at(m0)).card.id, c.card.id, 'an unknown id applies nothing')
    assert.equal((await call('update_card', { id: c.card.id, name: 'Prueba MCP 2' })).card.name, 'Prueba MCP 2')
    assert.equal((await call('update_fixed_charge', { id, card_id: null })).fixed_charge.card, null)
    assert.equal((await call('update_fixed_charge', { id, card_id: c.card.id })).fixed_charge.card.id, c.card.id)
    const gone = await call('delete_card', { id: c.card.id })
    assert.deepEqual(gone.left_without_card.map((d) => d.id), [id])
    assert.equal((await at(m0)).card, null)
    console.log('cards: create with fixed, duplicate-name, unknown id, rename, card on the fixed, delete ok')

  await call('delete_fixed_charge', { id, mode: 'everywhere' })
}

async function hardCleanup(usuarioId, budgetsBefore) {
  // Also by name: a write whose response the network lost is stored but was never recorded here.
  for (const [table, set] of [['categorias', created.cats], ['movimientos_recurrentes', created.defs], ['tarjetas', created.cards]]) {
    const { data } = await admin.from(table).select('id').eq('usuario_id', usuarioId).ilike('nombre', 'Prueba MCP%')
    for (const row of data ?? []) set.add(row.id)
  }
  const { data: named } = await admin.from('transacciones').select('id').eq('usuario_id', usuarioId).ilike('descripcion', 'Prueba MCP%')
  for (const row of named ?? []) created.tx.add(row.id)
  const defs = [...created.defs]
  const cats = [...created.cats]
  const tx = new Set(created.tx)
  for (const [column, ids] of [['movimiento_recurrente_id', defs], ['categoria_id', cats]]) {
    if (!ids.length) continue
    const { data } = await admin.from('transacciones').select('id').eq('usuario_id', usuarioId).in(column, ids)
    for (const row of data ?? []) tx.add(row.id)
  }
  const steps = [
    ['transacciones', [...tx]],
    ['movimientos_recurrentes', defs],
    ['categorias', cats],
    ['tarjetas', [...created.cards]],
  ]
  for (const [table, ids] of steps) {
    if (!ids.length) continue
    const { error } = await admin.from(table).delete().eq('usuario_id', usuarioId).in('id', ids)
    if (error) console.error('cleanup', table, error.message)
  }
  const { data: budgets } = await admin.from('presupuestos').select('categoria_id, periodo').eq('usuario_id', usuarioId)
  const added = (budgets ?? []).filter((b) => !budgetsBefore.has(`${b.categoria_id}|${b.periodo}`))
  for (const b of added) await admin.from('presupuestos').delete().eq('usuario_id', usuarioId).eq('categoria_id', b.categoria_id).eq('periodo', b.periodo)
  const { data: budgetsAfter } = await admin.from('presupuestos').select('categoria_id, periodo').eq('usuario_id', usuarioId)
  const left = { 'presupuestos added': (budgetsAfter ?? []).filter((b) => !budgetsBefore.has(`${b.categoria_id}|${b.periodo}`)).length }
  for (const [table, ids] of steps) {
    if (!ids.length) continue
    const { count, error } = await admin.from(table).select('id', { count: 'exact', head: true }).in('id', ids)
    left[table] = error ? `unknown (${error.message})` : count
  }
  for (const [table, column] of [['transacciones', 'descripcion'], ['categorias', 'nombre'], ['movimientos_recurrentes', 'nombre'], ['tarjetas', 'nombre']]) {
    const { count, error } = await admin.from(table).select('id', { count: 'exact', head: true }).eq('usuario_id', usuarioId).ilike(column, 'Prueba MCP%')
    left[`${table} named Prueba MCP`] = error ? `unknown (${error.message})` : count
  }
  console.log('cleanup: left', left)
}

function shift(month, n) {
  const [y, m] = month.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1 + n, 1)).toISOString().slice(0, 7)
}

groups.cleanup = async () => {}

const wanted = process.argv.slice(2).length ? process.argv.slice(2) : ['read']
const { token, cleanup, usuarioId } = await connect(EMAIL)
// A budget edit in a projection also freezes the inherited budgets of the other categories (the
// contract's own rule): every budget row the run adds is removed with the rest.
const budgetsBefore = new Set(((await admin.from('presupuestos').select('categoria_id, periodo').eq('usuario_id', usuarioId)).data ?? []).map((b) => `${b.categoria_id}|${b.periodo}`))
try {
  const call = caller(token)
  for (const name of wanted) {
    console.log(`\n== ${name}`)
    await groups[name](call, { usuarioId })
  }
  console.log('\nok')
} finally {
  await hardCleanup(usuarioId, budgetsBefore)
  await cleanup()
}
