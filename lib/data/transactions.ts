import { supabaseAdmin } from '@/lib/supabase/admin'

/**
 * Webhook idempotency (ARCHITECTURE.md §3 and §11): if a transaction with
 * this `wa_message_id` already exists, the message was already processed and
 * Meta's retry is discarded.
 *
 * **Does not filter by `borrado_en` on purpose.** The deleted row keeps the id
 * so a retry doesn't resurrect it as if it were a new charge (§4).
 */
export async function messageAlreadyProcessed(
  userId: string,
  waMessageId: string
): Promise<boolean> {
  const { data, error } = await supabaseAdmin()
    .from('transacciones')
    .select('id')
    .eq('usuario_id', userId)
    .eq('wa_message_id', waMessageId)
    .maybeSingle()

  if (error) throw error
  return data !== null
}
