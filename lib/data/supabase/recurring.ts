import type { RecurringMutations } from '@/lib/data/recurring'
import { expectRows, type DataContext } from './context'

/** `RecurringMutations` over the 0017 functions, plus `stop` as a single-row update (D12, D13). */
export function createSupabaseRecurringMutations({ client, usuarioId }: DataContext): RecurringMutations {
  return {
    async create(target, draft) {
      const { error } = await client.rpc('crear_movimiento_recurrente', {
        p_usuario_id: usuarioId,
        p_tipo: target.tipo,
        p_categoria_id: target.tipo === 'gasto' ? target.categoryId : null,
        p_nombre: draft.name,
        p_monto: draft.expectedAmount,
        p_dia: draft.day,
        p_recordatorio: draft.reminder.active,
        p_dias_antes: draft.reminder.daysBefore,
        p_repeticiones: draft.repetitions,
      })
      if (error) throw new Error(error.message)
    },
    async update(definitionId, draft) {
      const { error } = await client.rpc('actualizar_movimiento_recurrente', {
        p_usuario_id: usuarioId,
        p_id: definitionId,
        p_nombre: draft.name,
        p_monto: draft.expectedAmount,
        p_dia: draft.day,
        p_recordatorio: draft.reminder.active,
        p_dias_antes: draft.reminder.daysBefore,
      })
      if (error) throw new Error(error.message)
    },
    async stop(definitionId) {
      expectRows(
        await client
          .from('movimientos_recurrentes')
          .update({ activo: false })
          .eq('id', definitionId)
          .eq('usuario_id', usuarioId)
          .select('id'),
      )
    },
    async delete(definitionId) {
      const { error } = await client.rpc('eliminar_movimiento_recurrente', { p_usuario_id: usuarioId, p_id: definitionId })
      if (error) throw new Error(error.message)
    },
  }
}
