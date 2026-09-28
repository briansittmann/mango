import type { ExpenseMutations } from '@/lib/data/expenses'
import { expectRows, originColumns, type DataContext } from './context'
import { localDateOf } from './cycle'

/** `ExpenseMutations` over `transacciones` rows with `tipo = 'gasto'` (D13). */
export function createSupabaseExpenseMutations({ client, usuarioId, currency, timezone, origin }: DataContext): ExpenseMutations {
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
            ...originColumns(origin),
          })
          .select('id'),
      )
    },
    async update(expenseId, draft, categoryId) {
      // The category has to be alive in the cycle the new date falls in (`categoriaViva`, 0024).
      const cycle = await client
        .rpc('rango_ciclo_usuario', { p_usuario_id: usuarioId, p_fecha_ref: `${draft.date}T12:00:00Z` })
        .single<{ inicio: string }>()
      if (cycle.error) throw new Error(cycle.error.message)
      const alive = await client.rpc('categoria_viva', {
        p_usuario_id: usuarioId,
        p_categoria_id: categoryId,
        p_periodo: localDateOf(cycle.data.inicio, timezone),
      })
      if (alive.error) throw new Error(alive.error.message)
      if (!alive.data) throw new Error('not-found')

      expectRows(
        await client
          .from('transacciones')
          // Saving a pending recurring charge confirms it (design D4); on any other row it is a no-op.
          .update({
            monto: draft.amount,
            descripcion: draft.description || null,
            fecha: `${draft.date}T12:00:00Z`,
            categoria_id: categoryId,
            estado: 'confirmada',
          })
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
