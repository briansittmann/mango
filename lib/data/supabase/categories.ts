import type { PostgrestError } from '@supabase/supabase-js'
import { DUPLICATE_CATEGORY_NAME, type CategoryMutations } from '@/lib/data/categories'
import type { DataContext } from './context'

function fail(error: PostgrestError): never {
  throw new Error(error.message === 'duplicate-category-name' ? DUPLICATE_CATEGORY_NAME : error.message)
}

/** `CategoryMutations` over the 0017 functions; each call is one transaction (D12). */
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
    async update(categoryId, draft) {
      const { error } = await client.rpc('actualizar_categoria', {
        p_usuario_id: usuarioId,
        p_id: categoryId,
        p_nombre: draft.name,
        p_color: draft.color,
        p_presupuesto: draft.budget,
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
