import { z } from 'zod'
import { paymentMethodsOffered } from '@/lib/data/payment-method'
import { fechaEnCiclo } from '@/lib/data/projection'
import type { SlotEntry } from '@/lib/data/recurring'
import { createSupabaseExpenseMutations } from '@/lib/data/supabase/expenses'
import { createSupabaseIncomeMutations } from '@/lib/data/supabase/income'
import { createSupabaseRecurringMutations } from '@/lib/data/supabase/recurring'
import { readFixedCharges } from '../account'
import type { ToolContext } from '../context'
import { McpToolError } from '../errors'
import { checkPaymentMethods, toScope } from '../map'
import { tool } from './define'
import { amountField, idField, monthField, paymentMethodField, scopeField } from './fields'
import { checkCategoryAlive } from './movements'

// Fixed charges (`mcp-server` → *Fixed charges*, add-mcp-server D6): the slot operations of
// `RecurringMutations` with the scope words of the entry sheet, from the cycle in progress on.

const fixedMonth = monthField.describe('Cycle as YYYY-MM: the cycle in progress (default) or a later one. Earlier months cannot change.')
const dayField = z.number().int().min(1).max(31).describe('Day of the month it is charged (1–31; a short month uses its last day).')
const reminderField = z.number().int().min(0).max(30).describe('Expenses only: send a WhatsApp reminder this many days before (0 = the same day).')

type FixedList = Awaited<ReturnType<typeof readFixedCharges>>

function findFixed(list: FixedList['list'], id: string) {
  const found = list.fixed_charges.find((d) => d.id === id)
  if (!found) throw new McpToolError('not-found', 'No fixed charge with that id in this account.')
  return found
}

async function fixedOut(tc: ToolContext, id: string, month: string) {
  const { list } = await readFixedCharges(tc, month)
  return { currency: list.currency, month: list.cycle.month, fixed_charge: findFixed(list, id) }
}

async function definitionIds({ ctx }: ToolContext, tipo: 'gasto' | 'ingreso', name: string): Promise<Set<string>> {
  const { data, error } = await ctx.client.from('movimientos_recurrentes').select('id').eq('usuario_id', ctx.usuarioId).eq('tipo', tipo).eq('nombre', name)
  if (error) throw error
  return new Set((data ?? []).map((row) => row.id as string))
}

function checkCard(read: FixedList, cardId: string | null | undefined) {
  if (cardId && !read.data.cards.some((card) => card.id === cardId)) throw new McpToolError('not-found', 'No card with that id in this account.')
}

function offered({ usuario }: ToolContext) {
  return paymentMethodsOffered(usuario.pais, usuario.medio_pago_habilitado)
}

export const fixedTools = [
  tool({
    name: 'create_fixed_charge',
    title: 'Create a fixed charge',
    description:
      'Create something that repeats every month (rent, a subscription, an instalment plan, a salary): the definition and this cycle’s row, as the dashboard does. repetitions makes it a plan of N charges; without it, it has no end.',
    input: z.object({
      kind: z.enum(['expense', 'income']),
      name: z.string().trim().min(1).max(60),
      amount: amountField,
      day: dayField,
      category_id: idField.optional().describe('Expenses only (required): a category alive in the cycle in progress.'),
      repetitions: z.number().int().min(1).max(600).optional().describe('Number of charges in total, for a plan; omit for no end.'),
      reminder_days_before: reminderField.optional(),
      payment_method: paymentMethodField.optional(),
      card_id: idField.optional().describe('Expenses only: the card it is charged to (get_summary lists cards).'),
    }),
    async run(tc, input) {
      const expense = input.kind === 'expense'
      if (expense && !input.category_id) throw new McpToolError('invalid-input', 'An expense needs category_id.')
      if (!expense && (input.category_id || input.card_id || input.reminder_days_before != null)) {
        throw new McpToolError('invalid-input', 'category_id, card_id and reminder_days_before only apply to an expense.')
      }
      checkPaymentMethods(offered(tc), input.kind, { payment_method: input.payment_method })
      const read = await readFixedCharges(tc, undefined)
      checkCard(read, input.card_id)
      const date = fechaEnCiclo(read.data.cycle.start, input.day)
      if (expense) await checkCategoryAlive(tc, input.category_id!, date)
      const draft = { amount: input.amount, description: input.name, date, paymentMethod: input.payment_method ?? null }
      // The dashboard's order: this cycle's row, then the definition, which links it (0041).
      if (expense) await createSupabaseExpenseMutations(tc.ctx).create(input.category_id!, draft)
      else await createSupabaseIncomeMutations(tc.ctx).create(draft)
      const tipo = expense ? 'gasto' : 'ingreso'
      const before = await definitionIds(tc, tipo, input.name)
      await createSupabaseRecurringMutations(tc.ctx).create(expense ? { tipo: 'gasto', categoryId: input.category_id! } : { tipo: 'ingreso' }, {
        name: input.name,
        expectedAmount: input.amount,
        day: input.day,
        reminder: { active: input.reminder_days_before != null, daysBefore: input.reminder_days_before ?? 1 },
        repetitions: input.repetitions ?? null,
        paymentMethod: input.payment_method ?? null,
      })
      const id = [...(await definitionIds(tc, tipo, input.name))].find((d) => !before.has(d))
      if (!id) throw new Error('created definition not found')
      if (input.card_id) await createSupabaseRecurringMutations(tc.ctx).setCard(id, input.card_id)
      return fixedOut(tc, id, read.data.cycle.month)
    },
  }),
  tool({
    name: 'update_fixed_charge',
    title: 'Change a fixed charge',
    description:
      'Change a fixed charge from a month on. amount, name, day, category_id and payment_method need scope: only_this_month changes that month’s row alone; from_this_month changes that month, every later one and the definition, never an earlier month. reminder_days_before (null turns it off) and card_id (null for none) belong to the definition and take no scope.',
    input: z.object({
      id: idField.describe('The fixed charge (definition) id from list_fixed_charges.'),
      month: fixedMonth.optional(),
      amount: amountField.optional(),
      name: z.string().trim().min(1).max(60).optional(),
      day: dayField.optional(),
      category_id: idField.optional(),
      payment_method: paymentMethodField.optional(),
      scope: scopeField.optional(),
      reminder_days_before: reminderField.nullable().optional(),
      card_id: idField.nullable().optional(),
    }),
    async run(tc, input) {
      const read = await readFixedCharges(tc, input.month, { fromCurrent: true })
      const fixed = findFixed(read.list, input.id)
      const expense = fixed.kind === 'expense'
      const slotChanges = input.amount !== undefined || input.name !== undefined || input.day !== undefined || input.category_id !== undefined || input.payment_method !== undefined
      if (!slotChanges && input.reminder_days_before === undefined && input.card_id === undefined) {
        throw new McpToolError('invalid-input', 'Give at least one field to change.')
      }
      if (!expense && (input.category_id !== undefined || input.card_id !== undefined || input.reminder_days_before !== undefined)) {
        throw new McpToolError('invalid-input', 'category_id, card_id and reminder_days_before only apply to an expense.')
      }
      checkPaymentMethods(offered(tc), fixed.kind, { payment_method: input.payment_method })
      checkCard(read, input.card_id)
      const recurring = createSupabaseRecurringMutations(tc.ctx)
      const cycle = read.data.cycle
      if (slotChanges) {
        if (!input.scope) throw new McpToolError('invalid-input', 'Changing amount, name, day, category or payment method needs scope: only_this_month or from_this_month.')
        const row = fixed.this_month
        if (!row || row.deleted) {
          throw new McpToolError('invalid-input', row ? 'That month’s charge is deleted; restore_fixed_charge_month brings it back first.' : 'It has no charge that month (it is stopped or ended).')
        }
        const entry: SlotEntry = {
          amount: input.amount ?? row.amount!,
          description: input.name ?? row.name!,
          date: input.day !== undefined ? fechaEnCiclo(cycle.start, input.day) : row.date!,
          categoryId: expense ? (input.category_id ?? row.category_id ?? fixed.category?.id ?? null) : null,
          paymentMethod: input.payment_method === undefined ? (row.payment_method ?? null) : input.payment_method,
        }
        if (expense && input.category_id !== undefined) await checkCategoryAlive(tc, input.category_id, entry.date)
        await recurring.editInCycle(input.id, cycle.start, entry, toScope(input.scope))
        // Writing the slot confirms it; one that was pending this month stays pending, as on the sheet.
        if (expense && cycle.inProgress && !row.charged) await recurring.setCharged(input.id, cycle.start, false)
      }
      if (input.reminder_days_before !== undefined) {
        const daysBefore = input.reminder_days_before ?? 1
        await recurring.setReminder(input.id, { active: input.reminder_days_before !== null, daysBefore })
      }
      if (input.card_id !== undefined) await recurring.setCard(input.id, input.card_id)
      return fixedOut(tc, input.id, cycle.month)
    },
  }),
  tool({
    name: 'set_fixed_charged',
    title: 'Mark a fixed charge charged',
    description: 'Mark this month’s row of a fixed expense as already charged, or back to pending. Only the cycle in progress.',
    input: z.object({ id: idField.describe('The fixed charge (definition) id.'), charged: z.boolean() }),
    async run(tc, input) {
      const read = await readFixedCharges(tc, undefined)
      const fixed = findFixed(read.list, input.id)
      if (fixed.kind !== 'expense') throw new McpToolError('invalid-input', 'Only a fixed expense is marked charged.')
      if (!fixed.this_month || fixed.this_month.deleted) throw new McpToolError('not-found', 'It has no charge in the cycle in progress.')
      await createSupabaseRecurringMutations(tc.ctx).setCharged(input.id, read.data.cycle.start, input.charged)
      return fixedOut(tc, input.id, read.data.cycle.month)
    },
  }),
  tool({
    name: 'delete_fixed_charge',
    title: 'Delete a fixed charge',
    description:
      'Remove a fixed charge, by mode. stop: no more charges, every row stays. only_this_month: that month’s charge is deleted and comes back with restore_fixed_charge_month. from_this_month: that month and later are deleted and the charge stops; earlier months stay. everywhere: the definition and its rows in every month, earlier ones included — this cannot be undone.',
    input: z.object({
      id: idField.describe('The fixed charge (definition) id.'),
      mode: z.enum(['stop', 'only_this_month', 'from_this_month', 'everywhere']),
      month: fixedMonth.optional(),
    }),
    async run(tc, input) {
      const read = await readFixedCharges(tc, input.month, { fromCurrent: true })
      const fixed = findFixed(read.list, input.id)
      const recurring = createSupabaseRecurringMutations(tc.ctx)
      const start = read.data.cycle.start
      if (input.mode === 'stop') await recurring.stop(input.id)
      else if (input.mode === 'everywhere') await recurring.delete(input.id)
      else await recurring.deleteInCycle(input.id, start, toScope(input.mode))
      return {
        month: read.data.cycle.month,
        deleted: { id: input.id, name: fixed.name, mode: input.mode },
        restore_with: input.mode === 'only_this_month' ? 'restore_fixed_charge_month' : null,
        ...(input.mode === 'everywhere' ? { note: 'Deleted in every month; it cannot be restored.' } : {}),
      }
    },
  }),
  tool({
    name: 'restore_fixed_charge_month',
    title: 'Restore a fixed charge’s month',
    description: 'Undo delete_fixed_charge with only_this_month: that month’s charge is back.',
    input: z.object({ id: idField.describe('The fixed charge (definition) id.'), month: fixedMonth.optional() }),
    async run(tc, input) {
      const read = await readFixedCharges(tc, input.month, { fromCurrent: true })
      findFixed(read.list, input.id)
      await createSupabaseRecurringMutations(tc.ctx).restoreInCycle(input.id, read.data.cycle.start)
      return fixedOut(tc, input.id, read.data.cycle.month)
    },
  }),
]
