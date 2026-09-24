import type { SupabaseClient } from '@supabase/supabase-js'

export type Usuario = {
  id: string
  nombre: string
  telefono: string
  foto_url: string | null
  moneda_default: string
  timezone: string
  dia_inicio_ciclo: number
  meta_ahorro_mensual: number | null
}

/**
 * The `usuarios` row linked to the session's auth user, or null when none is linked. RLS
 * (`usuarios_select_propio`) restricts the read to that row, so no filter is needed.
 */
export async function findCurrentUsuario(client: SupabaseClient): Promise<Usuario | null> {
  const { data, error } = await client
    .from('usuarios')
    .select('id, nombre, telefono, foto_url, moneda_default, timezone, dia_inicio_ciclo, meta_ahorro_mensual')
    .maybeSingle<Usuario>()

  if (error) throw error
  if (!data) return null
  return { ...data, meta_ahorro_mensual: data.meta_ahorro_mensual == null ? null : Number(data.meta_ahorro_mensual) }
}
