import type { TransferMutations } from '@/lib/data/payment-method'
import { expectRows, originColumns, type DataContext } from './context'

/**
 * `TransferMutations` over `transacciones` rows with `tipo = 'transferencia'` (design D1):
 * `medio_pago` is the pocket the money enters, with no category, description, definition or
 * cycle mark. Every write filters on the type, so an expense's id rejects.
 */
export function createSupabaseTransferMutations({ client, usuarioId, currency, origin }: DataContext): TransferMutations {
  return {
    async create(draft) {
      expectRows(
        await client
          .from('transacciones')
          .insert({
            usuario_id: usuarioId,
            tipo: 'transferencia',
            categoria_id: null,
            monto: draft.amount,
            moneda: currency,
            fecha: `${draft.date}T12:00:00Z`,
            medio_pago: draft.into,
            estado: 'confirmada',
            ...originColumns(origin),
          })
          .select('id'),
      )
    },
    async update(transferId, draft) {
      expectRows(
        await client
          .from('transacciones')
          .update({ monto: draft.amount, fecha: `${draft.date}T12:00:00Z`, medio_pago: draft.into })
          .eq('id', transferId)
          .eq('usuario_id', usuarioId)
          .eq('tipo', 'transferencia')
          .is('borrado_en', null)
          .select('id'),
      )
    },
    async softDelete(transferId) {
      expectRows(
        await client
          .from('transacciones')
          .update({ borrado_en: new Date().toISOString() })
          .eq('id', transferId)
          .eq('usuario_id', usuarioId)
          .eq('tipo', 'transferencia')
          .is('borrado_en', null)
          .select('id'),
      )
    },
    async restore(transferId) {
      expectRows(
        await client
          .from('transacciones')
          .update({ borrado_en: null })
          .eq('id', transferId)
          .eq('usuario_id', usuarioId)
          .eq('tipo', 'transferencia')
          .not('borrado_en', 'is', null)
          .select('id'),
      )
    },
  }
}
