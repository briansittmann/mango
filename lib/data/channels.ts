import { supabaseAdmin } from '@/lib/supabase/admin'

import type { PendingQuestion } from '@/lib/bot/parser'
import type { Channel } from './users'

/** How long a pending category question waits for its answer (design D7). */
export const PENDING_QUESTION_TTL_MS = 30 * 60_000

/**
 * The channel's pending question (`canales.pregunta_pendiente`, 0023), or null when there is none
 * or it expired. A Vercel function keeps nothing between two webhook calls, so the question lives
 * on the channel row.
 */
export async function readPendingQuestion(channel: Channel, externalId: string): Promise<PendingQuestion | null> {
  const { data, error } = await supabaseAdmin()
    .from('canales')
    .select('pregunta_pendiente, pregunta_vence_en')
    .eq('tipo', channel)
    .eq('identificador_externo', externalId)
    .maybeSingle<{ pregunta_pendiente: PendingQuestion | null; pregunta_vence_en: string | null }>()

  if (error) throw error
  if (!data?.pregunta_pendiente || !data.pregunta_vence_en) return null
  if (new Date(data.pregunta_vence_en).getTime() <= Date.now()) return null
  return data.pregunta_pendiente
}

/** Writes (or replaces) the channel's question, expiring `ttlMs` from now. */
export async function writePendingQuestion(
  channel: Channel,
  externalId: string,
  question: PendingQuestion,
  ttlMs: number = PENDING_QUESTION_TTL_MS,
): Promise<void> {
  await updateChannel(channel, externalId, {
    pregunta_pendiente: question,
    pregunta_vence_en: new Date(Date.now() + ttlMs).toISOString(),
  })
}

export async function clearPendingQuestion(channel: Channel, externalId: string): Promise<void> {
  await updateChannel(channel, externalId, { pregunta_pendiente: null, pregunta_vence_en: null })
}

async function updateChannel(channel: Channel, externalId: string, values: Record<string, unknown>): Promise<void> {
  const { error } = await supabaseAdmin()
    .from('canales')
    .update(values)
    .eq('tipo', channel)
    .eq('identificador_externo', externalId)

  if (error) throw error
}
