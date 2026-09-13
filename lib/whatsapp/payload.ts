/**
 * Traducción del payload de Meta al formato propio. Este archivo y el
 * adaptador son los únicos que conocen la forma de WhatsApp; de acá para
 * adentro nadie más la ve (ARCHITECTURE.md §3).
 */

export type MensajeWhatsApp = {
  /** E.164 con `+`. Meta lo manda sin él. */
  telefono: string
  texto: string
  mensajeId: string
}

export function extraerMensajesDeTexto(payload: unknown): MensajeWhatsApp[] {
  const mensajes: MensajeWhatsApp[] = []
  if (!esObjeto(payload)) return mensajes

  for (const entrada of comoArray(payload.entry)) {
    if (!esObjeto(entrada)) continue

    for (const cambio of comoArray(entrada.changes)) {
      if (!esObjeto(cambio) || !esObjeto(cambio.value)) continue

      // Los avisos de estado (enviado, entregado, leído) vienen en `statuses`,
      // no en `messages`: al leer solo `messages` quedan ignorados.
      for (const mensaje of comoArray(cambio.value.messages)) {
        const extraido = extraerMensaje(mensaje)
        if (extraido) mensajes.push(extraido)
      }
    }
  }

  return mensajes
}

function extraerMensaje(mensaje: unknown): MensajeWhatsApp | null {
  if (!esObjeto(mensaje)) return null

  // Por ahora solo texto. Imágenes, audios y reacciones entrantes se descartan
  // hasta que haya algo que hacer con ellas.
  if (mensaje.type !== 'text') return null

  const { id, from } = mensaje
  const texto = esObjeto(mensaje.text) ? mensaje.text.body : undefined

  if (typeof id !== 'string' || typeof from !== 'string' || typeof texto !== 'string') {
    return null
  }

  return { telefono: aE164(from), texto, mensajeId: id }
}

/**
 * Meta manda el número sin `+` (`353871234567`); en `usuarios` vive en E.164
 * con `+`, que es como lo valida el constraint de la tabla.
 *
 * TODO: ojo con Argentina — el `wa_id` de Meta a veces viene sin el 9 de los
 * móviles (`54...` en vez de `549...`), así que un número cargado con el 9 no
 * matchearía. Resolver cuando se dé de alta el primer usuario argentino.
 */
function aE164(numero: string): string {
  return `+${numero.replace(/\D/g, '')}`
}

function esObjeto(valor: unknown): valor is Record<string, unknown> {
  return typeof valor === 'object' && valor !== null
}

function comoArray(valor: unknown): unknown[] {
  return Array.isArray(valor) ? valor : []
}
