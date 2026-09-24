import type { IncomeMutations } from '@/lib/data/income'
import { expectRows, type DataContext } from './context'

/** `IncomeMutations` over `transacciones` rows with `tipo = 'ingreso'` and no category (D13). */
export function createSupabaseIncomeMutations({ client, usuarioId, currency }: DataContext): IncomeMutations {
  return {
    async create(draft) {
      expectRows(
        await client
          .from('transacciones')
          .insert({
            usuario_id: usuarioId,
            tipo: 'ingreso',
            categoria_id: null,
            monto: draft.amount,
            moneda: currency,
            fecha: `${draft.date}T12:00:00Z`,
            descripcion: draft.description || null,
          })
          .select('id'),
      )
    },
    async update(entryId, draft) {
      expectRows(
        await client
          .from('transacciones')
          .update({ monto: draft.amount, descripcion: draft.description || null, fecha: `${draft.date}T12:00:00Z` })
          .eq('id', entryId)
          .eq('usuario_id', usuarioId)
          .is('borrado_en', null)
          .select('id'),
      )
    },
    async softDelete(entryId) {
      expectRows(
        await client
          .from('transacciones')
          .update({ borrado_en: new Date().toISOString() })
          .eq('id', entryId)
          .eq('usuario_id', usuarioId)
          .is('borrado_en', null)
          .select('id'),
      )
    },
    async restore(entryId) {
      expectRows(
        await client
          .from('transacciones')
          .update({ borrado_en: null })
          .eq('id', entryId)
          .eq('usuario_id', usuarioId)
          .not('borrado_en', 'is', null)
          .select('id'),
      )
    },
  }
}
