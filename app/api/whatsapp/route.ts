import { after, type NextRequest } from 'next/server'

import { handleMessages } from '@/lib/whatsapp/adapter'
import { safeCompare, isValidSignature } from '@/lib/whatsapp/signature'
import { extractTextMessages } from '@/lib/whatsapp/payload'

/**
 * WhatsApp Cloud API webhook.
 *
 * Thin adapter (ARCHITECTURE.md §3): validates, translates Meta's payload to
 * the internal format and delegates. No business rule lives in this file.
 */

/**
 * Webhook registration handshake: Meta hits a GET with `hub.challenge` and it
 * has to be echoed back as-is, but only if `hub.verify_token` matches (§10).
 */
export async function GET(request: NextRequest) {
  const verifyToken = process.env.WHATSAPP_VERIFY_TOKEN
  if (!verifyToken) {
    console.error('[whatsapp] missing WHATSAPP_VERIFY_TOKEN')
    return new Response('Server misconfigured', { status: 500 })
  }

  const params = request.nextUrl.searchParams
  const mode = params.get('hub.mode')
  const token = params.get('hub.verify_token')
  const challenge = params.get('hub.challenge')

  if (mode !== 'subscribe' || !token || !challenge || !safeCompare(token, verifyToken)) {
    return new Response('Forbidden', { status: 403 })
  }

  return new Response(challenge, {
    status: 200,
    headers: { 'content-type': 'text/plain' },
  })
}

export async function POST(request: NextRequest) {
  const appSecret = process.env.WHATSAPP_APP_SECRET
  if (!appSecret) {
    console.error('[whatsapp] missing WHATSAPP_APP_SECRET')
    return new Response('Server misconfigured', { status: 500 })
  }

  // The raw body, before any parsing: the signature is computed over these
  // exact bytes, and parsing and re-serializing changes them.
  const rawBody = Buffer.from(await request.arrayBuffer())

  if (!isValidSignature(rawBody, request.headers.get('x-hub-signature-256'), appSecret)) {
    console.warn('[whatsapp] invalid signature, payload discarded')
    return new Response('Unauthorized', { status: 401 })
  }

  let payload: unknown
  try {
    payload = JSON.parse(rawBody.toString('utf8'))
  } catch {
    return new Response('Bad Request', { status: 400 })
  }

  const messages = extractTextMessages(payload)

  // Meta retries if the response is slow or fails, and every retry is a
  // potential duplicate (§11). It answers 200 right away and the real work —
  // database, parser, send — runs after, with `after`, once the response is out.
  if (messages.length > 0) {
    after(() => handleMessages(messages))
  }

  return new Response(null, { status: 200 })
}
