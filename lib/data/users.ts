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
