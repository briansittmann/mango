import { McpToolError } from './errors.ts'
import type { MovementKind } from './map.ts'

// Which contract an id given to a one-off movement tool goes to (add-mcp-server D5). Pure: the
// tool reads the row through RLS, so another account's id arrives here as no row at all.

export type RowLookup = { tipo: 'gasto' | 'ingreso' | 'ahorro' | 'transferencia'; movimiento_recurrente_id: string | null } | null

const KIND = { gasto: 'expense', ingreso: 'income', ahorro: 'savings', transferencia: 'transfer' } as const

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** Whether an id can name a stored row at all; anything else is answered as not found without a query. */
export function isRowId(id: string): boolean {
  return UUID.test(id)
}

/** A fixed charge's row is changed with the fixed-charge tool the refusal names. */
export function classifyRow(id: string, row: RowLookup, action: 'update' | 'delete' | 'restore'): MovementKind {
  const fixedTool = action === 'update' ? 'update_fixed_charge' : action === 'delete' ? 'delete_fixed_charge' : 'restore_fixed_charge_month'
  if (id.startsWith('proj:') || row?.movimiento_recurrente_id) {
    throw new McpToolError('fixed-row', `That row belongs to a fixed charge: use ${fixedTool} with its definition id and month.`)
  }
  if (!row) throw new McpToolError('not-found', 'No movement with that id in this account.')
  return KIND[row.tipo]
}
