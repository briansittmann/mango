import { CYCLE_LOCKED, PHONE_TAKEN, type ProfileMutations } from '@/lib/data/profile'
import { expectRows, type DataContext } from './context'

/** Postgres: unique violation. */
const UNIQUE_VIOLATION = '23505'

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
    async requestWhatsApp(phone) {
      const result = await client
        .from('usuarios')
        .update({ telefono: phone, whatsapp_solicitado_en: new Date().toISOString() })
        .eq('id', usuarioId)
        .select('id')
      if (result.error?.code === UNIQUE_VIOLATION) throw new Error(PHONE_TAKEN)
      expectRows(result)
    },
    async setStep(step) {
      await update({ onboarding_paso: step })
    },
    async complete() {
      await update({ onboarding_completo: true })
    },
  }
}
