import { supabaseAdmin } from '@/lib/supabase/admin'

/**
 * Idempotencia del webhook (ARCHITECTURE.md §3 y §11): si ya hay una
 * transacción con este `wa_message_id`, el mensaje ya se procesó y el reintento
 * de Meta se descarta.
 *
 * **No filtra por `borrado_en` a propósito.** La fila borrada conserva el id
 * justo para que un reintento no la resucite como si fuera una carga nueva (§4).
 */
export async function mensajeYaProcesado(
  usuarioId: string,
  waMessageId: string
): Promise<boolean> {
  const { data, error } = await supabaseAdmin()
    .from('transacciones')
    .select('id')
    .eq('usuario_id', usuarioId)
    .eq('wa_message_id', waMessageId)
    .maybeSingle()

  if (error) throw error
  return data !== null
}
