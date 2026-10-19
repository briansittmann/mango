import { z } from 'zod'
import type { CategoryColor } from '@/lib/data/dashboard'
import { createSupabaseCategoryMutations } from '@/lib/data/supabase/categories'
import { readMonth } from '../account'
import type { ToolContext } from '../context'
import { McpToolError } from '../errors'
import { defaultColor, reorderedIds, toScope } from '../map'
import { isRowId } from '../rows'
import { round2 } from '../shape'
import { tool } from './define'
import { amountField, colorField, idField, monthField, scopeField } from './fields'

// Categories (`mcp-server` → *Categories*, add-mcp-server D5): `CategoryMutations` with the cycle
// and scope the category sheet passes for the month shown.

const nameField = z.string().trim().min(1).max(40).describe('The category’s name, as the person calls it.')

type CategoryRow = { id: string; nombre: string; color: CategoryColor; desde_ciclo: string | null; hasta_ciclo: string | null; orden: number }

async function allCategories({ ctx }: ToolContext): Promise<CategoryRow[]> {
  const { data, error } = await ctx.client
    .from('categorias')
    .select('id, nombre, color, desde_ciclo, hasta_ciclo, orden')
    .eq('usuario_id', ctx.usuarioId)
    .order('orden')
    .order('nombre')
  if (error) throw error
  return (data ?? []) as CategoryRow[]
}

/** The category in the month's `resumenMensual`: absent means not alive there (or not the account's). */
async function inMonth(tc: ToolContext, id: string, month: string | undefined) {
  const read = await readMonth(tc, month)
  const group = read.data.expenses.groups.find((g) => g.id === id)
  if (!group) {
    const exists = isRowId(id) && (await allCategories(tc)).some((c) => c.id === id)
    if (!exists) throw new McpToolError('not-found', 'No category with that id in this account.')
    throw new McpToolError('category-not-alive', `That category does not exist in the ${read.data.cycle.month} cycle.`)
  }
  return { ...read, group }
}

function categoryOut(tc: ToolContext, row: { id: string; name: string; color: string; budget: number | null; show_progress?: boolean }, month: string) {
  return { currency: tc.ctx.currency, month, category: { ...row, budget: row.budget == null ? null : round2(row.budget) } }
}

export const categoryTools = [
  tool({
    name: 'create_category',
    title: 'Create a category',
    description:
      'Create an expense category from the month given on (default the cycle in progress). scope only_this_month makes it exist in that cycle alone; from_this_month (default) keeps it from then on. The colour defaults to the first one the account does not use. An optional budget is the monthly envelope from that month.',
    input: z.object({
      name: nameField,
      color: colorField.optional(),
      budget: amountField.optional().describe('Monthly budget for the category, from the month given.'),
      month: monthField.optional(),
      scope: scopeField.optional(),
    }),
    async run(tc, input) {
      const { data } = await readMonth(tc, input.month)
      const color = (input.color as CategoryColor | undefined) ?? defaultColor((await allCategories(tc)).map((c) => c.color))
      const id = await createSupabaseCategoryMutations(tc.ctx).create(
        { name: input.name, color, budget: input.budget ?? null },
        data.cycle.start,
        toScope(input.scope ?? 'from_this_month'),
      )
      return categoryOut(tc, { id, name: input.name, color, budget: input.budget ?? null, show_progress: true }, data.cycle.month)
    },
  }),
  tool({
    name: 'update_category',
    title: 'Change a category',
    description:
      'Change a category’s name, colour, budget (a number, or null for none) or whether its card shows the budget bar. A budget in the cycle in progress (or a past month) is written for the cycle in progress, as on the dashboard. In a projected month a budget change needs scope: only_this_month or from_this_month. Name and colour are the same in every month.',
    input: z.object({
      id: idField.describe('The category id from get_summary.'),
      month: monthField.optional(),
      name: nameField.optional(),
      color: colorField.optional(),
      budget: amountField.nullable().optional(),
      show_progress: z.boolean().optional().describe('Whether the category’s card shows its budget bar (the same in every month).'),
      scope: scopeField.optional(),
    }),
    async run(tc, input) {
      const { data, group } = await inMonth(tc, input.id, input.month)
      const changesDraft = input.name !== undefined || input.color !== undefined || input.budget !== undefined
      if (!changesDraft && input.show_progress === undefined) throw new McpToolError('invalid-input', 'Give at least one field to change.')
      const budgetChanges = input.budget !== undefined
      if (data.cycle.projected && budgetChanges && !input.scope) {
        throw new McpToolError('invalid-input', 'A budget change in a projected month needs scope: only_this_month or from_this_month.')
      }
      const budget = budgetChanges ? input.budget! : (group.budget?.amount ?? null)
      const draft = { name: input.name ?? group.name, color: (input.color as CategoryColor | undefined) ?? group.color, budget }
      if (changesDraft) {
        await createSupabaseCategoryMutations(tc.ctx).update(input.id, draft, {
          cycle: data.cycle.start,
          // A projected month without a budget change is a rename: no budget is written.
          scope: data.cycle.projected && budgetChanges ? toScope(input.scope!) : null,
        })
      }
      if (input.show_progress !== undefined) await createSupabaseCategoryMutations(tc.ctx).setProgressVisible(input.id, input.show_progress)
      return categoryOut(tc, { id: input.id, ...draft, show_progress: input.show_progress ?? group.showProgress }, data.cycle.month)
    },
  }),
  tool({
    name: 'delete_category',
    title: 'Delete a category',
    description:
      'Delete a category from the month given. only_this_month hides it in that cycle alone (it is back the next month). from_this_month ends it there (from its first month, it is removed entirely). When the scope reaches expenses or fixed charges, reassign_to names the category they move to; without it the error says how many need one. There is no restore tool.',
    input: z.object({
      id: idField.describe('The category id from get_summary.'),
      scope: scopeField,
      reassign_to: idField.optional().describe('Another category alive in that cycle that receives its expenses and fixed charges.'),
      month: monthField.optional(),
    }),
    async run(tc, input) {
      const { data, definitions, group } = await inMonth(tc, input.id, input.month)
      const rows = group.expenses.length
      const fixed = definitions.filter((d) => d.active && d.categoryId === input.id).length
      const scope = toScope(input.scope)
      // The category sheet's rule (`category-editing` → *Deleting a category*).
      const reaches = scope === 'only' ? rows : rows + group.rowsLater + fixed
      if (reaches > 0 && !input.reassign_to) {
        throw new McpToolError(
          'invalid-input',
          scope === 'only'
            ? `It holds ${rows} expense(s) this month: give reassign_to.`
            : `It reaches ${rows + group.rowsLater} expense(s) from this month on and ${fixed} fixed charge(s): give reassign_to.`,
        )
      }
      const receiver = reaches > 0 ? input.reassign_to! : null
      if (receiver && (receiver === input.id || !data.expenses.groups.some((g) => g.id === receiver))) {
        throw new McpToolError('category-not-alive', 'reassign_to must be another category alive in that cycle.')
      }
      await createSupabaseCategoryMutations(tc.ctx).delete(input.id, receiver, { cycle: data.cycle.start, scope })
      return { month: data.cycle.month, deleted: { id: input.id, name: group.name, scope: input.scope }, moved_to: receiver }
    },
  }),
  tool({
    name: 'reorder_categories',
    title: 'Reorder categories',
    description:
      'Set the order categories are shown in, everywhere: the ids of the categories get_summary lists for the cycle in progress, each once, in the new order. Categories not alive this cycle keep their place.',
    input: z.object({ category_ids: z.array(idField).min(1) }),
    async run(tc, input) {
      const { data } = await readMonth(tc, undefined)
      const shown = data.expenses.groups.map((g) => g.id)
      const given = input.category_ids
      if (new Set(given).size !== given.length || given.length !== shown.length || given.some((id) => !shown.includes(id))) {
        throw new McpToolError('invalid-input', `Give each of the ${shown.length} categories of the cycle in progress exactly once (get_summary lists them).`)
      }
      await createSupabaseCategoryMutations(tc.ctx).reorder(reorderedIds((await allCategories(tc)).map((c) => c.id), given))
      const names = new Map(data.expenses.groups.map((g) => [g.id, g.name]))
      return { order: given.map((id) => ({ id, name: names.get(id)! })) }
    },
  }),
]
