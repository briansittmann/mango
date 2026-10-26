import { supabaseAdmin } from '@/lib/supabase/admin'

import type { Channel } from './users'

/** Events older than this are deleted by the daily cron. */
export const EVENT_RETENTION_DAYS = 90

/**
 * One message the bot logic handled, without its content (`0048`): what it ended in, whether it
 * was a voice note and how long it took. `eventos_bot` has RLS with no policies: admin client only.
 */
export async function recordBotEvent({
  userId,
  channel,
  outcome,
  voice,
  ms,
}: {
  userId: string
  channel: Channel
  outcome: string
  voice: boolean
  ms: number
}): Promise<void> {
  const { error } = await supabaseAdmin()
    .from('eventos_bot')
    .insert({ usuario_id: userId, canal: channel, resultado: outcome, voz: voice, ms: Math.round(ms) })
  if (error) throw error
}

/** Deletes events past `EVENT_RETENTION_DAYS`; returns how many. */
export async function purgeBotEvents(): Promise<number> {
  const { count, error } = await supabaseAdmin()
    .from('eventos_bot')
    .delete({ count: 'exact' })
    .lt('creado_en', new Date(Date.now() - EVENT_RETENTION_DAYS * 24 * 60 * 60_000).toISOString())

  if (error) throw error
  return count ?? 0
}
