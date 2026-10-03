import type { SupabaseClient } from '@supabase/supabase-js'
import type { AmountFormat } from '@/lib/data/amount-format'
import type { LocalDate } from '@/lib/data/expenses'

export type Usuario = {
  id: string
  nombre: string
  telefono: string | null
  foto_url: string | null
  /** ISO 3166-1 alpha-2 (`'AR'`, `'IE'`); null until the onboarding asks (0025). */
  pais: string | null
  moneda_default: string
  timezone: string
  dia_inicio_ciclo: number
  meta_ahorro_mensual: number | null
  /** First day of the last cycle whose charges were generated (0021); null before the first. */
  ciclo_generado_hasta: LocalDate | null
  idioma: 'es' | 'en'
  onboarding_completo: boolean
  /** The pending step of the web onboarding, 1–7 (0029, `onboarding`). */
  onboarding_paso: number
  /** The stored amount format; in effect only for Argentina (`effectiveAmountFormat`, 0029). */
  formato_montos: AmountFormat
  /** When the current linking code was requested; the code is live 7 days from here (0029, 0031). */
  whatsapp_solicitado_en: string | null
  /** The code of `vincular <código>`; null when none was requested or it was consumed (0031, `whatsapp-linking`). */
  codigo_vinculacion: string | null
  /** The bot keeps this account's conversation (0028, `bot-conversation-history`). */
  vip: boolean
  /** Loads confirmed on WhatsApp so far (progressive confirmation, 0002). */
  cargas_confirmadas: number
  modo_confirmacion: 'auto' | 'texto' | 'reaccion'
}

export const USUARIO_COLUMNS =
  'id, nombre, telefono, foto_url, pais, moneda_default, timezone, dia_inicio_ciclo, meta_ahorro_mensual, ciclo_generado_hasta, idioma, onboarding_completo, onboarding_paso, formato_montos, whatsapp_solicitado_en, codigo_vinculacion, vip, cargas_confirmadas, modo_confirmacion'

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
