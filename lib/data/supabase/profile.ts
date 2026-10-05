import type { SupabaseClient } from '@supabase/supabase-js'
import { toE164 } from '@/lib/data/phone'
import { CYCLE_LOCKED, INVALID_PHONE, LINK_CODE_TTL_MS, PHONE_TAKEN, type ProfileMutations } from '@/lib/data/profile'
import type { Channel } from '@/lib/data/users'
import { generateLinkCode } from '@/lib/whatsapp/link'
import { expectRows, type DataContext } from './context'

/** Postgres: unique violation. */
const UNIQUE_VIOLATION = '23505'

/** Whether a stored code is still live: requested less than `LINK_CODE_TTL_MS` ago (D1). */
export function linkCodeIsLive(code: string | null, requestedAt: string | null, now = Date.now()): boolean {
  return code != null && requestedAt != null && new Date(requestedAt).getTime() + LINK_CODE_TTL_MS > now
}

/**
 * The identifier of the account's own channel of `type`, or null (`canal_vinculado`, 0031, D3):
 * the one thing the web reads from `canales`, which keeps RLS without policies.
 */
export async function linkedChannel(client: SupabaseClient, type: Channel): Promise<string | null> {
  const { data, error } = await client.rpc('canal_vinculado', { p_tipo: type })
  if (error) throw new Error(error.message)
  return (data as string | null) ?? null
}

/**
 * Whether anything is keyed to the account's cycle (D6): a category, a definition, a budget row or
 * a movement, deleted ones included. While false, the cycle day can change and re-keys nothing.
 */
export async function hasData({ client, usuarioId }: DataContext): Promise<boolean> {
  const tables = ['categorias', 'movimientos_recurrentes', 'presupuestos', 'transacciones'] as const
  const results = await Promise.all(
    tables.map((table) => client.from(table).select('usuario_id', { count: 'exact', head: true }).eq('usuario_id', usuarioId)),
  )
  for (const result of results) if (result.error) throw new Error(result.error.message)
  return results.some((result) => (result.count ?? 0) > 0)
}

/**
 * `ProfileMutations` over the user's own `usuarios` row (RLS `usuarios_update_propio`): every
 * update selects `id` back and `expectRows` rejects a foreign id or a missing row (D3).
 */
export function createSupabaseProfileMutations(ctx: DataContext): ProfileMutations {
  const { client, usuarioId } = ctx

  async function update(values: Record<string, unknown>): Promise<void> {
    expectRows(await client.from('usuarios').update(values).eq('id', usuarioId).select('id'))
  }

  return {
    async updateBasics(basics) {
      const { data, error } = await client.from('usuarios').select('dia_inicio_ciclo').eq('id', usuarioId).single<{ dia_inicio_ciclo: number }>()
      if (error) throw new Error(error.message)
      if (basics.cycleDay !== data.dia_inicio_ciclo && (await hasData(ctx))) throw new Error(CYCLE_LOCKED)

      await update({
        nombre: basics.name,
        pais: basics.country,
        moneda_default: basics.currency,
        timezone: basics.timezone,
        dia_inicio_ciclo: basics.cycleDay,
        formato_montos: basics.amountFormat,
      })
    },
    async setSavingsTarget(amount) {
      await update({ meta_ahorro_mensual: amount })
    },
    async requestWhatsAppLink() {
      const { data, error } = await client
        .from('usuarios')
        .select('codigo_vinculacion, whatsapp_solicitado_en')
        .eq('id', usuarioId)
        .single<{ codigo_vinculacion: string | null; whatsapp_solicitado_en: string | null }>()
      if (error) throw new Error(error.message)
      if (linkCodeIsLive(data.codigo_vinculacion, data.whatsapp_solicitado_en)) return { code: data.codigo_vinculacion! }

      // A collision with another account's code is a unique violation: three draws from 2^30.
      for (let attempt = 0; ; attempt++) {
        const code = generateLinkCode()
        const result = await client
          .from('usuarios')
          .update({ codigo_vinculacion: code, whatsapp_solicitado_en: new Date().toISOString() })
          .eq('id', usuarioId)
          .select('id')
        if (result.error?.code === UNIQUE_VIOLATION && attempt < 2) continue
        expectRows(result)
        return { code }
      }
    },
    async requestWhatsApp(phone, country) {
      // Converted here, on the server: the values are the user's to send, not to trust.
      const normalized = toE164(phone, country)
      if (!normalized) throw new Error(INVALID_PHONE)
      const result = await client.from('usuarios').update({ telefono: normalized }).eq('id', usuarioId).select('id')
      if (result.error?.code === UNIQUE_VIOLATION) throw new Error(PHONE_TAKEN)
      expectRows(result)
    },
    async setStep(step) {
      await update({ onboarding_paso: step })
    },
    async complete() {
      await update({ onboarding_completo: true })
    },
    async setWidgetOrder(order) {
      await update({ orden_widgets: order })
    },
  }
}
