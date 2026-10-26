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

// A GET opens a stream for server messages that this stateless server never sends: it held the
// function until Vercel's 300 s cut, once per client every five minutes (26/10 logs). The
// transport lets a server without that stream answer 405, and clients go on over POST.
function noStream() {
  return new Response(null, { status: 405, headers: { Allow: 'POST, DELETE' } })
}

export { noStream as GET, authed as POST, authed as DELETE }
