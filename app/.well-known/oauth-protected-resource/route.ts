import { getPublicOrigin, metadataCorsOptionsRequestHandler, protectedResourceHandler } from 'mcp-handler'
import { mcpIssuer } from '@/lib/mcp/context'

// RFC 9728 protected resource metadata (`mcp-server` → *Discovery and token check*, D4): the
// resource is `/api/mcp` on the request's public origin, and Supabase Auth its only authorization
// server. Readable cross-origin, for clients that run in a browser.

export const dynamic = 'force-dynamic'

export function GET(req: Request) {
  return protectedResourceHandler({ authServerUrls: [mcpIssuer()], resourceUrl: `${getPublicOrigin(req)}/api/mcp` })(req)
}

export const OPTIONS = metadataCorsOptionsRequestHandler()
