import type { SupabaseClient } from '@supabase/supabase-js'
import { categoriaViva } from '@/lib/data/categories'
import type { CategoryColor } from '@/lib/data/dashboard'
import type { LocalDate } from '@/lib/data/expenses'
import type { OnboardingData } from '@/lib/data/onboarding'
import { proyectarCiclo } from '@/lib/data/projection'
import type { DataContext } from './context'
import { cycleRange, localDateOf } from './cycle'
import { DEFINITION_COLUMNS, futureCycles, toDefinition } from './future-cycles'
import { hasData, linkCodeIsLive, linkedChannel } from './profile'
import type { Usuario } from './user'

type CategoriaRow = { id: string; nombre: string; color: CategoryColor; desde_ciclo: LocalDate | null; hasta_ciclo: LocalDate | null }

/**
 * What `/onboarding` renders from (D2), read as `usuario`: the profile, the cycle in progress, the
 * categories alive in it, the definitions, the cycle's budget rows, whether anything is keyed
 * to the cycle yet (D6) and the WhatsApp channel's state; `whatsAppNumber` is the number people
 * write to, read from the environment by the page (`add-whatsapp-linking` D6).
 */
export async function loadOnboardingData(client: SupabaseClient, usuario: Usuario, whatsAppNumber: string | null): Promise<OnboardingData> {
  const ctx: DataContext = { client, usuarioId: usuario.id, currency: usuario.moneda_default, timezone: usuario.timezone }
  const now = new Date()
  const range = await cycleRange(client, { diaInicio: usuario.dia_inicio_ciclo, timezone: usuario.timezone, ref: now })
  const start = localDateOf(range.inicio, usuario.timezone)
  const today = localDateOf(now, usuario.timezone)

  const [categorias, ocultas, definiciones, presupuestos, keyed, linked] = await Promise.all([
    client.from('categorias').select('id, nombre, color, desde_ciclo, hasta_ciclo').eq('usuario_id', usuario.id).order('orden').order('nombre'),
    client.from('categorias_ocultas').select('categoria_id').eq('usuario_id', usuario.id).eq('periodo', start),
    client.from('movimientos_recurrentes').select(DEFINITION_COLUMNS).eq('usuario_id', usuario.id).in('tipo', ['gasto', 'ingreso']).order('orden').order('nombre'),
    client.from('presupuestos').select('categoria_id, monto').eq('usuario_id', usuario.id).eq('periodo', start),
    hasData(ctx),
    linkedChannel(client, 'whatsapp'),
  ])
  for (const result of [categorias, ocultas, definiciones, presupuestos]) if (result.error) throw new Error(result.error.message)

  const hidden = new Set(((ocultas.data ?? []) as { categoria_id: string }[]).map((row) => row.categoria_id))
  const categories = ((categorias.data ?? []) as CategoriaRow[])
    .filter((row) => categoriaViva({ from: row.desde_ciclo, until: row.hasta_ciclo, hidden: hidden.has(row.id) ? [start] : [] }, start))
    .map((row) => ({ id: row.id, name: row.nombre, color: row.color }))
  const budgets: Record<string, number | null> = {}
  for (const row of (presupuestos.data ?? []) as { categoria_id: string; monto: number | string | null }[]) {
    budgets[row.categoria_id] = row.monto == null ? null : Number(row.monto)
  }

  return {
    step: usuario.onboarding_paso,
    profile: {
      name: usuario.nombre,
      country: usuario.pais,
      currency: usuario.moneda_default,
      timezone: usuario.timezone,
      cycleDay: usuario.dia_inicio_ciclo,
      amountFormat: usuario.formato_montos,
      savingsTarget: usuario.meta_ahorro_mensual,
      phone: usuario.telefono,
    },
    cycle: { start, today },
    categories,
    definitions: (definiciones.data ?? []).map(toDefinition),
    budgets,
    hasData: keyed,
    whatsapp: {
      number: whatsAppNumber,
      code: linkCodeIsLive(usuario.codigo_vinculacion, usuario.whatsapp_solicitado_en) ? usuario.codigo_vinculacion : null,
      linked,
    },
  }
}

/**
 * Gives every active definition its pending charge of the cycle in progress (`onboarding` →
 * *Income and fixed expenses step, and the charges of the cycle in progress*, D9): the charges are
 * computed with `proyectarCiclo`, as the cron computes `p_cargos`, and `insertar_cargos_pendientes`
 * (0029) inserts the ones whose slot is free, counting a repetition only in a cycle the cron already
 * generated. Idempotent: a second call inserts nothing. Never touches the generation marker.
 */
export async function materializeCurrentCycle(ctx: DataContext): Promise<void> {
  const { client, usuarioId } = ctx
  const { data, error } = await client
    .from('movimientos_recurrentes')
    .select(DEFINITION_COLUMNS)
    .eq('usuario_id', usuarioId)
    .eq('activo', true)
    .in('tipo', ['gasto', 'ingreso'])
  if (error) throw new Error(error.message)

  const definitions = (data ?? []).map(toDefinition)
  if (definitions.length === 0) return

  const { current, currentAfterGenerated } = await futureCycles(ctx, current => current)
  const { charges } = proyectarCiclo({
    start: current,
    cyclesAfterGenerated: currentAfterGenerated,
    definitions,
    budgetRows: [],
    savingsTarget: null,
  })

  const inserted = await client.rpc('insertar_cargos_pendientes', {
    p_usuario_id: usuarioId,
    p_periodo: current,
    p_cargos: charges.map((charge) => ({ movimiento_recurrente_id: charge.definitionId, monto: charge.amount, fecha: charge.date })),
  })
  if (inserted.error) throw new Error(inserted.error.message)
}
