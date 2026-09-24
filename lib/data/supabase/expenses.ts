import type { ExpenseMutations } from '@/lib/data/expenses'
import { expectRows, type DataContext } from './context'

/** `ExpenseMutations` over `transacciones` rows with `tipo = 'gasto'` (D13). */
export function createSupabaseExpenseMutations({ client, usuarioId, currency }: DataContext): ExpenseMutations {
  return {
    async create(categoryId, draft) {
      expectRows(
        await client
          .from('transacciones')
          .insert({
            usuario_id: usuarioId,
            tipo: 'gasto',
            categoria_id: categoryId,
            monto: draft.amount,
            moneda: currency,
            fecha: `${draft.date}T12:00:00Z`,
            descripcion: draft.description || null,
            es_fijo: false,
          })
          .select('id'),
      )
    },
    async update(expenseId, draft) {
      expectRows(
        await client
          .from('transacciones')
          .update({ monto: draft.amount, descripcion: draft.description || null, fecha: `${draft.date}T12:00:00Z` })
          .eq('id', expenseId)
          .eq('usuario_id', usuarioId)
          .is('borrado_en', null)
          .select('id'),
      )
    },
    async softDelete(expenseId) {
      expectRows(
        await client
          .from('transacciones')
          .update({ borrado_en: new Date().toISOString() })
          .eq('id', expenseId)
          .eq('usuario_id', usuarioId)
          .is('borrado_en', null)
          .select('id'),
      )
    },
    async restore(expenseId) {
      expectRows(
        await client
          .from('transacciones')
          .update({ borrado_en: null })
          .eq('id', expenseId)
          .eq('usuario_id', usuarioId)
          .not('borrado_en', 'is', null)
          .select('id'),
      )
    },
  }
}
