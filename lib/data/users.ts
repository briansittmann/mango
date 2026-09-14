import { supabaseAdmin } from '@/lib/supabase/admin'

/**
 * Resolves the phone number against registered users (ARCHITECTURE.md §3,
 * step 2 of the onboarding flow). Returns `null` if the number doesn't exist:
 * that case is handled by signup via invitation code (§4).
 */
export async function findUserIdByPhone(phone: string): Promise<string | null> {
  const { data, error } = await supabaseAdmin()
    .from('usuarios')
    .select('id')
    .eq('telefono', phone)
    .maybeSingle()

  if (error) throw error
  return data?.id ?? null
}
