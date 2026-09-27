import type { PostgrestError } from '@supabase/supabase-js'
import { DUPLICATE_CATEGORY_NAME, type CategoryMutations } from '@/lib/data/categories'
import type { DataContext } from './context'

function fail(error: PostgrestError): never {
  throw new Error(error.message === 'duplicate-category-name' ? DUPLICATE_CATEGORY_NAME : error.message)
}

/** `CategoryMutations` over the 0017 functions (`actualizar_categoria` from 0022); each call is one transaction (D12). */
export function createSupabaseCategoryMutations({ client, usuarioId }: DataContext): CategoryMutations {
  return {
    async create(draft) {
      const { data, error } = await client.rpc('crear_categoria', {
        p_usuario_id: usuarioId,
        p_nombre: draft.name,
        p_color: draft.color,
        p_presupuesto: draft.budget,
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
    async delete(categoryId, reassignTo) {
      const { error } = await client.rpc('eliminar_categoria', {
        p_usuario_id: usuarioId,
        p_id: categoryId,
        p_reasignar_a: reassignTo,
      })
      if (error) fail(error)
    },
    async reorder(categoryIds) {
      const { error } = await client.rpc('reordenar_categorias', { p_usuario_id: usuarioId, p_ids: categoryIds })
      if (error) fail(error)
    },
  }
}
