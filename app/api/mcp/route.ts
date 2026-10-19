import { createMcpHandler, withMcpAuth } from 'mcp-handler'
import { verifyToken } from '@/lib/mcp/context'
import { MCP_INSTRUCTIONS, registerTools } from '@/lib/mcp/server'

// The remote MCP server (`mcp-server` → *One remote endpoint*, add-mcp-server D4): Streamable HTTP
// for Claude and ChatGPT, every request with an OAuth access token from Supabase Auth.

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const handler = createMcpHandler((server) => registerTools(server), {
  serverInfo: { name: 'Mango', version: '1.0.0' },
  instructions: MCP_INSTRUCTIONS,
})

const authed = withMcpAuth(handler, verifyToken, {
  required: true,
  resourceMetadataPath: '/.well-known/oauth-protected-resource',
})

export { authed as GET, authed as POST, authed as DELETE }
