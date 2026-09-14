/**
 * Lógica del bot. **No sabe nada de WhatsApp** (ARCHITECTURE.md §3): recibe el
 * formato interno y devuelve *qué* contestar. El *cómo* — texto o reacción,
 * según la confirmación progresiva — lo decide el adaptador.
 *
 * Si mañana se agrega Telegram o Signal, este archivo no se toca.
 */

export type MensajeEntrante = {
  usuarioId: string
  texto: string
  mensajeId: string
}

export type RespuestaBot = { tipo: 'texto'; texto: string } | { tipo: 'sin_respuesta' }

export async function procesarMensaje(mensaje: MensajeEntrante): Promise<RespuestaBot> {
  // TODO: parser de Gemini + validación con Zod, carga de la transacción
  // (categoría que no matchea → `otros`, sin repreguntar) y modo asesor (§3, §5).
  // TODO: interceptar al usuario con `onboarding_completo = false` y disparar
  // el wizard antes de parsear nada (§11).
  void mensaje
  return { tipo: 'sin_respuesta' }
}

/**
 * Primer contacto de un número que no está dado de alta. **No se lo ignora en
 * silencio** (§4): se le pide el código de invitación, y los tres errores
 * posibles — no existe, ya fue usado, venció — se distinguen en el mensaje,
 * o la persona no sabe si el problema es el código o su número.
 */
export async function procesarNumeroDesconocido(
  telefono: string,
  texto: string
): Promise<RespuestaBot> {
  // TODO: validar el código contra `invitaciones`, quemarlo (`usada_por` +
  // `usada_en`) y arrancar el onboarding: nombre → país → día de ciclo →
  // gasto de prueba (§4).
  // TODO: rate limiting de intentos por número antes de tocar la base, o se
  // pueden probar códigos por fuerza bruta (§10).
  //
  // Todavía no devuelve el pedido del código porque los textos del bot van en
  // archivos de traducción, no incrustados acá (§2), y esa pieza no está armada.
  void telefono
  void texto
  return { tipo: 'sin_respuesta' }
}
