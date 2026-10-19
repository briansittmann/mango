import { z } from 'zod'
import { paymentMethodsOffered } from '@/lib/data/payment-method'
import { cycleMonthOf, localDateOf } from '@/lib/data/supabase/cycle'
import { createSupabaseExpenseMutations } from '@/lib/data/supabase/expenses'
import { createSupabaseIncomeMutations } from '@/lib/data/supabase/income'
import { createSupabaseSavingsMutations } from '@/lib/data/supabase/savings'
import { createSupabaseTransferMutations } from '@/lib/data/supabase/transfers'
import { cycleOfMonth, monthBounds } from '../account'
import type { ToolContext } from '../context'
import { McpToolError } from '../errors'
import { checkPaymentMethods, mergeMovement, newMovement, type MovementFields, type MovementKind, type MovementPlan } from '../map'
import { maxMonthOf } from '../months'
import { classifyRow, isRowId, type RowLookup } from '../rows'
import { round2 } from '../shape'
import { tool } from './define'
import { amountField, dateField, idField, paymentMethodField } from './fields'

// One-off movements (`mcp-server` → *One-off movements*, add-mcp-server D5): the same four
// contracts the dashboard's sheets use, chosen by the stored row's kind.

type StoredRow = NonNullable<RowLookup> & {
  id: string
  monto: number | string
  descripcion: string | null
  fecha: string
  categoria_id: string | null
  medio_pago: 'efectivo' | 'tarjeta' | null
  ahorro_previo: boolean
  borrado_en: string | null
}

const ROW_COLUMNS = 'id, tipo, monto, descripcion, fecha, categoria_id, medio_pago, ahorro_previo, movimiento_recurrente_id, borrado_en'
const TIPO = { expense: 'gasto', income: 'ingreso', savings: 'ahorro', transfer: 'transferencia' } as const

async function readRow({ ctx }: ToolContext, id: string): Promise<StoredRow | null> {
  if (!isRowId(id)) return null
  const { data, error } = await ctx.client.from('transacciones').select(ROW_COLUMNS).eq('id', id).eq('usuario_id', ctx.usuarioId).maybeSingle()
  if (error) throw error
  return data as StoredRow | null
}

async function cycleStartOf({ ctx }: ToolContext, date: string) {
  const { data, error } = await ctx.client
    .rpc('rango_ciclo_usuario', { p_usuario_id: ctx.usuarioId, p_fecha_ref: `${date}T12:00:00Z` })
    .single<{ inicio: string; fin: string }>()
  if (error) throw error
  return { start: localDateOf(data.inicio, ctx.timezone), month: cycleMonthOf({ inicio: new Date(data.inicio), fin: new Date(data.fin) }, ctx.timezone) }
}

/** The category exists in the account (`not-found`) and is alive in the date's cycle (`category-not-alive`). */
export async function checkCategoryAlive(tc: ToolContext, categoryId: string, date: string) {
  const { ctx } = tc
  const found = isRowId(categoryId)
    ? await ctx.client.from('categorias').select('id').eq('id', categoryId).eq('usuario_id', ctx.usuarioId).maybeSingle()
    : { data: null, error: null }
  if (found.error) throw found.error
  if (!found.data) throw new McpToolError('not-found', 'No category with that id in this account.')
  const { start, month } = await cycleStartOf(tc, date)
  const alive = await ctx.client.rpc('categoria_viva', { p_usuario_id: ctx.usuarioId, p_categoria_id: categoryId, p_periodo: start })
  if (alive.error) throw alive.error
  if (!alive.data) throw new McpToolError('category-not-alive', `That category does not exist in the ${month} cycle; get_summary for that month lists the ones that do.`)
}

/** A date no later than the last day of the sixth projected cycle, as the sheets allow. */
async function checkDate(tc: ToolContext, date: string) {
  const { current } = await monthBounds(tc)
  const last = await cycleOfMonth(tc, maxMonthOf(current))
  if (date > last.end) throw new McpToolError('out-of-range', `The latest date that can be used is ${last.end}.`)
}

function storedAmount(plan: MovementPlan): number {
  return plan.kind === 'savings' && plan.draft.kind === 'withdrawal' ? -plan.draft.amount : plan.draft.amount
}

async function idsLike({ ctx }: ToolContext, plan: MovementPlan): Promise<Set<string>> {
  const { data, error } = await ctx.client
    .from('transacciones')
    .select('id')
    .eq('usuario_id', ctx.usuarioId)
    .eq('tipo', TIPO[plan.kind])
    .eq('fecha', `${plan.draft.date}T12:00:00Z`)
    .eq('monto', storedAmount(plan))
  if (error) throw error
  return new Set((data ?? []).map((row) => row.id as string))
}

async function apply(tc: ToolContext, plan: MovementPlan, id?: string) {
  const { ctx } = tc
  switch (plan.kind) {
    case 'expense':
      return id ? createSupabaseExpenseMutations(ctx).update(id, plan.draft, plan.categoryId) : createSupabaseExpenseMutations(ctx).create(plan.categoryId, plan.draft)
    case 'income':
      return id ? createSupabaseIncomeMutations(ctx).update(id, plan.draft) : createSupabaseIncomeMutations(ctx).create(plan.draft)
    case 'savings':
      return id ? createSupabaseSavingsMutations(ctx).update(id, plan.draft) : createSupabaseSavingsMutations(ctx).addSavingsMovement(plan.draft)
    case 'transfer':
      return id ? createSupabaseTransferMutations(ctx).update(id, plan.draft) : createSupabaseTransferMutations(ctx).create(plan.draft)
  }
}

function contract(tc: ToolContext, kind: MovementKind) {
  const { ctx } = tc
  return kind === 'expense'
    ? createSupabaseExpenseMutations(ctx)
    : kind === 'income'
      ? createSupabaseIncomeMutations(ctx)
      : kind === 'savings'
        ? createSupabaseSavingsMutations(ctx)
        : createSupabaseTransferMutations(ctx)
}

const KIND = { gasto: 'expense', ingreso: 'income', ahorro: 'savings', transferencia: 'transfer' } as const

/** A stored row as the tools return it, like `list_movements` lists it. */
async function movementOut(tc: ToolContext, id: string) {
  const row = await readRow(tc, id)
  if (!row) throw new McpToolError('not-found', 'No movement with that id in this account.')
  const date = localDateOf(row.fecha, tc.ctx.timezone)
  const kind = KIND[row.tipo]
  const amount = Number(row.monto)
  let category: { id: string; name: string } | undefined
  if (row.categoria_id) {
    const { data } = await tc.ctx.client.from('categorias').select('nombre').eq('id', row.categoria_id).eq('usuario_id', tc.ctx.usuarioId).maybeSingle()
    category = { id: row.categoria_id, name: (data?.nombre as string | undefined) ?? '' }
  }
  return {
    currency: tc.ctx.currency,
    movement: {
      id: row.id,
      kind,
      description: row.descripcion ?? '',
      amount: round2(Math.abs(amount)),
      date,
      cycle_month: (await cycleStartOf(tc, date)).month,
      ...(category ? { category } : {}),
      ...(kind === 'expense' || kind === 'income' ? { payment_method: row.medio_pago } : {}),
      ...(kind === 'savings' ? { direction: amount < 0 ? 'withdrawal' : 'deposit', already_saved: row.ahorro_previo } : {}),
      ...(kind === 'transfer' ? { into: row.medio_pago } : {}),
      deleted: row.borrado_en != null,
    },
  }
}

const movementFields = {
  amount: amountField,
  description: z.string().max(200).describe('What it was (the person’s own words). Required for savings; optional otherwise.'),
  date: dateField,
  category_id: idField.describe('Expenses only: the id of a category alive in the date’s cycle (get_summary lists them).'),
  payment_method: paymentMethodField,
  direction: z.enum(['deposit', 'withdrawal']).describe('Savings only: money put into savings or taken out.'),
  already_saved: z.boolean().describe('Savings deposits only: money the person already had saved. It adds to the accumulated balance, not to this cycle’s savings or the free margin.'),
  into: z.enum(['efectivo', 'tarjeta']).describe('Transfers only: the pocket the money enters. efectivo = withdrawing cash from the card; tarjeta = depositing cash into the card account.'),
}

function offered({ usuario }: ToolContext) {
  return paymentMethodsOffered(usuario.pais, usuario.medio_pago_habilitado)
}

export const movementTools = [
  tool({
    name: 'add_movement',
    title: 'Add a movement',
    description:
      'Record a one-off movement: an expense (in a category), an income, a savings deposit or withdrawal, or a transfer between cash and card (only on accounts that use payment methods). The date defaults to today. Never creates a fixed charge: use create_fixed_charge for something that repeats every month. Returns the new movement with its id.',
    input: z.object({
      kind: z.enum(['expense', 'income', 'savings', 'transfer']),
      amount: amountField,
      description: movementFields.description.optional(),
      date: movementFields.date.optional(),
      category_id: movementFields.category_id.optional(),
      payment_method: movementFields.payment_method.optional(),
      direction: movementFields.direction.optional(),
      already_saved: movementFields.already_saved.optional(),
      into: movementFields.into.optional(),
    }),
    async run(tc, { kind, ...fields }) {
      checkPaymentMethods(offered(tc), kind, fields)
      const plan = newMovement(kind, fields as MovementFields, localDateOf(new Date(), tc.ctx.timezone))
      await checkDate(tc, plan.draft.date)
      if (plan.kind === 'expense') await checkCategoryAlive(tc, plan.categoryId, plan.draft.date)
      const before = await idsLike(tc, plan)
      await apply(tc, plan)
      const created = [...(await idsLike(tc, plan))].find((id) => !before.has(id))
      if (!created) throw new Error('created row not found')
      return movementOut(tc, created)
    },
  }),
  tool({
    name: 'update_movement',
    title: 'Change a movement',
    description:
      'Change a one-off movement by id: only the fields given change, the rest stay. An expense can move to another category alive in its cycle. A row of a fixed charge (it has `fixed` in list_movements, or a proj: id) is refused: use update_fixed_charge. Returns the movement as it is now.',
    input: z.object({
      id: idField.describe('The movement id from list_movements.'),
      amount: amountField.optional(),
      description: movementFields.description.optional(),
      date: movementFields.date.optional(),
      category_id: movementFields.category_id.optional(),
      payment_method: movementFields.payment_method.optional(),
      direction: movementFields.direction.optional(),
      already_saved: movementFields.already_saved.optional(),
      into: movementFields.into.optional(),
    }),
    async run(tc, { id, ...patch }) {
      const row = await readRow(tc, id)
      const kind = classifyRow(id, row, 'update')
      if (row!.borrado_en) throw new McpToolError('not-found', 'That movement is deleted; restore_movement brings it back first.')
      checkPaymentMethods(offered(tc), kind, patch)
      const plan = mergeMovement(
        {
          kind,
          amount: Number(row!.monto),
          description: row!.descripcion ?? '',
          date: localDateOf(row!.fecha, tc.ctx.timezone),
          categoryId: row!.categoria_id,
          paymentMethod: row!.medio_pago,
          alreadySaved: row!.ahorro_previo,
        },
        patch as MovementFields,
      )
      await checkDate(tc, plan.draft.date)
      if (plan.kind === 'expense') await checkCategoryAlive(tc, plan.categoryId, plan.draft.date)
      await apply(tc, plan, id)
      return movementOut(tc, id)
    },
  }),
  tool({
    name: 'delete_movement',
    title: 'Delete a movement',
    description:
      'Delete a one-off movement by id: it leaves every figure at once and can be brought back with restore_movement and the same id. A row of a fixed charge is refused: use delete_fixed_charge.',
    input: z.object({ id: idField.describe('The movement id from list_movements.') }),
    async run(tc, { id }) {
      const row = await readRow(tc, id)
      const kind = classifyRow(id, row, 'delete')
      if (row!.borrado_en) throw new McpToolError('not-found', 'That movement is already deleted; restore_movement brings it back.')
      await contract(tc, kind).softDelete(id)
      return { ...(await movementOut(tc, id)), restore_with: 'restore_movement' }
    },
  }),
  tool({
    name: 'restore_movement',
    title: 'Restore a movement',
    description: 'Undo delete_movement: the movement is back in every figure with the same id.',
    input: z.object({ id: idField.describe('The id of the deleted movement.') }),
    async run(tc, { id }) {
      const row = await readRow(tc, id)
      const kind = classifyRow(id, row, 'restore')
      if (row!.borrado_en) await contract(tc, kind).restore(id)
      return movementOut(tc, id)
    },
  }),
]
