import { after, type NextRequest } from 'next/server'

import { manejarMensajes } from '@/lib/whatsapp/adaptador'
import { comparacionSegura, firmaValida } from '@/lib/whatsapp/firma'
import { extraerMensajesDeTexto } from '@/lib/whatsapp/payload'

/**
 * Webhook de WhatsApp Cloud API.
 *
 * Adaptador fino (ARCHITECTURE.md §3): valida, traduce el payload de Meta al
 * formato interno y delega. Ninguna regla de negocio vive en este archivo.
 */

/**
 * Handshake de alta del webhook: Meta pega un GET con `hub.challenge` y hay que
 * devolverlo tal cual, pero solo si el `hub.verify_token` coincide (§10).
 */
export async function GET(request: NextRequest) {
  const verifyToken = process.env.WHATSAPP_VERIFY_TOKEN
  if (!verifyToken) {
    console.error('[whatsapp] falta WHATSAPP_VERIFY_TOKEN')
    return new Response('Server misconfigured', { status: 500 })
  }

  const params = request.nextUrl.searchParams
  const modo = params.get('hub.mode')
  const token = params.get('hub.verify_token')
  const challenge = params.get('hub.challenge')

  if (modo !== 'subscribe' || !token || !challenge || !comparacionSegura(token, verifyToken)) {
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
    console.error('[whatsapp] falta WHATSAPP_APP_SECRET')
    return new Response('Server misconfigured', { status: 500 })
  }

  // El cuerpo crudo, antes de cualquier parseo: la firma se calcula sobre estos
  // bytes exactos, y parsear y volver a serializar los cambia.
  const cuerpoCrudo = Buffer.from(await request.arrayBuffer())

  if (!firmaValida(cuerpoCrudo, request.headers.get('x-hub-signature-256'), appSecret)) {
    console.warn('[whatsapp] firma inválida, payload descartado')
    return new Response('Unauthorized', { status: 401 })
  }

  let payload: unknown
  try {
    payload = JSON.parse(cuerpoCrudo.toString('utf8'))
  } catch {
    return new Response('Bad Request', { status: 400 })
  }

  const mensajes = extraerMensajesDeTexto(payload)

  // Meta reintenta si la respuesta tarda o falla, y cada reintento es un
  // duplicado en potencia (§11). Se contesta 200 ya y el trabajo real —base,
  // parser, envío— corre después, con `after`, una vez que la respuesta salió.
  if (mensajes.length > 0) {
    after(() => manejarMensajes(mensajes))
  }

  return new Response(null, { status: 200 })
}
