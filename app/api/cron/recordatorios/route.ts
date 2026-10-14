import type { NextRequest } from 'next/server'

import { REMINDER_TEMPLATES, dueReminders, reminderParams, type ReminderDefinition, type SlotRow } from '@/lib/bot/reminders'
import { daysBefore } from '@/lib/bot/format'
import { effectiveAmountFormat, type AmountFormat } from '@/lib/data/amount-format'
import type { LocalDate } from '@/lib/data/expenses'
import { localDateOf } from '@/lib/data/supabase/cycle'
import { DEFINITION_COLUMNS, futureCycles, toDefinition } from '@/lib/data/supabase/future-cycles'
import { supabaseAdmin } from '@/lib/supabase/admin'
import { sendTemplate } from '@/lib/whatsapp/send'
import { safeCompare } from '@/lib/whatsapp/signature'

/**
 * Daily reminder job (ARCHITECTURE.md §14.1), scheduled by `vercel.json` apart from the charges
 * job so it runs at an hour that is daytime in Spain and in Argentina. Per account with a WhatsApp
 * channel: the expense definitions with their reminder on, the charges `dueReminders` picks, and
 * per charge the `recordatorio_cobro_<idioma>` template. The marker
 * (`recordatorio_enviado_para`, migration 0035) is claimed before the send and given back if it
 * fails, so a repeated run never reminds twice and a failed send is retried the next day.
 */

type ChannelRow = {
  identificador_externo: string
  usuarios: {
    id: string
    idioma: 'es' | 'en'
    timezone: string
    moneda_default: string
    pais: string | null
    formato_montos: AmountFormat
  }
}
type Usuario = ChannelRow['usuarios']
type UserReport = { id: string; sent: number; failed: number } | { id: string; error: string }

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
  const { data, error } = await client
    .from('canales')
    .select('identificador_externo, usuarios(id, idioma, timezone, moneda_default, pais, formato_montos)')
    .eq('tipo', 'whatsapp')
  if (error) {
    console.error('[cron] reading canales failed', error.message)
    return Response.json({ error: 'canales' }, { status: 500 })
  }

  const users: UserReport[] = []
  for (const channel of (data ?? []) as unknown as ChannelRow[]) {
    try {
      users.push(await runForUser(client, channel.usuarios, channel.identificador_externo))
    } catch (err) {
      users.push({ id: channel.usuarios.id, error: err instanceof Error ? err.message : String(err) })
    }
  }

  console.log('[cron] recordatorios', JSON.stringify({ users }))
  return Response.json({ users })
}

async function runForUser(client: ReturnType<typeof supabaseAdmin>, usuario: Usuario, phone: string): Promise<UserReport> {
  const { data, error } = await client
    .from('movimientos_recurrentes')
    .select(`${DEFINITION_COLUMNS}, recordatorio_enviado_para`)
    .eq('usuario_id', usuario.id)
    .eq('tipo', 'gasto')
    .eq('activo', true)
    .eq('recordatorio_activo', true)
  if (error) throw new Error(error.message)
  if (!data?.length) return { id: usuario.id, sent: 0, failed: 0 }

  const definitions: ReminderDefinition[] = data.map((d) => ({ ...toDefinition(d), remindedFor: d.recordatorio_enviado_para }))
  const today = localDateOf(new Date(), usuario.timezone)
  const furthest = definitions.reduce<LocalDate>((last, d) => {
    const day = daysBefore(today, -d.reminder.daysBefore)
    return day > last ? day : last
  }, today)

  const { current, currentAfterGenerated, cycles } = await futureCycles(
    { client, usuarioId: usuario.id, currency: usuario.moneda_default, timezone: usuario.timezone },
    furthest,
  )
  const allCycles = [{ start: current, cyclesAfterGenerated: currentAfterGenerated }, ...cycles]

  const slots = await client
    .from('transacciones')
    .select('movimiento_recurrente_id, ciclo_mes, estado, borrado_en, monto, fecha')
    .eq('usuario_id', usuario.id)
    .in('movimiento_recurrente_id', definitions.map((d) => d.id))
    .in('ciclo_mes', allCycles.map((c) => c.start))
  if (slots.error) throw new Error(slots.error.message)
  const rows: SlotRow[] = slots.data.map((t) => ({
    definitionId: t.movimiento_recurrente_id,
    cycle: t.ciclo_mes,
    pending: t.estado === 'pendiente' && t.borrado_en == null,
    amount: Number(t.monto),
    date: localDateOf(t.fecha, usuario.timezone),
  }))

  const format = {
    locale: usuario.idioma,
    currency: usuario.moneda_default,
    amountFormat: effectiveAmountFormat(usuario),
    today,
  }
  let sent = 0
  let failed = 0
  for (const reminder of dueReminders({ today, definitions, cycles: allCycles, rows })) {
    // Claim: only while the marker is still the one read, so a concurrent run sends nothing.
    const claim = await client
      .from('movimientos_recurrentes')
      .update({ recordatorio_enviado_para: reminder.date })
      .eq('id', reminder.definitionId)
      .or(reminder.remindedFor == null ? 'recordatorio_enviado_para.is.null' : `recordatorio_enviado_para.eq.${reminder.remindedFor}`)
      .select('id')
    if (claim.error) throw new Error(claim.error.message)
    if (claim.data.length === 0) continue

    const template = REMINDER_TEMPLATES[usuario.idioma]
    if (await sendTemplate(phone, template, usuario.idioma, reminderParams(format, reminder))) {
      sent++
      continue
    }

    failed++
    const release = await client
      .from('movimientos_recurrentes')
      .update({ recordatorio_enviado_para: reminder.remindedFor })
      .eq('id', reminder.definitionId)
      .eq('recordatorio_enviado_para', reminder.date)
    if (release.error) console.error('[cron] releasing reminder failed', reminder.definitionId, release.error.message)
  }

  return { id: usuario.id, sent, failed }
}
