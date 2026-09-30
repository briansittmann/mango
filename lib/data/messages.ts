import { supabaseAdmin } from '@/lib/supabase/admin'

import type { Channel } from './users'

/** How many stored messages the parser sees, and how far back (`bot-conversation-history`). */
export const HISTORY_LIMIT = 20
export const HISTORY_WINDOW_MS = 24 * 60 * 60_000
/** Messages older than this are deleted by the daily cron. */
export const RETENTION_DAYS = 30

export type StoredMessage = { direction: 'entrante' | 'saliente'; text: string }

/**
 * The VIP account's last `HISTORY_LIMIT` messages from the last `HISTORY_WINDOW_MS`, on any
 * channel, oldest first (design D8). `mensajes` has RLS with no policies: admin client only.
 */
export async function recentMessages(userId: string): Promise<StoredMessage[]> {
  const { data, error } = await supabaseAdmin()
    .from('mensajes')
    .select('direccion, texto')
    .eq('usuario_id', userId)
    .gte('creado_en', new Date(Date.now() - HISTORY_WINDOW_MS).toISOString())
    .order('creado_en', { ascending: false })
    .limit(HISTORY_LIMIT)

  if (error) throw error
  return (data as { direccion: StoredMessage['direction']; texto: string }[])
    .reverse()
    .map((row) => ({ direction: row.direccion, text: row.texto }))
}

/**
 * Stores one turn of a VIP account: the incoming message (skipped when a retry already stored it)
 * and then the bot's reply. `transactionId` is the row the message loaded, if any.
 */
export async function storeExchange({
  userId,
  channel,
  externalId,
  incoming,
  outgoing,
  transactionId,
}: {
  userId: string
  channel: Channel
  externalId: string
  incoming: string
  outgoing: string | null
  transactionId: string | null
}): Promise<void> {
  const client = supabaseAdmin()
  // The unique index on incoming ids is partial, which PostgREST's `on_conflict` can't target:
  // a unique violation is the retry, the same as `on conflict do nothing`.
  const received = await client.from('mensajes').insert({
    usuario_id: userId,
    canal: channel,
    direccion: 'entrante',
    texto: incoming,
    mensaje_id_externo: externalId,
    transaccion_id: transactionId,
  })
  if (received.error?.code === '23505') return
  if (received.error) throw received.error
  if (outgoing === null) return

  const sent = await client
    .from('mensajes')
    .insert({ usuario_id: userId, canal: channel, direccion: 'saliente', texto: outgoing })
  if (sent.error) throw sent.error
}

/** Deletes every account's messages older than `RETENTION_DAYS`; returns how many. */
export async function purgeOldMessages(): Promise<number> {
  const { count, error } = await supabaseAdmin()
    .from('mensajes')
    .delete({ count: 'exact' })
    .lt('creado_en', new Date(Date.now() - RETENTION_DAYS * 24 * 60 * 60_000).toISOString())

  if (error) throw error
  return count ?? 0
}
