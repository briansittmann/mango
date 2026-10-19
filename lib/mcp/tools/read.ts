import { z } from 'zod'
import { readFixedCharges, readMonth } from '../account'
import { movementsOf, summaryOf } from '../shape'
import { tool } from './define'
import { monthField } from './fields'

// The three read tools (`mcp-server` → *Reading the account*): `resumenMensual` once, shaped.

export const readTools = [
  tool({
    name: 'get_summary',
    title: 'Cycle summary',
    description:
      "The cycle's figures as the dashboard shows them: income, expenses, savings (this cycle and accumulated), free margin (what is left after budgets, spending and savings), every category alive in the cycle with its total and budget, the cards with what they carry this cycle, and the cash/card pockets when the account uses them. Read this before answering how the person is doing or before changing a category.",
    input: z.object({ month: monthField.optional() }),
    async run(tc, input) {
      const { data, definitions } = await readMonth(tc, input.month)
      return summaryOf(data, definitions)
    },
  }),
  tool({
    name: 'list_movements',
    title: 'List movements',
    description:
      "Every row the cycle shows, newest first: expenses (with their category), income, savings deposits and withdrawals, and transfers between cash and card. A row of a fixed charge carries `fixed` with its definition id; in a projected cycle those rows have ids `proj:<definition id>` and are not stored yet. Use the ids with update_movement / delete_movement (one-off rows) or the fixed-charge tools (fixed rows).",
    input: z.object({
      month: monthField.optional(),
      kind: z.enum(['expense', 'income', 'savings', 'transfer']).optional().describe('Only rows of this kind.'),
    }),
    async run(tc, input) {
      const { data } = await readMonth(tc, input.month)
      return movementsOf(data, input.kind)
    },
  }),
  tool({
    name: 'list_fixed_charges',
    title: 'List fixed charges',
    description:
      "Every fixed charge (rent, subscriptions, salary…), active and stopped: expected amount, day of the month, category, card, payment method, reminder, instalments done and total, and its row in the month asked (amount, charged or pending, projected, or deleted for this month only).",
    input: z.object({ month: monthField.optional() }),
    async run(tc, input) {
      return (await readFixedCharges(tc, input.month)).list
    },
  }),
]
