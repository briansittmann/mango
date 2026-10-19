import { PROJECTION_HORIZON, shiftMonth } from '../data/supabase/cycle.ts'
import { McpToolError } from './errors.ts'

// Which cycles a tool may name (`mcp-server` → *Reading the account*, *Fixed charges*,
// add-mcp-server D5). Pure: the caller reads the bounds once and passes them.

export const MONTH_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/

/** The cycle in progress and the account's first one (the cycle of its oldest movement). */
export type MonthBounds = { current: string; first: string }

/** The last month a tool may reach: the sixth cycle after the one in progress, as `/dashboard`. */
export function maxMonthOf(current: string): string {
  return shiftMonth(current, PROJECTION_HORIZON)
}

/**
 * The month to act on: the given one when it is a cycle the account has (or a projected one up to
 * the sixth), the cycle in progress when none is given. `fromCurrent` is the fixed-charge tools'
 * rule: nothing before the cycle in progress.
 */
export function resolveMonth(month: string | undefined, bounds: MonthBounds, { fromCurrent = false } = {}): string {
  if (month == null) return bounds.current
  if (!MONTH_PATTERN.test(month)) throw new McpToolError('invalid-input', 'month must be YYYY-MM.')
  const max = maxMonthOf(bounds.current)
  if (month > max) throw new McpToolError('out-of-range', `The last cycle that can be reached is ${max}.`)
  if (fromCurrent && month < bounds.current) {
    throw new McpToolError('out-of-range', `Fixed charges change from the cycle in progress (${bounds.current}) on; earlier months stay as they were.`)
  }
  const first = bounds.first < bounds.current ? bounds.first : bounds.current
  if (month < first) throw new McpToolError('out-of-range', `The account has no cycle before ${first}.`)
  return month
}

/** Whether a local date falls in a cycle's `[start, end]` (both `YYYY-MM-DD`, inclusive). */
export function dateInCycle(date: string, cycle: { start: string; end: string }): boolean {
  return cycle.start <= date && date <= cycle.end
}
