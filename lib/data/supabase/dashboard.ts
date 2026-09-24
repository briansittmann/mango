import type { SupabaseClient } from '@supabase/supabase-js'
import { getBudgetStatus, getFreeMargin } from '@/lib/data/budget'
import type { CategoryColor, DashboardData, Expense, ExpenseGroup } from '@/lib/data/dashboard'
import type { LocalDate } from '@/lib/data/expenses'
import type { IncomeEntry } from '@/lib/data/income'
import type { RecurringDefinition } from '@/lib/data/recurring'
import { cycleMonthOf, cycleRange, localDateOf, parseMonthParam, refInstantForMonth, shiftMonth, type CycleRange } from './cycle'
import type { Usuario } from './user'

type CategoriaRow = { id: string; nombre: string; color: CategoryColor }
type PresupuestoRow = { categoria_id: string; monto: number | string | null }
type MovimientoRecurrenteRow = {
  id: string
  nombre: string
  monto_actual: number | string
  tipo: 'gasto' | 'ingreso' | 'ahorro'
  categoria_id: string | null
  dia_del_mes: number | null
  activo: boolean
  recordatorio_activo: boolean
  dias_antes: number
  repeticiones_totales: number | null
  repeticiones_insertadas: number
}
type TransaccionRow = {
  id: string
  monto: number | string
  fecha: string
  categoria_id: string | null
  descripcion: string | null
  tipo: 'gasto' | 'ingreso' | 'ahorro'
  movimiento_recurrente_id: string | null
}

const DAY_MS = 86_400_000

function daysBetween(from: LocalDate, to: LocalDate): number {
  return Math.round((Date.parse(to) - Date.parse(from)) / DAY_MS)
}

function inRange(fecha: string, range: CycleRange): boolean {
  const t = new Date(fecha).getTime()
  return t >= range.inicio.getTime() && t < range.fin.getTime()
}

/**
 * Provisional charged/pending rule while `transacciones.estado` does not exist (D11): a charge
 * is taken once its local date is not after the cycle's today. `actualizar_movimiento_recurrente`
 * (0017) applies the same rule in SQL.
 */
function isCharged(fecha: string, timezone: string, today: LocalDate): boolean {
  return localDateOf(fecha, timezone) <= today
}

/**
 * `DashboardData` and the recurring definitions of one billing cycle, read as `usuario`
 * (ARCHITECTURE §3). `month` is the raw `?mes=` value: anything invalid or after the cycle in
 * progress shows the cycle in progress (D9). Reading the cycle in progress may write: its budget
 * rows are copied from the latest earlier cycle the first time (`copiar_presupuestos_ciclo`).
 */
export async function resumenMensual(
  client: SupabaseClient,
  usuario: Usuario,
  month?: string | string[],
): Promise<{ data: DashboardData; definitions: RecurringDefinition[] }> {
  const timezone = usuario.timezone
  const now = new Date()
  const cycleParams = { diaInicio: usuario.dia_inicio_ciclo, timezone }

  const current = await cycleRange(client, { ...cycleParams, ref: now })
  const shownMonth = parseMonthParam(month, cycleMonthOf(current, timezone))
  const months = [-5, -4, -3, -2, -1, 0].map((n) => shiftMonth(shownMonth, n))
  const ranges = await Promise.all(months.map((m) => cycleRange(client, { ...cycleParams, ref: refInstantForMonth(m) })))
  const oldest = ranges[0]
  const shown = ranges[5]

  const start = localDateOf(shown.inicio, timezone)
  const end = localDateOf(new Date(shown.fin.getTime() - 1), timezone)
  const localToday = localDateOf(now, timezone)
  const today = localToday < start ? start : localToday > end ? end : localToday
  const inProgress = shown.inicio.getTime() <= now.getTime() && now.getTime() < shown.fin.getTime()

  if (inProgress) {
    const { error } = await client.rpc('copiar_presupuestos_ciclo', { p_usuario_id: usuario.id })
    if (error) throw error
  }

  const [categorias, presupuestos, definiciones, transacciones, ahorros] = await Promise.all([
    client.from('categorias').select('id, nombre, color').eq('usuario_id', usuario.id).order('orden').order('nombre'),
    client.from('presupuestos').select('categoria_id, monto').eq('usuario_id', usuario.id).eq('periodo', start),
    client
      .from('movimientos_recurrentes')
      .select(
        'id, nombre, monto_actual, tipo, categoria_id, dia_del_mes, activo, recordatorio_activo, dias_antes, repeticiones_totales, repeticiones_insertadas',
      )
      .eq('usuario_id', usuario.id)
      .order('orden')
      .order('nombre'),
    client
      .from('transacciones')
      .select('id, monto, fecha, categoria_id, descripcion, tipo, movimiento_recurrente_id')
      .eq('usuario_id', usuario.id)
      .is('borrado_en', null)
      .gte('fecha', oldest.inicio.toISOString())
      .lt('fecha', shown.fin.toISOString())
      .order('fecha'),
    client
      .from('transacciones')
      .select('monto, fecha')
      .eq('usuario_id', usuario.id)
      .eq('tipo', 'ahorro')
      .is('borrado_en', null)
      .lt('fecha', shown.fin.toISOString()),
  ])
  for (const result of [categorias, presupuestos, definiciones, transacciones, ahorros]) {
    if (result.error) throw result.error
  }

  const categoryRows = (categorias.data ?? []) as CategoriaRow[]
  const budgetRows = (presupuestos.data ?? []) as PresupuestoRow[]
  const definitionRows = (definiciones.data ?? []) as MovimientoRecurrenteRow[]
  const rows = (transacciones.data ?? []) as TransaccionRow[]
  const savingsRows = (ahorros.data ?? []) as Pick<TransaccionRow, 'monto' | 'fecha'>[]

  // Null day → day 1 (D11), both on definitions and on the charges they produced.
  const dayOf = new Map(definitionRows.map((d) => [d.id, d.dia_del_mes ?? 1]))
  const budgetOf = new Map(budgetRows.map((b) => [b.categoria_id, b.monto == null ? null : Number(b.monto)]))
  const shownRows = rows.filter((row) => inRange(row.fecha, shown))

  const currentDay = daysBetween(start, today) + 1
  const cycleDays = daysBetween(start, end) + 1

  const groups: ExpenseGroup[] = categoryRows.map((categoria) => {
    const expenses: Expense[] = shownRows
      .filter((row) => row.tipo === 'gasto' && row.categoria_id === categoria.id)
      .map((row) => ({
        id: row.id,
        name: row.descripcion ?? '',
        amount: Number(row.monto),
        date: row.fecha,
        ...(row.movimiento_recurrente_id
          ? {
              fixed: {
                definitionId: row.movimiento_recurrente_id,
                day: dayOf.get(row.movimiento_recurrente_id) ?? 1,
                charged: isCharged(row.fecha, timezone, today),
              },
            }
          : {}),
      }))
    // Recurring charges count inside their category's total and bar (`category-editing` →
    // *A budget reserves its amount in the free margin*).
    const total = expenses.reduce((sum, expense) => sum + expense.amount, 0)
    const budgetAmount = budgetOf.get(categoria.id) ?? null

    return {
      id: categoria.id,
      kind: 'category',
      name: categoria.nombre,
      color: categoria.color,
      total,
      budget: budgetAmount != null ? getBudgetStatus({ amount: budgetAmount, spent: total, currentDay, cycleDays }) : null,
      expenses,
    }
  })
  const expensesTotal = groups.reduce((sum, group) => sum + group.total, 0)

  const incomeEntries: IncomeEntry[] = shownRows
    .filter((row) => row.tipo === 'ingreso')
    .map((row) => ({
      id: row.id,
      name: row.descripcion ?? '',
      amount: Number(row.monto),
      date: row.fecha,
      ...(row.movimiento_recurrente_id
        ? { recurring: { definitionId: row.movimiento_recurrente_id, day: dayOf.get(row.movimiento_recurrente_id) ?? 1 } }
        : {}),
    }))
  const incomeTotal = incomeEntries.reduce((sum, entry) => sum + entry.amount, 0)

  const movements = shownRows
    .filter((row) => row.tipo === 'ahorro')
    .map((row) => ({ id: row.id, name: row.descripcion ?? '', date: row.fecha, amount: Number(row.monto) }))
  const savingsCycle = movements.reduce((sum, movement) => sum + movement.amount, 0)

  const history = ranges.map((range, index) => ({
    month: months[index],
    total: rows
      .filter((row) => row.tipo === 'gasto' && inRange(row.fecha, range))
      .reduce((sum, row) => sum + Number(row.monto), 0),
  }))
  const savingsHistory = ranges.map((range, index) => ({
    month: months[index],
    accumulated: savingsRows
      .filter((row) => new Date(row.fecha).getTime() < range.fin.getTime())
      .reduce((sum, row) => sum + Number(row.monto), 0),
  }))

  const definitions: RecurringDefinition[] = definitionRows
    .filter((d): d is MovimientoRecurrenteRow & { tipo: 'gasto' | 'ingreso' } => d.tipo !== 'ahorro')
    .map((d) => ({
      id: d.id,
      name: d.nombre,
      expectedAmount: Number(d.monto_actual),
      tipo: d.tipo,
      categoryId: d.categoria_id,
      day: d.dia_del_mes ?? 1,
      active: d.activo,
      reminder: { active: d.recordatorio_activo, daysBefore: d.dias_antes },
      repetitions: d.repeticiones_totales == null ? null : { total: d.repeticiones_totales, done: d.repeticiones_insertadas },
    }))

  return {
    data: {
      user: {
        name: usuario.nombre,
        phone: usuario.telefono,
        photoUrl: usuario.foto_url,
        currency: usuario.moneda_default,
        timezone,
      },
      cycle: { start, end, today, month: shownMonth, inProgress },
      freeMargin: getFreeMargin({
        income: incomeTotal,
        savings: savingsCycle,
        categories: groups.map((group) => ({ budget: group.budget?.amount ?? null, spent: group.total })),
      }),
      income: { total: incomeTotal, entries: incomeEntries },
      savings: {
        cycle: savingsCycle,
        accumulated: savingsHistory[5].accumulated,
        target: usuario.meta_ahorro_mensual,
        history: savingsHistory,
        movements,
      },
      expenses: { total: expensesTotal, groups },
      history,
    },
    definitions,
  }
}
