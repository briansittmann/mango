import type { SavingsMutations } from '@/lib/data/savings'
import { expectRows, originColumns, type DataContext } from './context'

/** `SavingsMutations` over `transacciones` rows with `tipo = 'ahorro'`; a withdrawal is stored negative (D13). */
export function createSupabaseSavingsMutations({ client, usuarioId, currency, origin }: DataContext): SavingsMutations {
  return {
    async addSavingsMovement(draft) {
      expectRows(
        await client
          .from('transacciones')
          .insert({
            usuario_id: usuarioId,
            tipo: 'ahorro',
            categoria_id: null,
            monto: draft.kind === 'withdrawal' ? -draft.amount : draft.amount,
            moneda: currency,
            fecha: `${draft.date}T12:00:00Z`,
            descripcion: draft.name,
            ...originColumns(origin),
          })
          .select('id'),
      )
    },
    async softDelete(movementId) {
      expectRows(
        await client
          .from('transacciones')
          .update({ borrado_en: new Date().toISOString() })
          .eq('id', movementId)
          .eq('usuario_id', usuarioId)
          .eq('tipo', 'ahorro')
          .is('borrado_en', null)
          .select('id'),
      )
    },
    async restore(movementId) {
      expectRows(
        await client
          .from('transacciones')
          .update({ borrado_en: null })
          .eq('id', movementId)
          .eq('usuario_id', usuarioId)
          .eq('tipo', 'ahorro')
          .not('borrado_en', 'is', null)
          .select('id'),
      )
    },
  }
}
