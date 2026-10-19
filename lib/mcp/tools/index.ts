import type { ToolContext } from '../context'
import type { McpTool } from '../envelope'
import { cardTools } from './cards'
import { categoryTools } from './categories'
import { fixedTools } from './fixed'
import { movementTools } from './movements'
import { readTools } from './read'

/** Every tool the MCP server lists, in the order clients show them (`mcp-server`, add-mcp-server D5). */
export const TOOLS: McpTool<ToolContext>[] = [...readTools, ...movementTools, ...categoryTools, ...fixedTools, ...cardTools]
