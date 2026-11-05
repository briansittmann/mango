import 'server-only'

import type { McpServer, StandardSchemaWithJSON } from '@modelcontextprotocol/server'
import { toolContext, type ToolContext } from './context'
import { callTool, type McpTool } from './envelope'
import { TOOLS } from './tools'

export { MCP_INSTRUCTIONS } from './instructions'

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
