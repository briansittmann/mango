import {
  procesarMensaje,
  procesarNumeroDesconocido,
  type RespuestaBot,
} from '@/lib/bot/logica'
import { mensajeYaProcesado } from '@/lib/datos/transacciones'
import { buscarUsuarioIdPorTelefono } from '@/lib/datos/usuarios'

import type { MensajeWhatsApp } from './payload'

/**
 * Adaptador: resuelve el número contra los usuarios, descarta reintentos y
 * llama a la lógica del bot con el formato interno `{ usuarioId, texto,
 * mensajeId }` (ARCHITECTURE.md §3).
 */
export async function manejarMensajes(mensajes: MensajeWhatsApp[]): Promise<void> {
  for (const mensaje of mensajes) {
    try {
      await manejarMensaje(mensaje)
    } catch (error) {
      // Un mensaje que falla no se lleva puestos a los demás del lote.
      console.error(`[whatsapp] error procesando ${mensaje.mensajeId}:`, error)
    }
  }
}

async function manejarMensaje(mensaje: MensajeWhatsApp): Promise<void> {
  const usuarioId = await buscarUsuarioIdPorTelefono(mensaje.telefono)

  if (!usuarioId) {
    const respuesta = await procesarNumeroDesconocido(mensaje.telefono, mensaje.texto)
    await responder(mensaje.telefono, respuesta)
    return
  }

  if (await mensajeYaProcesado(usuarioId, mensaje.mensajeId)) {
    console.info(`[whatsapp] reintento descartado: ${mensaje.mensajeId}`)
    return
  }

  const respuesta = await procesarMensaje({
    usuarioId,
    texto: mensaje.texto,
    mensajeId: mensaje.mensajeId,
  })

  await responder(mensaje.telefono, respuesta)
}

/**
 * Acá se elige **cómo** contesta el bot: texto con botón Deshacer las primeras
 * 15 cargas, reacción con emoji a partir de la 16 (confirmación progresiva,
 * §3). La lógica del bot no participa de esa decisión.
 */
async function responder(telefono: string, respuesta: RespuestaBot): Promise<void> {
  if (respuesta.tipo === 'sin_respuesta') return

  // TODO: POST a la Cloud API con WHATSAPP_TOKEN y WHATSAPP_PHONE_NUMBER_ID,
  // eligiendo mensaje o reacción según `cargas_confirmadas` y
  // `modo_confirmacion` del usuario (§3).
  console.info(`[whatsapp] respuesta pendiente de envío a ${enmascarar(telefono)}`)
}

/** Solo los últimos 4 dígitos: el número completo no va a los logs. */
function enmascarar(telefono: string): string {
  return `…${telefono.slice(-4)}`
}
