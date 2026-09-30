import type { PostgrestError } from '@supabase/supabase-js'
import { DUPLICATE_CATEGORY_NAME, type CategoryMutations } from '@/lib/data/categories'
import { proyectarCiclo } from '@/lib/data/projection'
import type { DataContext } from './context'
import { DEFINITION_COLUMNS, futureCycles, toDefinition } from './future-cycles'

function fail(error: PostgrestError): never {
  throw new Error(error.message === 'duplicate-category-name' ? DUPLICATE_CATEGORY_NAME : error.message)
}

/**
 * `CategoryMutations` over the 0017 functions (`actualizar_categoria` from 0022, `crear_categoria`
 * and `eliminar_categoria` from 0024); each call is one transaction (D12).
 */
export function createSupabaseCategoryMutations(ctx: DataContext): CategoryMutations {
  const { client, usuarioId } = ctx
  return {
    async create(draft, cycle, scope) {
      const { data, error } = await client.rpc('crear_categoria', {
        p_usuario_id: usuarioId,
        p_nombre: draft.name,
        p_color: draft.color,
        p_presupuesto: draft.budget,
        p_periodo: cycle,
        p_solo_este_ciclo: scope === 'only',
      })
      if (error) fail(error)
      return data as string
    },
    async update(categoryId, draft, { cycle, scope }) {
      let budget = draft.budget
      let periodo: string | null = cycle
      if (scope == null) {
        const current = await client.rpc('periodo_presupuesto', { p_usuario_id: usuarioId, p_periodo: null })
        if (current.error) fail(current.error)
        // A projected cycle without a scope is a rename: the current cycle's own entry is written
        // back as it stands (no row and a marker both stay as they are), so no budget changes.
        if (cycle > (current.data as string)) {
          const row = await client
            .from('presupuestos')
            .select('monto')
            .eq('usuario_id', usuarioId)
            .eq('categoria_id', categoryId)
            .eq('periodo', current.data)
            .maybeSingle()
          if (row.error) fail(row.error)
          budget = row.data?.monto == null ? null : Number(row.data.monto)
          periodo = null
        }
      }
      const { error } = await client.rpc('actualizar_categoria', {
        p_usuario_id: usuarioId,
        p_id: categoryId,
        p_nombre: draft.name,
        p_color: draft.color,
        p_presupuesto: budget,
        p_periodo: periodo,
        p_alcance: scope === 'only' ? 'solo' : scope === 'onward' ? 'desde' : null,
      })
      if (error) fail(error)
    },
    async delete(categoryId, reassignTo, { cycle, scope }) {
      // Hiding it in a projected cycle moves its definitions' charges of that cycle too: they are
      // not rows yet, so they go as what the projection shows (`add-forward-scoped-edits` D7).
      let cargos: { movimiento_recurrente_id: string; monto: number; fecha: string }[] = []
      if (scope === 'only') {
        const target = (await futureCycles(ctx, cycle)).cycles.find((c) => c.start === cycle)
        if (target) {
          const definiciones = await client
            .from('movimientos_recurrentes')
            .select(DEFINITION_COLUMNS)
            .eq('usuario_id', usuarioId)
            .eq('categoria_id', categoryId)
            .eq('tipo', 'gasto')
          if (definiciones.error) fail(definiciones.error)
          cargos = proyectarCiclo({
            start: cycle,
            cyclesAfterGenerated: target.cyclesAfterGenerated,
            definitions: (definiciones.data ?? []).map(toDefinition),
            budgetRows: [],
            savingsTarget: null,
          }).charges.map((charge) => ({ movimiento_recurrente_id: charge.definitionId, monto: charge.amount, fecha: charge.date }))
        }
      }
      const { error } = await client.rpc('eliminar_categoria', {
        p_usuario_id: usuarioId,
        p_id: categoryId,
        p_reasignar_a: reassignTo,
        p_periodo: cycle,
        p_alcance: scope === 'only' ? 'solo' : 'desde',
        p_cargos: cargos,
      })
      if (error) fail(error)
    },
    async setProgressVisible(categoryId, visible) {
      const { data, error } = await client
        .from('categorias')
        .update({ mostrar_progreso: visible })
        .eq('id', categoryId)
        .eq('usuario_id', usuarioId)
        .select('id')
      if (error) fail(error)
      if (!data?.length) throw new Error('not-found')
    },
    async reorder(categoryIds) {
      const { error } = await client.rpc('reordenar_categorias', { p_usuario_id: usuarioId, p_ids: categoryIds })
      if (error) fail(error)
    },
  }
}
