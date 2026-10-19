import { z } from 'zod'
import type { CategoryColor } from '@/lib/data/dashboard'
import { createSupabaseCardMutations, readCards } from '@/lib/data/supabase/cards'
import type { ToolContext } from '../context'
import { McpToolError } from '../errors'
import { tool } from './define'
import { colorField, idField } from './fields'

// Cards (`mcp-server` → *Cards*): `CardMutations`, the checklist saved whole with `setFixedCharges`.

const nameField = z.string().trim().min(1).max(30).describe('The card’s name (1–30 characters), never a number or anything sensitive.')
const fixedIdsField = z
  .array(idField)
  .describe('The complete list of fixed expense ids (list_fixed_charges) the card carries afterwards; each one moves from whatever card it had.')

type DefinitionRow = { id: string; nombre: string; tipo: string; activo: boolean; tarjeta_id: string | null }

async function activeExpenses({ ctx }: ToolContext): Promise<DefinitionRow[]> {
  const { data, error } = await ctx.client
    .from('movimientos_recurrentes')
    .select('id, nombre, tipo, activo, tarjeta_id')
    .eq('usuario_id', ctx.usuarioId)
    .eq('tipo', 'gasto')
    .eq('activo', true)
  if (error) throw error
  return (data ?? []) as DefinitionRow[]
}

/** Every id must be an active fixed expense of the account, or nothing is applied. */
async function checkFixedIds(tc: ToolContext, ids: string[] | undefined) {
  if (!ids) return
  const known = new Set((await activeExpenses(tc)).map((d) => d.id))
  const unknown = ids.filter((id) => !known.has(id))
  if (unknown.length) throw new McpToolError('not-found', `Not an active fixed expense of this account: ${unknown.join(', ')}. Nothing was changed.`)
}

async function cardOut(tc: ToolContext, id: string) {
  const card = (await readCards(tc.ctx)).find((c) => c.id === id)
  if (!card) throw new McpToolError('not-found', 'No card with that id in this account.')
  const carried = (await activeExpenses(tc)).filter((d) => d.tarjeta_id === id).map((d) => ({ id: d.id, name: d.nombre }))
  return { card: { ...card, fixed_charges: carried } }
}

export const cardTools = [
  tool({
    name: 'create_card',
    title: 'Create a card',
    description: 'Create a card the person pays fixed charges with: a name and a colour, optionally with the fixed expenses it carries.',
    input: z.object({ name: nameField, color: colorField, fixed_charge_ids: fixedIdsField.optional() }),
    async run(tc, input) {
      await checkFixedIds(tc, input.fixed_charge_ids)
      const cards = createSupabaseCardMutations(tc.ctx)
      const id = await cards.create({ name: input.name, color: input.color as CategoryColor })
      if (input.fixed_charge_ids?.length) await cards.setFixedCharges(id, input.fixed_charge_ids)
      return cardOut(tc, id)
    },
  }),
  tool({
    name: 'update_card',
    title: 'Change a card',
    description: 'Change a card’s name, colour, or the complete list of fixed expenses it carries.',
    input: z.object({ id: idField.describe('The card id from get_summary.'), name: nameField.optional(), color: colorField.optional(), fixed_charge_ids: fixedIdsField.optional() }),
    async run(tc, input) {
      const current = (await readCards(tc.ctx)).find((c) => c.id === input.id)
      if (!current) throw new McpToolError('not-found', 'No card with that id in this account.')
      if (input.name === undefined && input.color === undefined && input.fixed_charge_ids === undefined) {
        throw new McpToolError('invalid-input', 'Give at least one field to change.')
      }
      await checkFixedIds(tc, input.fixed_charge_ids)
      const cards = createSupabaseCardMutations(tc.ctx)
      if (input.name !== undefined || input.color !== undefined) {
        await cards.update(input.id, { name: input.name ?? current.name, color: (input.color as CategoryColor | undefined) ?? current.color })
      }
      if (input.fixed_charge_ids) await cards.setFixedCharges(input.id, input.fixed_charge_ids)
      return cardOut(tc, input.id)
    },
  }),
  tool({
    name: 'delete_card',
    title: 'Delete a card',
    description: 'Delete a card. The fixed charges it carried stay, with no card; nothing else changes. There is no restore tool.',
    input: z.object({ id: idField.describe('The card id from get_summary.') }),
    async run(tc, input) {
      const { card } = await cardOut(tc, input.id)
      await createSupabaseCardMutations(tc.ctx).delete(input.id)
      return { deleted: { id: card.id, name: card.name }, left_without_card: card.fixed_charges }
    },
  }),
]
