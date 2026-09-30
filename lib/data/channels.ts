import { supabaseAdmin } from '@/lib/supabase/admin'

import type { PendingQuestion } from '@/lib/bot/parser'
import type { Channel } from './users'

/** How long a pending question waits for its answer (design D7). */
export const PENDING_QUESTION_TTL_MS = 30 * 60_000

export type ChannelState = { pending: PendingQuestion | null; lastLoadId: string | null }

/**
 * The channel's pending question (`canales.pregunta_pendiente`, 0023; null when there is none or
 * it expired) and its last load (`canales.ultima_carga_id`, 0028), in one select. A Vercel
 * function keeps nothing between two webhook calls, so both live on the channel row. A question
 * stored before 0028 has no `pregunta` and is a category question (design D5).
 */
export async function readChannelState(channel: Channel, externalId: string): Promise<ChannelState> {
  const { data, error } = await supabaseAdmin()
    .from('canales')
    .select('pregunta_pendiente, pregunta_vence_en, ultima_carga_id')
    .eq('tipo', channel)
    .eq('identificador_externo', externalId)
    .maybeSingle<{
      pregunta_pendiente: (PendingQuestion | Omit<Extract<PendingQuestion, { pregunta: 'categoria' }>, 'pregunta'>) | null
      pregunta_vence_en: string | null
      ultima_carga_id: string | null
    }>()

  if (error) throw error
  const lastLoadId = data?.ultima_carga_id ?? null
  const stored = data?.pregunta_pendiente
  if (!stored || !data.pregunta_vence_en || new Date(data.pregunta_vence_en).getTime() <= Date.now()) {
    return { pending: null, lastLoadId }
  }
  return { pending: 'pregunta' in stored ? stored : { pregunta: 'categoria', ...stored }, lastLoadId }
}

/** Remembers `id` as the channel's last load, or none with null (`messaging-channels`). */
export async function setLastLoad(channel: Channel, externalId: string, id: string | null): Promise<void> {
  await updateChannel(channel, externalId, { ultima_carga_id: id })
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
