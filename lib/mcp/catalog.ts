import type { ToolHints } from './envelope.ts'
import { CREATE, OVERWRITE, READ, SAFE_REPEAT, UPDATE } from './hints.ts'

// The nineteen tools and their hints (`mcp-server` → *Annotated tools*, add-mcp-server D8): the
// one place `tool()` reads annotations from, so the unit test checks what the server lists.

export const CATALOG = {
  get_summary: READ,
  list_movements: READ,
  list_fixed_charges: READ,
  add_movement: CREATE,
  update_movement: UPDATE,
  delete_movement: OVERWRITE,
  restore_movement: SAFE_REPEAT,
  create_category: CREATE,
  update_category: UPDATE,
  delete_category: OVERWRITE,
  reorder_categories: OVERWRITE,
  create_fixed_charge: CREATE,
  update_fixed_charge: UPDATE,
  set_fixed_charged: SAFE_REPEAT,
  delete_fixed_charge: OVERWRITE,
  restore_fixed_charge_month: SAFE_REPEAT,
  create_card: CREATE,
  update_card: OVERWRITE,
  delete_card: OVERWRITE,
} satisfies Record<string, ToolHints>

export type ToolName = keyof typeof CATALOG
