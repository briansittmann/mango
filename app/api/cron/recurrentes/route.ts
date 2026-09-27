import type { NextRequest } from 'next/server'

import type { LocalDate } from '@/lib/data/expenses'
import { proyectarCiclo } from '@/lib/data/projection'
import type { RecurringDefinition } from '@/lib/data/recurring'
import { cycleRange, localDateOf } from '@/lib/data/supabase/cycle'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { safeCompare } from '@/lib/whatsapp/signature'

/**
 * Daily recurring-charge job (`recurring-charge-generation`, design D2), scheduled by
 * `vercel.json`. Per user: generates, in order, every cycle after `ciclo_generado_hasta` up to
 * the cycle in progress — the charges come from `proyectarCiclo`, the writes from
 * `generar_ciclo` — then closes the pending charges of ended cycles (`cerrar_pendientes`).
 * Safe to run any number of times: a generated cycle is a no-op in `generar_ciclo`.
 */

type UsuarioRow = {
  id: string
  timezone: string
  dia_inicio_ciclo: number
  ciclo_generado_hasta: string | null
}
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
}
type UserReport = { id: string; generated: LocalDate[]; inserted: number; closed: number } | { id: string; error: string }

// A long outage is still caught up, but a bad marker can never loop forever.
const MAX_CYCLES_PER_RUN = 24

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET
  if (!secret) {
    console.error('[cron] missing CRON_SECRET')
    return new Response('Server misconfigured', { status: 500 })
  }
  if (!safeCompare(request.headers.get('authorization') ?? '', `Bearer ${secret}`)) {
    return new Response('Unauthorized', { status: 401 })
  }
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY || !process.env.NEXT_PUBLIC_SUPABASE_URL) {
    console.error('[cron] missing SUPABASE_SERVICE_ROLE_KEY or NEXT_PUBLIC_SUPABASE_URL')
    return new Response('Server misconfigured', { status: 500 })
  }

  const client = supabaseAdmin()
  const { data, error } = await client.from('usuarios').select('id, timezone, dia_inicio_ciclo, ciclo_generado_hasta')
  if (error) {
    console.error('[cron] reading usuarios failed', error.message)
    return Response.json({ error: 'usuarios' }, { status: 500 })
  }

  const users: UserReport[] = []
  for (const usuario of (data ?? []) as UsuarioRow[]) {
    try {
      users.push(await runForUser(client, usuario))
    } catch (err) {
      users.push({ id: usuario.id, error: err instanceof Error ? err.message : String(err) })
    }
  }

  console.log('[cron] recurrentes', JSON.stringify({ users }))
  return Response.json({ users })
}

async function runForUser(client: ReturnType<typeof supabaseAdmin>, usuario: UsuarioRow): Promise<UserReport> {
  const cycleParams = { diaInicio: usuario.dia_inicio_ciclo, timezone: usuario.timezone }
  const current = await cycleRange(client, { ...cycleParams, ref: new Date() })
  const currentStart = localDateOf(current.inicio, usuario.timezone)

  // Cycles to generate: the one after the marker up to the cycle in progress; with no marker,
  // the cycle in progress alone.
  const pending: LocalDate[] = []
  if (usuario.ciclo_generado_hasta == null) {
    pending.push(currentStart)
  } else {
    let range = await cycleRange(client, { ...cycleParams, ref: new Date(`${usuario.ciclo_generado_hasta}T12:00:00Z`) })
    while (pending.length < MAX_CYCLES_PER_RUN) {
      range = await cycleRange(client, { ...cycleParams, ref: range.fin })
      const start = localDateOf(range.inicio, usuario.timezone)
      if (start > currentStart) break
      pending.push(start)
    }
  }

  let inserted = 0
  for (const start of pending) {
    // Re-read every cycle: the previous generation moved the counts and may have ended a plan.
    const { data, error } = await client
      .from('movimientos_recurrentes')
      .select(
        'id, nombre, monto_actual, tipo, categoria_id, dia_del_mes, activo, recordatorio_activo, dias_antes, repeticiones_totales, repeticiones_insertadas',
      )
      .eq('usuario_id', usuario.id)
    if (error) throw new Error(error.message)

    const definitions: RecurringDefinition[] = ((data ?? []) as MovimientoRecurrenteRow[])
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
        repetitions:
          d.repeticiones_totales == null ? null : { total: d.repeticiones_totales, done: d.repeticiones_insertadas },
      }))

    const { charges } = proyectarCiclo({
      start,
      cyclesAfterGenerated: 1,
      definitions,
      budgetRows: [],
      savingsTarget: null,
    })

    const result = await client.rpc('generar_ciclo', {
      p_usuario_id: usuario.id,
      p_periodo: start,
      p_cargos: charges.map((charge) => ({
        movimiento_recurrente_id: charge.definitionId,
        monto: charge.amount,
        fecha: charge.date,
      })),
    })
    if (result.error) throw new Error(result.error.message)
    inserted += Number(result.data ?? 0)
  }

  const closed = await client.rpc('cerrar_pendientes', { p_usuario_id: usuario.id })
  if (closed.error) throw new Error(closed.error.message)

  return { id: usuario.id, generated: pending, inserted, closed: Number(closed.data ?? 0) }
}
