import { z } from 'zod'
import { CATEGORY_COLORS } from '../../data/categories.ts'
import { hasCents } from '../map.ts'

// Input fields several tools share; descriptions are what the assistant reads.

export const monthField = z
  .string()
  .describe('Cycle as YYYY-MM, the month it ends in (as /dashboard?mes= names it). Default: the cycle in progress. Up to six cycles ahead are projections.')

export const dateField = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'must be YYYY-MM-DD')
  .refine((value) => new Date(`${value}T12:00:00Z`).toISOString().slice(0, 10) === value, 'is not a real date')
  .describe("Local date YYYY-MM-DD in the account's timezone.")

/** The largest `numeric(12,2)` holds (`harden-security` D9): above it the insert would fail as `failed`. */
export const MAX_AMOUNT = 9_999_999_999.99

export const amountField = z
  .number()
  .positive()
  .max(MAX_AMOUNT)
  .refine(hasCents, 'at most two decimals')
  .describe("Amount in the account's currency, greater than 0, at most two decimals, at most 9999999999.99.")

export const idField = z.string().min(1)

export const scopeField = z
  .enum(['only_this_month', 'from_this_month'])
  .describe('only_this_month changes the month given alone; from_this_month changes it and every later one. Never an earlier month.')

export const paymentMethodField = z
  .enum(['efectivo', 'tarjeta'])
  .nullable()
  .describe('How it was paid: efectivo (cash), tarjeta (card) or null for none. Only for accounts that use payment methods (get_summary shows pockets).')

export const colorField = z
  .enum(CATEGORY_COLORS as [string, ...string[]])
  .describe('A colour of the palette.')
