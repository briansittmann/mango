import { supabaseAdmin } from '@/lib/supabase/admin'

import type { PendingQuestion } from '@/lib/bot/parser'
import type { Channel } from './users'

/** How long a pending question waits for its answer (design D7). */
export const PENDING_QUESTION_TTL_MS = 30 * 60_000

/** Remembered unknown numbers older than this are purged by the daily cron (`whatsapp-linking`). */
export const UNKNOWN_CONTACT_RETENTION_DAYS = 90

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

/** Why `vincular_canal` refused (`whatsapp-linking` → *A linking message that cannot link is answered with its reason*). */
export const LINK_ERRORS = ['codigo-invalido', 'cuenta-ya-vinculada', 'numero-en-otra-cuenta'] as const
export type LinkError = (typeof LINK_ERRORS)[number]
export type LinkResult = { ok: true; userId: string } | { ok: false; error: LinkError }

/**
 * Links `externalId` as the `channel` of the account holding the live `code`, atomically
 * (`vincular_canal`, 0031, design D2): the channel row, the account's phone and the consumed
 * code in one transaction. A refusal comes back as a value; anything else throws.
 */
export async function linkChannel(channel: Channel, code: string, externalId: string): Promise<LinkResult> {
  const { data, error } = await supabaseAdmin().rpc('vincular_canal', { p_tipo: channel, p_codigo: code, p_identificador: externalId })
  if (error) {
    const known = LINK_ERRORS.find((message) => message === error.message)
    if (known) return { ok: false, error: known }
    throw error
  }
  return { ok: true, userId: data as string }
}

/**
 * Remembers a message from a number with no channel (`registrar_contacto_desconocido`, 0031,
 * design D4) and returns whether this call is the one that answers it: true once per number.
 */
export async function registerUnknownContact(channel: Channel, externalId: string): Promise<boolean> {
  const { data, error } = await supabaseAdmin().rpc('registrar_contacto_desconocido', { p_tipo: channel, p_identificador: externalId })
  if (error) throw error
  return data === true
}

/** Deletes the unknown numbers whose last message is older than `UNKNOWN_CONTACT_RETENTION_DAYS`; returns how many. */
export async function purgeUnknownContacts(): Promise<number> {
  const { count, error } = await supabaseAdmin()
    .from('contactos_desconocidos')
    .delete({ count: 'exact' })
    .lt('ultimo_mensaje_en', new Date(Date.now() - UNKNOWN_CONTACT_RETENTION_DAYS * 24 * 60 * 60_000).toISOString())

  if (error) throw error
  return count ?? 0
}
