import type { LocalDate } from '@/lib/data/expenses'
import type { RecurringDefinition } from '@/lib/data/recurring'
import type { DataContext } from './context'
import { PROJECTION_HORIZON, cycleMonthOf, cycleRange, localDateOf, type CycleRange } from './cycle'

type MovimientoRecurrenteRow = {
  id: string
  nombre: string
  monto_actual: number | string
  tipo: 'gasto' | 'ingreso'
  categoria_id: string | null
  dia_del_mes: number
  activo: boolean
  recordatorio_activo: boolean
  dias_antes: number
  repeticiones_totales: number | null
  repeticiones_insertadas: number
}

export const DEFINITION_COLUMNS =
  'id, nombre, monto_actual, tipo, categoria_id, dia_del_mes, activo, recordatorio_activo, dias_antes, repeticiones_totales, repeticiones_insertadas'

export function toDefinition(d: MovimientoRecurrenteRow): RecurringDefinition {
  return {
    id: d.id,
    name: d.nombre,
    expectedAmount: Number(d.monto_actual),
    tipo: d.tipo,
    categoryId: d.categoria_id,
    day: d.dia_del_mes,
    active: d.activo,
    reminder: { active: d.recordatorio_activo, daysBefore: d.dias_antes },
    repetitions: d.repeticiones_totales == null ? null : { total: d.repeticiones_totales, done: d.repeticiones_insertadas },
  }
}

function monthsBetween(from: string, to: string): number {
  const [fy, fm] = from.split('-').map(Number)
  const [ty, tm] = to.split('-').map(Number)
  return (ty - fy) * 12 + (tm - fm)
}

/**
 * The cycle in progress and the cycles after it up to `until` (inclusive, at most the horizon),
 * each with its count after the last generated cycle — what `proyectarCiclo` needs to say what a
 * projected cycle shows (`add-forward-scoped-edits` D2, D3). With no generation marker the cycle in
 * progress is still to generate, so counting starts at the one before, as in `resumenMensual`.
 */
export async function futureCycles(
  { client, usuarioId }: DataContext,
  until: LocalDate,
): Promise<{ current: LocalDate; cycles: { start: LocalDate; cyclesAfterGenerated: number }[] }> {
  const { data: usuario, error } = await client
    .from('usuarios')
    .select('dia_inicio_ciclo, timezone, ciclo_generado_hasta')
    .eq('id', usuarioId)
    .single<{ dia_inicio_ciclo: number; timezone: string; ciclo_generado_hasta: LocalDate | null }>()
  if (error) throw new Error(error.message)

  const params = { diaInicio: usuario.dia_inicio_ciclo, timezone: usuario.timezone }
  const monthOf = (range: CycleRange) => cycleMonthOf(range, usuario.timezone)
  let range = await cycleRange(client, { ...params, ref: new Date() })
  const current = localDateOf(range.inicio, usuario.timezone)
  const generatedMonth =
    usuario.ciclo_generado_hasta == null
      ? monthOf(await cycleRange(client, { ...params, ref: new Date(range.inicio.getTime() - 1) }))
      : monthOf(await cycleRange(client, { ...params, ref: new Date(`${usuario.ciclo_generado_hasta}T12:00:00Z`) }))

  const cycles: { start: LocalDate; cyclesAfterGenerated: number }[] = []
  for (let i = 0; i < PROJECTION_HORIZON; i++) {
    range = await cycleRange(client, { ...params, ref: range.fin })
    const start = localDateOf(range.inicio, usuario.timezone)
    if (start > until) break
    cycles.push({ start, cyclesAfterGenerated: monthsBetween(generatedMonth, monthOf(range)) })
  }
  return { current, cycles }
}
