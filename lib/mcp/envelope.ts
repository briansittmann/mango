import { toToolError } from './errors.ts'

// One tool and the envelope every call runs in (`mcp-server` → *Tool results and errors*, *Tool
// calls are logged without content*, add-mcp-server D5, D7). Pure: the context and the log are
// injected, so the route passes the real ones and the tests fakes.

/** All four hints on every tool: ChatGPT lists three of them as required (D8). */
export type ToolHints = {
  readOnlyHint: boolean
  destructiveHint: boolean
  idempotentHint: boolean
  openWorldHint: false
}

/** The zod-like schema a tool parses its arguments with (`safeParse` of zod 4). */
export type InputSchema<T> = {
  safeParse(value: unknown): { success: true; data: T } | { success: false; error: unknown }
}

export type McpTool<Ctx, T = unknown> = {
  name: string
  title: string
  description: string
  input: InputSchema<T>
  annotations: ToolHints
  run(context: Ctx, input: T): Promise<Record<string, unknown>>
}

export type CallResult = {
  structuredContent: Record<string, unknown>
  content: { type: 'text'; text: string }[]
  isError?: true
}

export type CallDeps<Ctx> = {
  context(): Promise<Ctx>
  /** The `usuarios` id the call ran for, once known; only its first eight characters are logged. */
  userIdOf(context: Ctx): string
  clientId: string | undefined
  log(line: string): void
  now?(): number
}

/**
 * Runs one tool: parse the arguments with its own schema (so a bad input is `invalid-input`, not
 * the SDK's bare text), build the context, run it, and wrap the result or the error. One log line
 * per call, with names and ids only.
 */
export async function callTool<Ctx, T>(tool: McpTool<Ctx, T>, args: unknown, deps: CallDeps<Ctx>): Promise<CallResult> {
  const now = deps.now ?? Date.now
  const started = now()
  let user = '-'
  let outcome = 'ok'
  try {
    const parsed = tool.input.safeParse(args ?? {})
    if (!parsed.success) throw parsed.error
    const context = await deps.context()
    user = deps.userIdOf(context).slice(0, 8)
    const result = await tool.run(context, parsed.data)
    return { structuredContent: result, content: [{ type: 'text', text: JSON.stringify(result) }] }
  } catch (error) {
    const toolError = toToolError(error)
    outcome = toolError.code
    if (toolError.code === 'failed') console.error(`mcp tool=${tool.name} failed:`, error instanceof Error ? error : JSON.stringify(error))
    return { isError: true, structuredContent: { ...toolError }, content: [{ type: 'text', text: JSON.stringify(toolError) }] }
  } finally {
    deps.log(`mcp tool=${tool.name} client=${deps.clientId ?? '-'} user=${user} result=${outcome} ms=${Math.round(now() - started)}`)
  }
}
