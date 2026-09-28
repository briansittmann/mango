import type { LocalDate } from '@/lib/data/expenses'
import { congelarCiclos, fechaEnCiclo } from '@/lib/data/projection'
import type { RecurringDefinition, RecurringMutations } from '@/lib/data/recurring'
import { expectRows, type DataContext } from './context'
import { DEFINITION_COLUMNS, futureCycles, toDefinition } from './future-cycles'

const SCOPE = { only: 'solo', onward: 'desde' } as const

async function loadDefinition({ client, usuarioId }: DataContext, definitionId: string): Promise<RecurringDefinition> {
  const { data, error } = await client
    .from('movimientos_recurrentes')
    .select(DEFINITION_COLUMNS)
    .eq('id', definitionId)
    .eq('usuario_id', usuarioId)
    .single()
  if (error) throw new Error(error.message)
  return toDefinition(data)
}

/**
 * What the cycles between the one in progress and `cycle` show for the definition, in the shape
 * `p_congelar` takes (D2, D3): computed with `proyectarCiclo`, as the cron computes `p_cargos`.
 */
async function frozenCycles(ctx: DataContext, definition: RecurringDefinition, cycle: LocalDate) {
  const { cycles } = await futureCycles(ctx, cycle)
  return congelarCiclos({ definition, cycles: cycles.filter((c) => c.start < cycle) }).map(({ cycle, charge }) => ({
    ciclo: cycle,
    monto: charge.amount,
    fecha: charge.date,
  }))
}

/**
 * `RecurringMutations` over the 0017 functions, plus `stop` as a single-row update (D12, D13), and
 * the slot operations over the 0024 functions (`add-forward-scoped-edits` D5).
 */
export function createSupabaseRecurringMutations(ctx: DataContext): RecurringMutations {
  const { client, usuarioId } = ctx
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
    async editInCycle(definitionId, cycle, entry, scope) {
      const congelar = scope === 'onward' ? await frozenCycles(ctx, await loadDefinition(ctx, definitionId), cycle) : []
      const { error } = await client.rpc('editar_cargo_en_ciclo', {
        p_usuario_id: usuarioId,
        p_movimiento_id: definitionId,
        p_periodo: cycle,
        p_monto: entry.amount,
        p_descripcion: entry.description,
        p_fecha: entry.date,
        p_categoria_id: entry.categoryId,
        p_alcance: SCOPE[scope],
        p_congelar: congelar,
      })
      if (error) throw new Error(error.message)
    },
    async deleteInCycle(definitionId, cycle, scope) {
      const definition = await loadDefinition(ctx, definitionId)
      const congelar = scope === 'onward' ? await frozenCycles(ctx, definition, cycle) : []
      const { error } = await client.rpc('eliminar_cargo_en_ciclo', {
        p_usuario_id: usuarioId,
        p_movimiento_id: definitionId,
        p_periodo: cycle,
        p_alcance: SCOPE[scope],
        // Only read when the cycle holds no slot yet: a projected charge, at what it showed.
        p_cargo: { monto: definition.expectedAmount, fecha: fechaEnCiclo(cycle, definition.day) },
        p_congelar: congelar,
      })
      if (error) throw new Error(error.message)
    },
    async restoreInCycle(definitionId, cycle) {
      const { error } = await client.rpc('restaurar_cargo_en_ciclo', {
        p_usuario_id: usuarioId,
        p_movimiento_id: definitionId,
        p_periodo: cycle,
      })
      if (error) throw new Error(error.message)
    },
  }
}
