/**
 * Bot logic. **Knows nothing about WhatsApp** (ARCHITECTURE.md §3): it
 * receives the internal format and decides *what* to reply. The *how* — text
 * or reaction, depending on progressive confirmation — is decided by the
 * adapter.
 *
 * If Telegram or Signal gets added tomorrow, this file doesn't change.
 */

import { createTranslator } from 'next-intl'

import { supabaseAdmin } from '@/lib/supabase/admin'
import type { Channel } from '@/lib/data/users'
import type { DataContext } from '@/lib/data/supabase/context'
import { cycleRange, localDateOf } from '@/lib/data/supabase/cycle'
import { loadBotContext, normalizeName, type BotCategory, type BotContext, type BotRecurring } from '@/lib/data/supabase/bot'
import { createSupabaseExpenseMutations } from '@/lib/data/supabase/expenses'
import { createSupabaseIncomeMutations } from '@/lib/data/supabase/income'
import { createSupabaseSavingsMutations } from '@/lib/data/supabase/savings'
import { findUsuarioById, type Usuario } from '@/lib/data/supabase/user'
import es from '@/messages/es.json'
import en from '@/messages/en.json'
import { daysBefore, formatBotAmount, formatBotDay } from './format'
import { createGeminiModel } from './gemini'
import { parseMessage, type Action, type PendingQuestion } from './parser'

export type IncomingMessage = {
  userId: string
  text: string
  messageId: string
  channel: Channel
  /** The channel's unexpired category question, read by the adapter (design D7). */
  pending?: PendingQuestion
}

export type BotReply =
  | { kind: 'text'; text: string }
  | { kind: 'none' }
  | {
      /** A category question: the adapter holds `pending` on the channel for 30 minutes, then sends `text`. */
      kind: 'ask'
      text: string
      pending: PendingQuestion
    }
  | {
      /**
       * `recurring-expenses` → *The bot asks whether a change is permanent, and the adapter
       * owns the answer*. Returned once this cycle's pending charge for `definitionId` has
       * already been completed and confirmed at `loadedAmount` — this reply only *reports*
       * that it differs from the definition's `expectedAmount`. It decides nothing: no
       * question is asked and no definition is updated here. That belongs to the adapter
       * (`lib/whatsapp/adapter.ts`), which owns the conversation's state across turns.
       * `text` is the ordinary confirmation, sent now.
       */
      kind: 'recurring-discrepancy'
      text: string
      definitionId: string
      definitionName: string
      expectedAmount: number
      loadedAmount: number
    }

const MESSAGES = { es, en }

type Cargar = Extract<Action, { accion: 'cargar' }>

/** Everything one message is handled with, loaded once (design D9). */
type Turn = {
  message: IncomingMessage
  usuario: Usuario
  context: BotContext
  data: DataContext
  today: string
  t: ReturnType<typeof createTranslator<typeof es, 'bot'>>
}

export async function processMessage(message: IncomingMessage): Promise<BotReply> {
  // TODO: intercept the user with `onboarding_completo = false` and trigger
  // the wizard before parsing anything (§11).
  const client = supabaseAdmin()
  const [usuario, context] = await Promise.all([
    findUsuarioById(client, message.userId),
    loadBotContext(client, message.userId),
  ])
  if (!usuario) throw new Error('not-found')

  const locale = usuario.idioma
  const turn: Turn = {
    message,
    usuario,
    context,
    data: {
      client,
      usuarioId: usuario.id,
      currency: usuario.moneda_default,
      timezone: usuario.timezone,
      origin: { channel: message.channel, externalMessageId: message.messageId },
    },
    today: localDateOf(new Date(), usuario.timezone),
    t: createTranslator({ locale, messages: MESSAGES[locale], namespace: 'bot' }),
  }

  const action = await parseMessage(
    {
      text: message.text,
      categories: context.categories.map((category) => category.nombre),
      recurringNames: context.recurring.map((definition) => definition.nombre),
      locale,
      today: turn.today,
      pending: message.pending,
    },
    createGeminiModel(),
  )

  switch (action.accion) {
    case 'cargar':
      return load(turn, action)
    case 'repreguntar':
      return ask(turn, { tipo: action.tipo, monto: action.monto, diasAtras: action.dias_atras })
    case 'no_entendido':
      return { kind: 'text', text: turn.t('noEntendi') }
    default:
      // consultar, corregir, borrar, crear_categoria: `add-bot-conversation`.
      return { kind: 'text', text: turn.t('todaviaNo') }
  }
}

function ask({ t, context }: Turn, pending: PendingQuestion): BotReply {
  const categorias = context.categories.map((category) => category.nombre).join(', ')
  return { kind: 'ask', text: t('preguntaCategoria', { categorias }), pending }
}

async function load(turn: Turn, action: Cargar): Promise<BotReply> {
  const { usuario, data, today, t } = turn
  const locale = usuario.idioma
  const date = daysBefore(today, action.dias_atras)
  const amount = Math.abs(action.monto)
  const monto = formatBotAmount(locale, usuario.moneda_default, amount)
  const dia = formatBotDay(locale, today, date, t)

  if (action.tipo === 'ingreso') {
    await createSupabaseIncomeMutations(data).create({ amount, date, description: action.descripcion ?? '' })
    return { kind: 'text', text: t('confirmacionIngreso', { monto, dia }) }
  }

  if (action.tipo === 'ahorro') {
    const withdrawal = action.monto < 0
    const resumen = createTranslator({ locale, messages: MESSAGES[locale], namespace: 'resumen' })
    await createSupabaseSavingsMutations(data).addSavingsMovement({
      kind: withdrawal ? 'withdrawal' : 'deposit',
      amount,
      date,
      name: action.descripcion ?? resumen(withdrawal ? 'retiro' : 'deposito'),
    })
    return { kind: 'text', text: t(withdrawal ? 'confirmacionRetiro' : 'confirmacionAhorro', { monto, dia }) }
  }

  const definition = action.recurrente ? findByName(turn.context.recurring, action.recurrente) : undefined
  if (definition) {
    const reply = await completeRecurring(turn, definition, action.monto, date, { monto, dia })
    if (reply) return reply
  }

  // A plan that ended (or vanished) since the context was read is loaded as an ordinary expense in
  // its category, under its name: the payment is real (design D6).
  const category = definition
    ? turn.context.categories.find((c) => c.id === definition.categoria_id)
    : findCategory(turn.context.categories, action.categoria)
  if (!category) return ask(turn, { tipo: 'gasto', monto: action.monto, diasAtras: action.dias_atras })

  await createSupabaseExpenseMutations(data).create(category.id, {
    amount,
    date,
    description: definition?.nombre ?? action.descripcion ?? '',
  })
  return { kind: 'text', text: t('confirmacionGasto', { monto, categoria: category.nombre, dia }) }
}

/**
 * Completes this cycle's charge of `definition` (design D6). Null when the plan ended or the
 * definition is gone, so the caller loads an ordinary expense.
 */
async function completeRecurring(
  { usuario, data, message, context, t }: Turn,
  definition: BotRecurring,
  amount: number,
  date: string,
  values: { monto: string; dia: string },
): Promise<BotReply | null> {
  const range = await cycleRange(data.client, {
    diaInicio: usuario.dia_inicio_ciclo,
    timezone: usuario.timezone,
    ref: new Date(`${date}T12:00:00Z`),
  })

  const { error } = await data.client.rpc('completar_cargo_recurrente', {
    p_usuario_id: usuario.id,
    p_movimiento_id: definition.id,
    p_periodo: localDateOf(range.inicio, usuario.timezone),
    p_monto: amount,
    p_fecha: date,
    p_canal: message.channel,
    p_mensaje_id_externo: message.messageId,
  })

  if (error) {
    if (error.message === 'already-confirmed') return { kind: 'text', text: t('yaCargado', { nombre: definition.nombre }) }
    if (error.message === 'plan-completed' || error.message === 'not-found') return null
    throw new Error(error.message)
  }

  const categoria = context.categories.find((c) => c.id === definition.categoria_id)?.nombre ?? definition.nombre
  const text = t('confirmacionGasto', { ...values, categoria })
  if (amount === definition.monto_actual) return { kind: 'text', text }

  return {
    kind: 'recurring-discrepancy',
    text,
    definitionId: definition.id,
    definitionName: definition.nombre,
    expectedAmount: definition.monto_actual,
    loadedAmount: amount,
  }
}

/** The parsed category by name (case and accents ignored), else "Otros", else none (spec). */
function findCategory(categories: BotCategory[], name: string | null): BotCategory | undefined {
  return (name ? findByName(categories, name) : undefined) ?? findByName(categories, 'Otros')
}

function findByName<T extends { nombre: string }>(rows: T[], name: string): T | undefined {
  const key = normalizeName(name)
  return rows.find((row) => normalizeName(row.nombre) === key)
}

/**
 * First contact from an identifier that isn't linked to any account. **Not silently
 * ignored** (§4): the invitation code is requested when `inviteRequired` is true (the
 * `WHATSAPP_REQUIRE_INVITE` switch, `separate-identity-from-channel`), and the three possible
 * errors — doesn't exist, already used, expired — are distinguished in the message, in case
 * the person doesn't know if the problem is the code or their number.
 */
export async function processUnknownNumber({
  channel,
  externalId,
  text,
  inviteRequired,
}: {
  channel: Channel
  externalId: string
  text: string
  inviteRequired: boolean
}): Promise<BotReply> {
  // TODO: validate the code against `invitaciones`, burn it (`usada_por` +
  // `usada_en`) and start onboarding: name → country → cycle day → test
  // expense (§4). Only when inviteRequired is true; skipping it entirely once the switch is
  // off is also part of this TODO.
  // TODO: rate limit attempts per number before touching the database, or
  // codes can be brute-forced (§10).
  //
  // Doesn't return the code request yet because the bot's texts live in
  // translation files, not embedded here (§2), and that piece isn't built.
  void channel
  void externalId
  void text
  void inviteRequired
  return { kind: 'none' }
}
