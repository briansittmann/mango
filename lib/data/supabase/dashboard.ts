import type { SupabaseClient } from '@supabase/supabase-js'
import { effectiveAmountFormat } from '@/lib/data/amount-format'
import { getBudgetStatus, getFreeMargin } from '@/lib/data/budget'
import { categoriaViva } from '@/lib/data/categories'
import { normalizeWidgetOrder, type CategoryColor, type DashboardData, type Expense, type ExpenseGroup } from '@/lib/data/dashboard'
import type { LocalDate } from '@/lib/data/expenses'
import type { IncomeEntry } from '@/lib/data/income'
import { paymentMethodsOffered, pocketBalances, type CountedRow, type PaymentMethod, type Pockets, type Transfer } from '@/lib/data/payment-method'
import { mezclarProyeccion, proyectarCiclo } from '@/lib/data/projection'
import type { RecurringDefinition } from '@/lib/data/recurring'
import { splitSavings } from '@/lib/data/savings'
import {
  PROJECTION_HORIZON,
  cycleMonthOf,
  cycleRange,
  localDateOf,
  parseMonthParam,
  refInstantForMonth,
  shiftMonth,
  type CycleRange,
} from './cycle'
import { linkCodeIsLive, linkedChannel } from './profile'
import type { Usuario } from './user'

type CategoriaRow = {
  id: string
  nombre: string
  color: CategoryColor
  desde_ciclo: LocalDate | null
  hasta_ciclo: LocalDate | null
  mostrar_progreso: boolean
}
type PresupuestoRow = { categoria_id: string; monto: number | string | null; periodo: LocalDate }
type MovimientoRecurrenteRow = {
  id: string
  nombre: string
  monto_actual: number | string
  tipo: 'gasto' | 'ingreso' | 'ahorro'
  categoria_id: string | null
  dia_del_mes: number
  activo: boolean
  recordatorio_activo: boolean
  dias_antes: number
  repeticiones_totales: number | null
  repeticiones_insertadas: number
  tarjeta_id: string | null
  medio_pago: PaymentMethod | null
}
type TransaccionRow = {
  id: string
  monto: number | string
  fecha: string
  categoria_id: string | null
  descripcion: string | null
  tipo: 'gasto' | 'ingreso' | 'ahorro' | 'transferencia'
  movimiento_recurrente_id: string | null
  ciclo_mes: LocalDate | null
  estado: 'pendiente' | 'confirmada'
  /** How it was paid (0041); on a transfer, the pocket it enters. */
  medio_pago: PaymentMethod | null
  /** A charge marked not charged after its day (0037); absent on computed charges. */
  no_cobrado?: boolean
  /** A savings deposit the user already had (0033); absent on computed charges. */
  ahorro_previo?: boolean
  /** A charge `proyectarCiclo` computed for a projected cycle, not a stored row. */
  projected?: true
}

const DAY_MS = 86_400_000

function daysBetween(from: LocalDate, to: LocalDate): number {
  return Math.round((Date.parse(to) - Date.parse(from)) / DAY_MS)
}

/** Cycles between two cycle months, one cycle per month (`from` → `to`). */
function monthsBetween(from: string, to: string): number {
  const [fy, fm] = from.split('-').map(Number)
  const [ty, tm] = to.split('-').map(Number)
  return (ty - fy) * 12 + (tm - fm)
}

function inRange(fecha: string, range: CycleRange): boolean {
  const t = new Date(fecha).getTime()
  return t >= range.inicio.getTime() && t < range.fin.getTime()
}

/**
 * A charge shows as taken when it is confirmed or its local day is not after the cycle's today
 * (Q4): a pending charge whose day passed was, most likely, paid at that amount — unless the user
 * marked it not charged (`no_cobrado`, 0037).
 * `actualizar_movimiento_recurrente` (0021) rewrites only the charges this returns false for.
 */
function isCharged(row: Pick<TransaccionRow, 'estado' | 'no_cobrado' | 'fecha'>, timezone: string, today: LocalDate): boolean {
  return row.estado === 'confirmada' || (!row.no_cobrado && localDateOf(row.fecha, timezone) <= today)
}

/**
 * `DashboardData` and the recurring definitions of one billing cycle, read as `usuario`
 * (ARCHITECTURE §3). `month` is the raw `?mes=` value (`parseMonthParam`). A cycle after the one
 * in progress is a projection and writes nothing. Reading the cycle in progress may write: its
 * budget rows are copied from the latest earlier cycle the first time (`copiar_presupuestos_ciclo`).
 */
export async function resumenMensual(
  client: SupabaseClient,
  usuario: Usuario,
  month?: string | string[],
  /** The page passes the number people write to (`add-whatsapp-linking` D6); the bot passes nothing and reads no channel state. */
  whatsApp?: { number: string | null },
): Promise<{ data: DashboardData; definitions: RecurringDefinition[] }> {
  const timezone = usuario.timezone
  const now = new Date()
  const cycleParams = { diaInicio: usuario.dia_inicio_ciclo, timezone }

  const current = await cycleRange(client, { ...cycleParams, ref: now })
  const currentMonth = cycleMonthOf(current, timezone)
  const shownMonth = parseMonthParam(month, currentMonth)
  const projected = shownMonth > currentMonth
  // `history` is the six cycles ending at the shown one, or at the one in progress for a
  // projection, whose chart is not shown (D6).
  const months = [-5, -4, -3, -2, -1, 0].map((n) => shiftMonth(projected ? currentMonth : shownMonth, n))
  // The projected cycles between the one in progress and the shown one, for the accumulated balance.
  const between = projected
    ? Array.from({ length: monthsBetween(currentMonth, shownMonth) - 1 }, (_, n) => shiftMonth(currentMonth, n + 1))
    : []
  const [ranges, shown, generatedMonth, betweenRanges] = await Promise.all([
    Promise.all(months.map((m) => cycleRange(client, { ...cycleParams, ref: refInstantForMonth(m) }))),
    projected ? cycleRange(client, { ...cycleParams, ref: refInstantForMonth(shownMonth) }) : null,
    // The projection counts cycles from the last generated one; with no marker the cycle in
    // progress is still to generate, so it counts from the one before (D3).
    !projected
      ? null
      : usuario.ciclo_generado_hasta == null
        ? shiftMonth(currentMonth, -1)
        : cycleRange(client, { ...cycleParams, ref: new Date(`${usuario.ciclo_generado_hasta}T12:00:00Z`) }).then(
            (range) => cycleMonthOf(range, timezone),
          ),
    Promise.all(between.map((m) => cycleRange(client, { ...cycleParams, ref: refInstantForMonth(m) }))),
  ])
  const oldest = ranges[0]
  const latest = ranges[5]
  const shownRange = shown ?? latest

  const start = localDateOf(shownRange.inicio, timezone)
  const end = localDateOf(new Date(shownRange.fin.getTime() - 1), timezone)
  const localToday = localDateOf(now, timezone)
  const today = localToday < start ? start : localToday > end ? end : localToday
  const inProgress = shownRange.inicio.getTime() <= now.getTime() && now.getTime() < shownRange.fin.getTime()

  if (inProgress) {
    const { error } = await client.rpc('copiar_presupuestos_ciclo', { p_usuario_id: usuario.id })
    if (error) throw error
  }

  const presupuestosQuery = client.from('presupuestos').select('categoria_id, monto, periodo').eq('usuario_id', usuario.id)
  const [categorias, ocultas, presupuestos, definiciones, transacciones, ahorros, borrados, posteriores, movimientos, linked, tarjetas, marcados] = await Promise.all([
    client
      .from('categorias')
      .select('id, nombre, color, desde_ciclo, hasta_ciclo, mostrar_progreso')
      .eq('usuario_id', usuario.id)
      .order('orden')
      .order('nombre'),
    client.from('categorias_ocultas').select('categoria_id').eq('usuario_id', usuario.id).eq('periodo', start),
    projected ? presupuestosQuery.lte('periodo', start) : presupuestosQuery.eq('periodo', start),
    client
      .from('movimientos_recurrentes')
      .select(
        'id, nombre, monto_actual, tipo, categoria_id, dia_del_mes, activo, recordatorio_activo, dias_antes, repeticiones_totales, repeticiones_insertadas, tarjeta_id, medio_pago',
      )
      .eq('usuario_id', usuario.id)
      .order('orden')
      .order('nombre'),
    client
      .from('transacciones')
      .select('id, monto, fecha, categoria_id, descripcion, tipo, movimiento_recurrente_id, ciclo_mes, estado, no_cobrado, ahorro_previo, medio_pago')
      .eq('usuario_id', usuario.id)
      .is('borrado_en', null)
      .gte('fecha', oldest.inicio.toISOString())
      // Up to the shown cycle's end: `latest`'s for a past cycle, the projected one's for a projection.
      .lt('fecha', shownRange.fin.toISOString())
      .order('fecha'),
    client
      .from('transacciones')
      .select('monto, fecha, ahorro_previo')
      .eq('usuario_id', usuario.id)
      .eq('tipo', 'ahorro')
      .is('borrado_en', null)
      .lt('fecha', shownRange.fin.toISOString()),
    // A soft-deleted linked row still holds its definition's slot in this cycle (D1).
    projected
      ? client
          .from('transacciones')
          .select('movimiento_recurrente_id, ciclo_mes')
          .eq('usuario_id', usuario.id)
          .eq('ciclo_mes', start)
          .not('movimiento_recurrente_id', 'is', null)
          .not('borrado_en', 'is', null)
      : null,
    client
      .from('transacciones')
      .select('categoria_id')
      .eq('usuario_id', usuario.id)
      .eq('tipo', 'gasto')
      .is('borrado_en', null)
      .gte('fecha', shownRange.fin.toISOString()),
    // One existence check: whether the user holds any movement at all (the account sheet's warning).
    client.from('transacciones').select('usuario_id', { count: 'exact', head: true }).eq('usuario_id', usuario.id).is('borrado_en', null),
    whatsApp ? linkedChannel(client, 'whatsapp') : Promise.resolve(null),
    client.from('tarjetas').select('id, nombre, color').eq('usuario_id', usuario.id).order('creada_en'),
    // Whether the user holds a marked movement in any cycle (`payment-method` → *Who uses the feature*).
    client
      .from('transacciones')
      .select('usuario_id', { count: 'exact', head: true })
      .eq('usuario_id', usuario.id)
      .not('medio_pago', 'is', null)
      .is('borrado_en', null),
  ])
  for (const result of [categorias, ocultas, presupuestos, definiciones, transacciones, ahorros, borrados, posteriores, movimientos, tarjetas, marcados]) {
    if (result?.error) throw result.error
  }

  // Only the categories alive in the shown cycle (`category-editing` → *A category lives from its
  // first cycle to its last*): an ended one, one that starts later and one hidden here are left out.
  const hidden = new Set(((ocultas.data ?? []) as { categoria_id: string }[]).map((o) => o.categoria_id))
  const categoryRows = ((categorias.data ?? []) as CategoriaRow[]).filter((c) =>
    categoriaViva({ from: c.desde_ciclo, until: c.hasta_ciclo, hidden: hidden.has(c.id) ? [start] : [] }, start),
  )
  const deletedSlots = ((borrados?.data ?? []) as { movimiento_recurrente_id: string; ciclo_mes: LocalDate }[]).map((row) => ({
    definitionId: row.movimiento_recurrente_id,
    cycle: row.ciclo_mes,
  }))
  const laterByCategory = new Map<string, number>()
  for (const row of (posteriores.data ?? []) as { categoria_id: string | null }[]) {
    if (row.categoria_id) laterByCategory.set(row.categoria_id, (laterByCategory.get(row.categoria_id) ?? 0) + 1)
  }
  const budgetRows = (presupuestos.data ?? []) as PresupuestoRow[]
  const definitionRows = (definiciones.data ?? []) as MovimientoRecurrenteRow[]
  const rows = (transacciones.data ?? []) as TransaccionRow[]
  const savingsRows = (ahorros.data ?? []) as Pick<TransaccionRow, 'monto' | 'fecha' | 'ahorro_previo'>[]

  const definitions: RecurringDefinition[] = definitionRows
    .filter((d): d is MovimientoRecurrenteRow & { tipo: 'gasto' | 'ingreso' } => d.tipo !== 'ahorro')
    .map((d) => ({
      id: d.id,
      name: d.nombre,
      expectedAmount: Number(d.monto_actual),
      tipo: d.tipo,
      categoryId: d.categoria_id,
      day: d.dia_del_mes,
      active: d.activo,
      reminder: { active: d.recordatorio_activo, daysBefore: d.dias_antes },
      repetitions: d.repeticiones_totales == null ? null : { total: d.repeticiones_totales, done: d.repeticiones_insertadas },
      cardId: d.tarjeta_id,
      paymentMethod: d.medio_pago,
    }))

  // A projected cycle's charges come from `proyectarCiclo` as pending rows with synthetic ids, and
  // its budgets are inherited without writing (D6). Its real rows are listed beside them.
  const projection = projected
    ? proyectarCiclo({
        start,
        cyclesAfterGenerated: monthsBetween(generatedMonth!, shownMonth),
        definitions,
        budgetRows: budgetRows.map((b) => ({
          categoryId: b.categoria_id,
          cycle: b.periodo,
          amount: b.monto == null ? null : Number(b.monto),
        })),
        savingsTarget: usuario.meta_ahorro_mensual,
      })
    : null

  // A linked row's definition is always among these: deleting one unlinks its rows (0019).
  const dayOf = new Map(definitionRows.map((d) => [d.id, d.dia_del_mes]))
  const budgetOf =
    projection?.budgets ?? new Map(budgetRows.map((b) => [b.categoria_id, b.monto == null ? null : Number(b.monto)]))
  const realRows = rows.filter((row) => inRange(row.fecha, shownRange))
  // A real row linked to a definition for this cycle replaces that definition's charge (D1).
  const shownRows: TransaccionRow[] = projection
    ? [
        ...realRows,
        ...mezclarProyeccion({
          charges: projection.charges,
          rows: [...realRows.map((row) => ({ definitionId: row.movimiento_recurrente_id, cycle: row.ciclo_mes })), ...deletedSlots],
          start,
        }).map(
          (charge): TransaccionRow => ({
            id: `proj:${charge.definitionId}`,
            monto: charge.amount,
            fecha: `${charge.date}T12:00:00Z`,
            categoria_id: charge.categoryId,
            descripcion: charge.name,
            tipo: charge.tipo,
            movimiento_recurrente_id: charge.definitionId,
            ciclo_mes: start,
            estado: 'pendiente',
            medio_pago: charge.paymentMethod,
            projected: true,
          }),
        ),
      ].sort((a, b) => Date.parse(a.fecha) - Date.parse(b.fecha))
    : realRows

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
        paymentMethod: row.medio_pago,
        ...(row.movimiento_recurrente_id
          ? {
              fixed: {
                definitionId: row.movimiento_recurrente_id,
                day: dayOf.get(row.movimiento_recurrente_id)!,
                // In a projection only a confirmed row is taken: the cycle has not started, so its
                // clamped today says nothing about what was paid.
                charged: projected ? row.estado === 'confirmada' : isCharged(row, timezone, today),
              },
            }
          : {}),
        ...(row.projected ? { projected: true as const } : {}),
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
      rowsLater: laterByCategory.get(categoria.id) ?? 0,
      showProgress: categoria.mostrar_progreso,
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
      paymentMethod: row.medio_pago,
      ...(row.movimiento_recurrente_id
        ? {
            recurring: {
              definitionId: row.movimiento_recurrente_id,
              day: dayOf.get(row.movimiento_recurrente_id)!,
              charged: projected ? row.estado === 'confirmada' : isCharged(row, timezone, today),
            },
          }
        : {}),
      ...(row.projected ? { projected: true as const } : {}),
    }))
  const incomeTotal = incomeEntries.reduce((sum, entry) => sum + entry.amount, 0)

  const movements = shownRows
    .filter((row) => row.tipo === 'ahorro')
    .map((row) => ({
      id: row.id,
      name: row.descripcion ?? '',
      date: row.fecha,
      amount: Number(row.monto),
      ...(row.ahorro_previo ? { alreadySaved: true as const } : {}),
    }))
  // In a projection the savings target is an envelope, as a budget is for a category (D4). A
  // deposit the user already had stays out of both (`savings-editing` → *A deposit the user already had*).
  const shownSavings = splitSavings(movements)
  const savingsCycle = projection ? Math.max(projection.savings, shownSavings.counted) : shownSavings.counted

  const history = ranges.map((range, index) => ({
    month: months[index],
    total: rows
      .filter((row) => row.tipo === 'gasto' && inRange(row.fecha, range))
      .reduce((sum, row) => sum + Number(row.monto), 0),
  }))
  const incomeHistory = ranges.map((range, index) => ({
    month: months[index],
    total: rows
      .filter((row) => row.tipo === 'ingreso' && inRange(row.fecha, range))
      .reduce((sum, row) => sum + Number(row.monto), 0),
  }))
  // In a projection the balance runs to the shown cycle's end: the real rows up to the cycle in
  // progress, then each projected cycle's savings as that cycle would show them (target as envelope).
  const sumSavings = (from: number, to: number) =>
    splitSavings(
      savingsRows
        .filter((row) => from <= new Date(row.fecha).getTime() && new Date(row.fecha).getTime() < to)
        .map((row) => ({ amount: Number(row.monto), alreadySaved: row.ahorro_previo })),
    )
  const allSavings = (from: number, to: number) => {
    const { counted, alreadySaved } = sumSavings(from, to)
    return counted + alreadySaved
  }
  const projectedCycleSavings = (floor: number, from: number, to: number) => {
    const { counted, alreadySaved } = sumSavings(from, to)
    return Math.max(floor, counted) + alreadySaved
  }
  const accumulated = projection
    ? allSavings(-Infinity, latest.fin.getTime()) +
      betweenRanges.reduce((sum, range) => sum + projectedCycleSavings(projection.savings, range.inicio.getTime(), range.fin.getTime()), 0) +
      savingsCycle +
      shownSavings.alreadySaved
    : null
  const savingsHistory = ranges.map((range, index) => ({
    month: months[index],
    accumulated: savingsRows
      .filter((row) => new Date(row.fecha).getTime() < range.fin.getTime())
      .reduce((sum, row) => sum + Number(row.monto), 0),
  }))

  // The pockets (`payment-method` → *A pocket's balance*, D4): every marked row up to the shown
  // cycle's end, earlier cycles included. Not in a projection, not until the first mark, and never
  // for an account not offered the feature (D14), whose stored marks stay hidden.
  const offered = paymentMethodsOffered(usuario.pais, usuario.medio_pago_habilitado)
  const hasMarkedMovements = offered && (marcados.count ?? 0) > 0
  let pockets: Pockets | null = null
  if (hasMarkedMovements && !projected) {
    const { data: marked, error } = await client
      .from('transacciones')
      .select('id, tipo, monto, medio_pago, fecha, movimiento_recurrente_id, estado, no_cobrado')
      .eq('usuario_id', usuario.id)
      .not('medio_pago', 'is', null)
      .is('borrado_en', null)
      .lt('fecha', shownRange.fin.toISOString())
    if (error) throw error
    type MarkedRow = Pick<TransaccionRow, 'id' | 'tipo' | 'monto' | 'medio_pago' | 'fecha' | 'movimiento_recurrente_id' | 'estado' | 'no_cobrado'>
    const countedRows: CountedRow[] = []
    const allTransfers: Transfer[] = []
    for (const row of (marked ?? []) as MarkedRow[]) {
      if (row.tipo === 'transferencia') {
        allTransfers.push({ id: row.id, amount: Number(row.monto), into: row.medio_pago!, date: row.fecha })
      } else if (row.tipo === 'gasto' || row.tipo === 'ingreso') {
        countedRows.push({
          kind: row.tipo === 'gasto' ? 'expense' : 'income',
          amount: Number(row.monto),
          date: row.fecha,
          paymentMethod: row.medio_pago,
          ...(row.movimiento_recurrente_id ? { charged: isCharged(row, timezone, today) } : {}),
        })
      }
    }
    pockets = {
      ...pocketBalances({ rows: countedRows, transfers: allTransfers, cycle: { start, end, today }, timeZone: timezone }),
      transfers: allTransfers.filter((transfer) => inRange(transfer.date, shownRange)),
    }
  }

  return {
    data: {
      user: {
        name: usuario.nombre,
        phone: usuario.telefono,
        photoUrl: usuario.foto_url,
        currency: usuario.moneda_default,
        timezone,
        widgetOrder: normalizeWidgetOrder(usuario.orden_widgets),
        country: usuario.pais,
        amountFormat: effectiveAmountFormat(usuario),
        cycleDay: usuario.dia_inicio_ciclo,
        hasMovements: (movimientos.count ?? 0) > 0,
        defaultPaymentMethod: usuario.medio_pago_default,
        hasMarkedMovements,
        paymentMethodsOffered: offered,
        ...(whatsApp
          ? {
              whatsapp: {
                number: whatsApp.number,
                code: linkCodeIsLive(usuario.codigo_vinculacion, usuario.whatsapp_solicitado_en) ? usuario.codigo_vinculacion : null,
                linked,
              },
            }
          : {}),
      },
      cycle: {
        start,
        end,
        today,
        month: shownMonth,
        inProgress,
        projected,
        currentMonth,
        maxMonth: shiftMonth(currentMonth, PROJECTION_HORIZON),
      },
      freeMargin: getFreeMargin({
        income: incomeTotal,
        savings: savingsCycle,
        categories: groups.map((group) => ({ budget: group.budget?.amount ?? null, spent: group.total })),
      }),
      income: { total: incomeTotal, entries: incomeEntries, history: incomeHistory },
      savings: {
        cycle: savingsCycle,
        accumulated: accumulated ?? savingsHistory[5].accumulated,
        target: usuario.meta_ahorro_mensual,
        history: savingsHistory,
        movements,
      },
      expenses: { total: expensesTotal, groups },
      history,
      cards: ((tarjetas.data ?? []) as { id: string; nombre: string; color: CategoryColor }[]).map((t) => ({
        id: t.id,
        name: t.nombre,
        color: t.color,
      })),
      pockets,
    },
    definitions,
  }
}
