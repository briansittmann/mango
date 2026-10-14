import { supabaseAdmin } from '@/lib/supabase/admin'

export type Channel = 'whatsapp' | 'telegram'

/**
 * Resolves the phone number against linked `whatsapp` channels (ARCHITECTURE.md §3, step 2 of
 * the onboarding flow), not against `usuarios.telefono`: a phone stored on the account but not
 * linked as a channel is treated as unknown (`separate-identity-from-channel`). Returns `null`
 * if no channel matches: the account is created on the web and the number is linked from it (§4).
 */
export async function findUserIdByPhone(phone: string): Promise<string | null> {
  const { data, error } = await supabaseAdmin()
    .from('canales')
    .select('usuario_id')
    .eq('tipo', 'whatsapp')
    .eq('identificador_externo', phone)
    .maybeSingle()

  if (error) throw error
  return data?.usuario_id ?? null
}

export type ConfirmationState = {
  cargas_confirmadas: number
  /** Loads confirmed on `cargas_dia_fecha`, a local date in `timezone` (0034). */
  cargas_dia: number
  cargas_dia_fecha: string | null
  modo_confirmacion: 'auto' | 'texto' | 'reaccion'
  idioma: 'es' | 'en'
  timezone: string
}

/** What the adapter needs to confirm a load (progressive confirmation, `add-bot-conversation` D6). */
export async function readConfirmationState(userId: string): Promise<ConfirmationState> {
  const { data, error } = await supabaseAdmin()
    .from('usuarios')
    .select('cargas_confirmadas, cargas_dia, cargas_dia_fecha, modo_confirmacion, idioma, timezone')
    .eq('id', userId)
    .single<ConfirmationState>()

  if (error) throw error
  return data
}

/**
 * Stores the account's count of confirmed loads, in total and on `day`. A read-then-write: one
 * account's messages are handled one at a time, and a lost increment only means one extra text
 * confirmation (D6).
 */
export async function setConfirmedLoads(userId: string, count: number, dayCount: number, day: string): Promise<void> {
  const { error } = await supabaseAdmin()
    .from('usuarios')
    .update({ cargas_confirmadas: count, cargas_dia: dayCount, cargas_dia_fecha: day })
    .eq('id', userId)
  if (error) throw error
}
