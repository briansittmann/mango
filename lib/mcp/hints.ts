import type { ToolHints } from './envelope.ts'

// The four hints by kind of tool (`mcp-server` → *Annotated tools*, add-mcp-server D8). Both
// clients ask before a destructive call; `openWorldHint` is false everywhere.

export const READ: ToolHints = { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false }
export const CREATE: ToolHints = { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false }
/** Restoring and marking charged: nothing is lost, and twice is the same as once. */
export const SAFE_REPEAT: ToolHints = { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false }
export const UPDATE: ToolHints = { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: false }
/** Deletes, a reorder and a card update: they overwrite, and twice is the same as once. */
export const OVERWRITE: ToolHints = { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: false }
