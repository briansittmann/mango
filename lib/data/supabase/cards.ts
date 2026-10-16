import type { PostgrestError } from '@supabase/supabase-js'
import { DUPLICATE_CARD_NAME, type Card, type CardMutations } from '@/lib/data/cards'
import type { CategoryColor } from '@/lib/data/dashboard'
import { expectRows, type DataContext } from './context'

function fail(error: PostgrestError): never {
  // 23505 on tarjetas_nombre_unico (0038): the only unique rule a write can break.
  throw new Error(error.code === '23505' ? DUPLICATE_CARD_NAME : error.message)
}

/** The user's cards in creation order, as `DashboardData.cards` holds them. */
export async function readCards({ client, usuarioId }: DataContext): Promise<Card[]> {
  const { data, error } = await client
    .from('tarjetas')
    .select('id, nombre, color')
    .eq('usuario_id', usuarioId)
    .order('creada_en')
  if (error) throw new Error(error.message)
  return (data ?? []).map((t) => ({ id: t.id, name: t.nombre, color: t.color as CategoryColor }))
}

/**
 * `CardMutations` over `tarjetas` (0038): single-table writes, and `asignar_fijos_tarjeta` for the
 * checklist, which is one transaction (design D3).
 */
export function createSupabaseCardMutations({ client, usuarioId }: DataContext): CardMutations {
  return {
    async create(draft) {
      const { data, error } = await client
        .from('tarjetas')
        .insert({ usuario_id: usuarioId, nombre: draft.name, color: draft.color })
        .select('id')
        .single()
      if (error) fail(error)
      return data.id as string
    },
    async update(cardId, draft) {
      const result = await client
        .from('tarjetas')
        .update({ nombre: draft.name, color: draft.color })
        .eq('id', cardId)
        .eq('usuario_id', usuarioId)
        .select('id')
      if (result.error) fail(result.error)
      expectRows(result)
    },
    async delete(cardId) {
      // The FK leaves its fixed charges with tarjeta_id null (on delete set null, 0038).
      expectRows(await client.from('tarjetas').delete().eq('id', cardId).eq('usuario_id', usuarioId).select('id'))
    },
    async setFixedCharges(cardId, definitionIds) {
      const { error } = await client.rpc('asignar_fijos_tarjeta', {
        p_usuario_id: usuarioId,
        p_tarjeta_id: cardId,
        p_definiciones: definitionIds,
      })
      if (error) throw new Error(error.message)
    },
  }
}
