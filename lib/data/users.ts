import { supabaseAdmin } from '@/lib/supabase/admin'

/**
 * Resuelve el teléfono contra los usuarios dados de alta (ARCHITECTURE.md §3,
 * paso 2 del flujo de carga). Devuelve `null` si el número no existe: ese caso
 * lo maneja el alta por código de invitación (§4).
 */
export async function buscarUsuarioIdPorTelefono(telefono: string): Promise<string | null> {
  const { data, error } = await supabaseAdmin()
    .from('usuarios')
    .select('id')
    .eq('telefono', telefono)
    .maybeSingle()

  if (error) throw error
  return data?.id ?? null
}
