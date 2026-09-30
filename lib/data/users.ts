import { supabaseAdmin } from '@/lib/supabase/admin'

export type Channel = 'whatsapp' | 'telegram'

/**
 * Resolves the phone number against linked `whatsapp` channels (ARCHITECTURE.md §3, step 2 of
 * the onboarding flow), not against `usuarios.telefono`: a phone stored on the account but not
 * linked as a channel is treated as unknown (`separate-identity-from-channel`). Returns `null`
 * if no channel matches: that case is handled by signup via invitation code (§4).
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
  modo_confirmacion: 'auto' | 'texto' | 'reaccion'
  idioma: 'es' | 'en'
}

/** What the adapter needs to confirm a load (progressive confirmation, `add-bot-conversation` D6). */
export async function readConfirmationState(userId: string): Promise<ConfirmationState> {
  const { data, error } = await supabaseAdmin()
    .from('usuarios')
    .select('cargas_confirmadas, modo_confirmacion, idioma')
    .eq('id', userId)
    .single<ConfirmationState>()

  if (error) throw error
  return data
}

/**
 * Stores the account's count of confirmed loads. A read-then-write: one account's messages are
 * handled one at a time, and a lost increment only means one extra text confirmation (D6).
 */
export async function setConfirmedLoads(userId: string, count: number): Promise<void> {
  const { error } = await supabaseAdmin().from('usuarios').update({ cargas_confirmadas: count }).eq('id', userId)
  if (error) throw error
}
