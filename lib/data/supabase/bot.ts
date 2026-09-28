import type { SupabaseClient } from '@supabase/supabase-js'
import { categoriaViva } from '../categories.ts'

export type BotCategory = { id: string; nombre: string }
export type BotRecurring = { id: string; nombre: string; monto_actual: number; categoria_id: string }
export type BotContext = { categories: BotCategory[]; recurring: BotRecurring[] }

type CategoriaRow = BotCategory & { desde_ciclo: string | null; hasta_ciclo: string | null }

/**
 * The categories alive in the cycle starting on `cycle` (`category-editing` → *A category lives
 * from its first cycle to its last*): the only ones a message can be filed in.
 */
export function categoriesAliveIn(rows: CategoriaRow[], hiddenIds: string[], cycle: string): BotCategory[] {
  return rows
    .filter((row) =>
      categoriaViva({ from: row.desde_ciclo, until: row.hasta_ciclo, hidden: hiddenIds.includes(row.id) ? [cycle] : [] }, cycle),
    )
    .map(({ id, nombre }) => ({ id, nombre }))
}

/**
 * What the bot needs per message besides the user (design D9): the categories alive in the cycle
 * in progress and the active `gasto` definitions. Every read filters by `usuarioId`: the bot runs
 * with the service role.
 */
export async function loadBotContext(client: SupabaseClient, usuarioId: string): Promise<BotContext> {
  const cycle = await client.rpc('periodo_presupuesto', { p_usuario_id: usuarioId, p_periodo: null })
  if (cycle.error) throw cycle.error

  const [categories, hidden, recurring] = await Promise.all([
    client
      .from('categorias')
      .select('id, nombre, desde_ciclo, hasta_ciclo')
      .eq('usuario_id', usuarioId)
      .order('orden')
      .order('nombre'),
    client.from('categorias_ocultas').select('categoria_id').eq('usuario_id', usuarioId).eq('periodo', cycle.data),
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
  if (hidden.error) throw hidden.error
  if (recurring.error) throw recurring.error

  return {
    categories: categoriesAliveIn(
      categories.data as CategoriaRow[],
      (hidden.data as { categoria_id: string }[]).map((row) => row.categoria_id),
      cycle.data as string,
    ),
    recurring: (recurring.data as BotRecurring[]).map((row) => ({ ...row, monto_actual: Number(row.monto_actual) })),
  }
}

/** Name matching key: lowercase, accents stripped ("Súper" and "super" match). */
export function normalizeName(name: string): string {
  return name.trim().toLowerCase().normalize('NFD').replace(/\p{M}/gu, '')
}
