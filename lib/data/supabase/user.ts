import type { SupabaseClient } from '@supabase/supabase-js'
import type { LocalDate } from '@/lib/data/expenses'

export type Usuario = {
  id: string
  nombre: string
  telefono: string | null
  foto_url: string | null
  moneda_default: string
  timezone: string
  dia_inicio_ciclo: number
  meta_ahorro_mensual: number | null
  /** First day of the last cycle whose charges were generated (0021); null before the first. */
  ciclo_generado_hasta: LocalDate | null
  idioma: 'es' | 'en'
}

const USUARIO_COLUMNS =
  'id, nombre, telefono, foto_url, moneda_default, timezone, dia_inicio_ciclo, meta_ahorro_mensual, ciclo_generado_hasta, idioma'

/**
 * The `usuarios` row linked to the session's auth user, or null when none is linked. RLS
 * (`usuarios_select_propio`) restricts the read to that row, so no filter is needed.
 */
export async function findCurrentUsuario(client: SupabaseClient): Promise<Usuario | null> {
  const { data, error } = await client
    .from('usuarios')
    .select(USUARIO_COLUMNS)
    .maybeSingle<Usuario>()

  if (error) throw error
  return data ? withNumbers(data) : null
}

/**
 * The `usuarios` row with this id, or null. For the bot's service-role client (design D9), which
 * has no session: the filter by id is what limits the read.
 */
export async function findUsuarioById(client: SupabaseClient, id: string): Promise<Usuario | null> {
  const { data, error } = await client.from('usuarios').select(USUARIO_COLUMNS).eq('id', id).maybeSingle<Usuario>()

  if (error) throw error
  return data ? withNumbers(data) : null
}

function withNumbers(data: Usuario): Usuario {
  return { ...data, meta_ahorro_mensual: data.meta_ahorro_mensual == null ? null : Number(data.meta_ahorro_mensual) }
}
