// The closed list of tool error codes and how a thrown error becomes one (`mcp-server` → *Tool
// results and errors*, add-mcp-server D7). Pure: the real message of an unknown error stays in
// the log, the assistant only sees `failed`.

export const TOOL_ERROR_CODES = [
  'invalid-input',
  'not-found',
  'duplicate-name',
  'out-of-range',
  'category-not-alive',
  'fixed-row',
  'payment-methods-not-offered',
  'account-not-ready',
  'failed',
] as const

export type ToolErrorCode = (typeof TOOL_ERROR_CODES)[number]

export type ToolError = { code: ToolErrorCode; message: string }

/** A refusal a tool raises itself, with its code and a one-line English message. */
export class McpToolError extends Error {
  readonly code: ToolErrorCode
  constructor(code: ToolErrorCode, message: string) {
    super(message)
    this.name = 'McpToolError'
    this.code = code
  }
}

// = DUPLICATE_CATEGORY_NAME and DUPLICATE_CARD_NAME in lib/data (kept literal so this stays pure).
const DUPLICATE_NAMES = ['duplicate-category-name', 'duplicate-card-name']

function firstZodIssue(error: unknown): string | null {
  if (!(error instanceof Error) || error.name !== 'ZodError') return null
  const issues = (error as Error & { issues?: { path?: PropertyKey[]; message?: string }[] }).issues
  const issue = issues?.[0]
  if (!issue) return 'Invalid input.'
  const path = (issue.path ?? []).map(String).join('.')
  return path ? `${path}: ${issue.message}` : (issue.message ?? 'Invalid input.')
}

export function toToolError(error: unknown): ToolError {
  if (error instanceof McpToolError) return { code: error.code, message: error.message }
  const zod = firstZodIssue(error)
  if (zod) return { code: 'invalid-input', message: zod }
  const message = error instanceof Error ? error.message : typeof error === 'object' && error ? String((error as { message?: unknown }).message) : ''
  const pgCode = typeof error === 'object' && error ? (error as { code?: unknown }).code : undefined
  if (DUPLICATE_NAMES.includes(message)) return { code: 'duplicate-name', message: 'That name is already used by another one of the account, in any letter case.' }
  if (message === 'not-found' || pgCode === 'PGRST116') return { code: 'not-found', message: 'Nothing with that id in this account.' }
  return { code: 'failed', message: 'Something went wrong on Mango’s side. Before trying a change again, read it back: it may have gone through.' }
}
