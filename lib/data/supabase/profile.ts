import type { SupabaseClient } from '@supabase/supabase-js'
import { CYCLE_LOCKED, LINK_CODE_TTL_MS, type ProfileMutations } from '@/lib/data/profile'
import type { Channel } from '@/lib/data/users'
import { expectRows, type DataContext } from './context'

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
      // The database reuses the live code or draws a new one (`pedir_codigo_vinculacion`, 0043 D2):
      // the session's token cannot write the column, so it is no lookup oracle for other codes.
      const { data, error } = await client.rpc('pedir_codigo_vinculacion')
      if (error) throw new Error(error.message)
      return { code: data as string }
    },
    async unlinkWhatsApp() {
      // The session's own channel only: the function resolves the account from the JWT (0036).
      const { error } = await client.rpc('desvincular_canal', { p_tipo: 'whatsapp' })
      if (error) throw new Error(error.message)
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
    async setDefaultPaymentMethod(method) {
      await update({ medio_pago_default: method })
    },
  }
}
