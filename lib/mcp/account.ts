import 'server-only'

import type { LocalDate } from '@/lib/data/expenses'
import { cycleMonthOf, cycleRange, localDateOf, refInstantForMonth } from '@/lib/data/supabase/cycle'
import { resumenMensual } from '@/lib/data/supabase/dashboard'
import type { ToolContext } from './context'
import { resolveMonth, type MonthBounds } from './months'
import { fixedChargesOf } from './shape'

// What several tools read about the account's cycles before acting (add-mcp-server D5).

function params({ usuario }: ToolContext) {
  return { diaInicio: usuario.dia_inicio_ciclo, timezone: usuario.timezone }
}

/** The cycle in progress and the cycle of the account's oldest movement (any, deleted ones too). */
export async function monthBounds(tc: ToolContext): Promise<MonthBounds> {
  const { client, usuarioId, timezone } = tc.ctx
  const [current, oldest] = await Promise.all([
    cycleRange(client, { ...params(tc), ref: new Date() }),
    client.from('transacciones').select('fecha').eq('usuario_id', usuarioId).order('fecha').limit(1).maybeSingle(),
  ])
  if (oldest.error) throw oldest.error
  const currentMonth = cycleMonthOf(current, timezone)
  if (!oldest.data) return { current: currentMonth, first: currentMonth }
  const first = await cycleRange(client, { ...params(tc), ref: new Date(oldest.data.fecha) })
  return { current: currentMonth, first: cycleMonthOf(first, timezone) }
}

/** First and last local day of the cycle named `month`. */
export async function cycleOfMonth(tc: ToolContext, month: string): Promise<{ start: LocalDate; end: LocalDate }> {
  const range = await cycleRange(tc.ctx.client, { ...params(tc), ref: refInstantForMonth(month) })
  return { start: localDateOf(range.inicio, tc.ctx.timezone), end: localDateOf(new Date(range.fin.getTime() - 1), tc.ctx.timezone) }
}

/** The month named by a tool's input, checked against the account, and its `resumenMensual`. */
export async function readMonth(tc: ToolContext, month: string | undefined, options?: { fromCurrent?: boolean }) {
  const bounds = await monthBounds(tc)
  const resolved = resolveMonth(month, bounds, options)
  const read = await resumenMensual(tc.ctx.client, tc.usuario, resolved)
  return { ...read, bounds }
}

/** `list_fixed_charges` for a month: the definitions with their row there, deleted slots marked. */
export async function readFixedCharges(tc: ToolContext, month: string | undefined, options?: { fromCurrent?: boolean }) {
  const read = await readMonth(tc, month, options)
  const { data: deleted, error } = await tc.ctx.client
    .from('transacciones')
    .select('movimiento_recurrente_id')
    .eq('usuario_id', tc.ctx.usuarioId)
    .eq('ciclo_mes', read.data.cycle.start)
    .not('movimiento_recurrente_id', 'is', null)
    .not('borrado_en', 'is', null)
  if (error) throw error
  const list = fixedChargesOf(read.data, read.definitions, new Set((deleted ?? []).map((row) => row.movimiento_recurrente_id as string)))
  return { ...read, list }
}
