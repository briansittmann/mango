import type { SupabaseClient } from '@supabase/supabase-js'

export type BotCategory = { id: string; nombre: string }
export type BotRecurring = { id: string; nombre: string; monto_actual: number; categoria_id: string }
export type BotContext = { categories: BotCategory[]; recurring: BotRecurring[] }

/**
 * What the bot needs per message besides the user (design D9): the account's categories and its
 * active `gasto` definitions. Both reads filter by `usuarioId`: the bot runs with the service role.
 */
export async function loadBotContext(client: SupabaseClient, usuarioId: string): Promise<BotContext> {
  const [categories, recurring] = await Promise.all([
    client.from('categorias').select('id, nombre').eq('usuario_id', usuarioId).order('orden').order('nombre'),
    client
      .from('movimientos_recurrentes')
      .select('id, nombre, monto_actual, categoria_id')
      .eq('usuario_id', usuarioId)
      .eq('tipo', 'gasto')
      .eq('activo', true)
      .order('orden')
      .order('nombre'),
  ])

  if (categories.error) throw categories.error
  if (recurring.error) throw recurring.error

  return {
    categories: categories.data as BotCategory[],
    recurring: (recurring.data as BotRecurring[]).map((row) => ({ ...row, monto_actual: Number(row.monto_actual) })),
  }
}

/** Name matching key: lowercase, accents stripped ("Súper" and "super" match). */
export function normalizeName(name: string): string {
  return name.trim().toLowerCase().normalize('NFD').replace(/\p{M}/gu, '')
}
