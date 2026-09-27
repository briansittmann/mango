import { supabaseAdmin } from '@/lib/supabase/admin'

import type { Channel } from './users'

/**
 * Webhook idempotency (ARCHITECTURE.md §3 and §11): if a transaction with this `channel` and
 * `externalMessageId` already exists for the user, the message was already processed and the
 * retry is discarded. Per channel (`separate-identity-from-channel`), not global: the same id
 * on a different channel is not a retry.
 *
 * **Does not filter by `borrado_en` on purpose.** The deleted row keeps the id so a retry
 * doesn't resurrect it as if it were a new charge (§4).
 */
export async function messageAlreadyProcessed(
  userId: string,
  channel: Channel,
  externalMessageId: string
): Promise<boolean> {
  const { data, error } = await supabaseAdmin()
    .from('transacciones')
    .select('id')
    .eq('usuario_id', userId)
    .eq('canal', channel)
    .eq('mensaje_id_externo', externalMessageId)
    .maybeSingle()

  if (error) throw error
  return data !== null
}
