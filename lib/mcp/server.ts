import 'server-only'

import type { McpServer, StandardSchemaWithJSON } from '@modelcontextprotocol/server'
import { toolContext, type ToolContext } from './context'
import { callTool, type McpTool } from './envelope'
import { TOOLS } from './tools'

/** What the assistant reads about Mango once, at `initialize` (`mcp-server` → *One remote endpoint*). */
export const MCP_INSTRUCTIONS = [
  "Mango is a personal finance app. These tools read and change the signed-in person's own account, nothing else.",
  "Money is organised in cycles: a cycle runs from the account's start day to the day before it next month, and is named by the month it ends in (YYYY-MM). Without a month, a tool acts on the cycle in progress; up to six later cycles are projections built from the fixed charges.",
  'Amounts are plain numbers in the currency each result names. Dates are YYYY-MM-DD in the account\'s timezone.',
  'Deleting a single movement can be undone with restore_movement. Changing anything that repeats (a fixed charge, a budget or a category in a later cycle) asks for a scope: only_this_month or from_this_month. Ask the person which one they mean when they did not say.',
  'Before a delete or an update, read the item first and confirm with the person when it is not obvious which one they mean.',
].join('\n')

/**
 * The SDK validates the arguments with the registered schema before the callback, and a failure
 * there is a bare text error. Each tool parses its own input inside the envelope instead, so the
 * listing keeps the real JSON Schema and a bad input is `invalid-input` like every other error.
 */
function listedAs(schema: StandardSchemaWithJSON): StandardSchemaWithJSON {
  const standard = schema['~standard']
  return {
    '~standard': { version: 1, vendor: 'mango', validate: (value: unknown) => ({ value }), jsonSchema: standard.jsonSchema },
  }
}

function log(line: string) {
  console.info(line)
}

export function registerTools(server: McpServer, tools: McpTool<ToolContext>[] = TOOLS) {
  for (const tool of tools) {
    server.registerTool(
      tool.name,
      {
        title: tool.title,
        description: tool.description,
        inputSchema: listedAs(tool.input as unknown as StandardSchemaWithJSON),
        annotations: { title: tool.title, ...tool.annotations },
      },
      (args, ctx) =>
        callTool(tool, args, {
          context: () => toolContext(ctx.http?.authInfo),
          userIdOf: (context) => context.usuario.id,
          clientId: ctx.http?.authInfo?.clientId,
          log,
        }),
    )
  }
}
