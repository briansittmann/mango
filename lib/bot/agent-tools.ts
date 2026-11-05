import { z } from 'zod'

import { callTool } from '@/lib/mcp/envelope'
import { MCP_INSTRUCTIONS } from '@/lib/mcp/instructions'
import { readTools } from '@/lib/mcp/tools/read'
import type { ToolContext } from '@/lib/mcp/context'
import type { DataContext } from '@/lib/data/supabase/context'
import type { Usuario } from '@/lib/data/supabase/user'
import type { Channel } from '@/lib/data/users'
import { SITE_URL } from '@/lib/metadata'
import { buildAgentPrompt, type AgentTool } from './agent'
import { formatBotAmount, type BotFormat } from './format'

/**
 * The MCP's read tools as the agent's tools (`add-bot-agent-mode` D3): the same `readTools`, run
 * through the same envelope (`invalid-input` for a bad argument, one log line without content),
 * on a `ToolContext` built from the bot's turn. The admin client has no RLS: the three reads filter
 * by the account's id themselves, as `resumenMensual` always did for the bot. Nothing writes.
 */
export function agentToolsFor(data: DataContext, usuario: Usuario, channel: Channel): AgentTool[] {
  const context = async (): Promise<ToolContext> => ({ ctx: data, usuario })
  return readTools.map((tool) => ({
    name: tool.name,
    description: tool.description,
    parameters: parametersOf(tool.input),
    run: async (args) =>
      (await callTool(tool, args, { context, userIdOf: (tc) => tc.usuario.id, clientId: channel, log: (line) => console.info(line) })).structuredContent,
  }))
}

/** The tool's zod schema as JSON Schema for `parametersJsonSchema`, without the `$schema` key. */
function parametersOf(input: unknown): Record<string, unknown> {
  const schema: Record<string, unknown> = { ...z.toJSONSchema(input as z.ZodType) }
  delete schema.$schema
  return schema
}

/** The agent's system prompt for this account: the cycle rules the MCP gives its clients, the amount format and the dashboard link. */
export function agentPromptFor(usuario: Usuario, fmt: BotFormat, categories: string[]): string {
  return buildAgentPrompt({
    locale: usuario.idioma,
    today: fmt.today,
    timezone: usuario.timezone,
    currency: usuario.moneda_default,
    amountExample: `${formatBotAmount(fmt.locale, fmt.currency, 1234.56, fmt.amountFormat)} o ${formatBotAmount(fmt.locale, fmt.currency, 300, fmt.amountFormat)}`,
    categories,
    cycleRules: MCP_INSTRUCTIONS,
    link: `${SITE_URL}/dashboard`,
    mcpUrl: `${SITE_URL}/api/mcp`,
  })
}
