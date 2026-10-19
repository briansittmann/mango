import type { z } from 'zod'
import type { ToolContext } from '../context'
import { CATALOG, type ToolName } from '../catalog'
import type { McpTool } from '../envelope'

/** A tool whose `run` receives its schema's parsed input, typed from the schema; its hints come from the catalogue. */
export function tool<S extends z.ZodType>(definition: {
  name: ToolName
  title: string
  description: string
  input: S
  run(tc: ToolContext, input: z.output<S>): Promise<Record<string, unknown>>
}): McpTool<ToolContext> {
  return { ...definition, annotations: CATALOG[definition.name] } as unknown as McpTool<ToolContext>
}
