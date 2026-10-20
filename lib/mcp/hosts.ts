// What the consent page can say about the host an assistant returns to (`mcp-server` → *The
// consent page warns about unknown assistants*, harden-security D5). Pure: any client registers
// under any name, so the redirect's host is the one thing the page can trust.

export type HostKind = 'known' | 'local' | 'unknown'

const KNOWN_DOMAINS = ['claude.ai', 'chatgpt.com']
const LOCAL_HOSTS = ['localhost', '127.0.0.1', '[::1]']

/** `known` for claude.ai, chatgpt.com and their subdomains, `local` for this computer, `unknown` for the rest. `host` may carry a port. */
export function hostKind(host: string): HostKind {
  const name = host.toLowerCase().replace(/:\d+$/, '')
  if (LOCAL_HOSTS.includes(name)) return 'local'
  if (KNOWN_DOMAINS.some((domain) => name === domain || name.endsWith(`.${domain}`))) return 'known'
  return 'unknown'
}
