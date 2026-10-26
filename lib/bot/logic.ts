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
import { effectiveAmountFormat } from '@/lib/data/amount-format'
import { recordBotEvent } from '@/lib/data/bot-events'
import { CATEGORY_COLORS, DUPLICATE_CATEGORY_NAME } from '@/lib/data/categories'
import { recentMessages, storeExchange, type StoredMessage } from '@/lib/data/messages'
import { fechaEnCiclo } from '@/lib/data/projection'
import type { Channel } from '@/lib/data/users'
import { expectRows, type DataContext } from '@/lib/data/supabase/context'
import { cycleRange, localDateOf } from '@/lib/data/supabase/cycle'
import { loadBotContext, normalizeName, similarCategory, type BotCategory, type BotContext, type BotRecurring } from '@/lib/data/supabase/bot'
import { createSupabaseCategoryMutations } from '@/lib/data/supabase/categories'
import { resumenMensual } from '@/lib/data/supabase/dashboard'
import { createSupabaseExpenseMutations } from '@/lib/data/supabase/expenses'
import { createSupabaseIncomeMutations } from '@/lib/data/supabase/income'
import { createSupabaseSavingsMutations } from '@/lib/data/supabase/savings'
import { createSupabaseTransferMutations } from '@/lib/data/supabase/transfers'
import { paymentMethodsOffered, type PaymentMethod } from '@/lib/data/payment-method'
import { findUsuarioById, type Usuario } from '@/lib/data/supabase/user'
import { SITE_URL } from '@/lib/metadata'
import es from '@/messages/es.json'
import en from '@/messages/en.json'
import {
  confirmationText,
  daysBefore,
  formatBotAmount,
  formatBotDay,
  loadIcon,
  topCategories,
  type BotFormat,
  type BotTranslate,
  type LoadBudget,
  type LoadSummary,
} from './format'
import { refuseVoiceNote } from './audio'
import { createGeminiModel } from './gemini'
import { parseMessage, type Action, type ParseResult, type PendingQuestion } from './parser'

/**
 * A voice note as the adapter hands it over (`add-voice-messages` D1): the bytes and their MIME
 * type, or why the adapter could not fetch them. Never a media id or a URL.
 */
export type IncomingAudio = { data: Uint8Array; mimeType: string } | { error: 'download' | 'too-large' }

export type IncomingMessage = {
  userId: string
  /** Empty for a button press and for a voice note. */
  text: string
  /** Set for a voice note; the logic measures it, parses it and quotes what was heard (D3, D5). */
  audio?: IncomingAudio
  messageId: string
  channel: Channel
  /** The channel's unexpired question, read by the adapter (design D5). */
  pending?: PendingQuestion
  /** The channel's last load (`canales.ultima_carga_id`, design D1): what `borrar` and `corregir` act on. */
  lastLoadId?: string
  /** The row an Undo button names (design D2): the parser is skipped and that row is deleted. */
  undoId?: string
  /**
   * A pressed answer to the pending question, and the parser is skipped: the deposit question
   * (`payment-method`, D10) writes the pending amount as a transfer from cash or as a new income;
   * the repeated fixed charge writes it as a separate expense, or nothing.
   */
  answer?: QuestionAnswer
}

/**
 * What a question's buttons stand for: cash moved into the bank or new money (the deposit), a
 * separate payment or the same one (a fixed charge already charged this cycle).
 */
export type QuestionAnswer = 'transfer' | 'income' | 'repeat' | 'same'

/** Each answer's button label, also how a press is stored in a VIP history. */
const ANSWER_LABELS = {
  transfer: 'botonDesdeEfectivo',
  income: 'botonIngresoNuevo',
  repeat: 'botonCargarAparte',
  same: 'botonEraEse',
} as const

export type BotReply = (
  | { kind: 'text'; text: string }
  | { kind: 'none' }
  | {
      /** The model never answered: nothing was written, and the adapter keeps any pending question for the retry. */
      kind: 'unavailable'
      text: string
    }
  | {
      /** A question: the adapter holds `pending` on the channel for 30 minutes, then sends `text`. */
      kind: 'ask'
      text: string
      pending: PendingQuestion
      /** Reply buttons, by the answer each stands for; the adapter builds the platform's. */
      buttons?: { answer: QuestionAnswer; label: string }[]
    }
  | {
      /**
       * A movement was written or completed (design D5). `icon` is the confirmation's emoji, the
       * reaction when the adapter confirms with one. `alwaysText` asks for text whatever the
       * count: the load answered a category question, or a recurring amount differs and `text`
       * carries the note that only this cycle changed.
       */
      kind: 'loaded'
      text: string
      icon: string
      transactionId: string
      alwaysText: boolean
    }
) & {
  /** How the channel's last load changes (design D1): undefined keeps it, null clears it, an id replaces it. */
  lastLoad?: string | null
}

/** How a button press is stored in a VIP history (design D8). */
const UNDO_TEXT = '↩︎ Deshacer'

const MESSAGES = { es, en }

type Cargar = Extract<Action, { accion: 'cargar' }>
type Repreguntar = Extract<Action, { accion: 'repreguntar' }>
type Corregir = Extract<Action, { accion: 'corregir' }>
type CrearCategoria = Extract<Action, { accion: 'crear_categoria' }>

/** Everything one message is handled with, loaded once (design D9). */
type Turn = {
  message: IncomingMessage
  usuario: Usuario
  context: BotContext
  data: DataContext
  fmt: BotFormat
  t: ReturnType<typeof createTranslator<typeof es, 'bot'>>
}

export async function processMessage(message: IncomingMessage): Promise<BotReply> {
  const started = performance.now()
  // TODO: intercept the user with `onboarding_completo = false` and trigger
  // the wizard before parsing anything (§11).
  const client = supabaseAdmin()
  const [usuario, context] = await Promise.all([
    findUsuarioById(client, message.userId),
    loadBotContext(client, message.userId),
  ])
  if (!usuario) throw new Error('not-found')

  const locale = usuario.idioma
  const t = createTranslator({ locale, messages: MESSAGES[locale], namespace: 'bot' })
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
    fmt: {
      locale,
      currency: usuario.moneda_default,
      amountFormat: effectiveAmountFormat(usuario),
      today: localDateOf(new Date(), usuario.timezone),
      t: t as BotTranslate,
    },
    t,
  }

  if (message.undoId) {
    const reply = await undo(turn, message.undoId)
    await Promise.all([remember(turn, UNDO_TEXT, reply), record(turn, 'deshacer', started)])
    return reply
  }

  if (message.answer) {
    const reply = await (message.answer === 'repeat' || message.answer === 'same'
      ? answerRepeated(turn, message.answer)
      : answerDeposit(turn, message.answer))
    await Promise.all([remember(turn, t(ANSWER_LABELS[message.answer]), reply), record(turn, `boton_${message.answer}`, started)])
    return reply
  }

  const history = usuario.vip ? await recentMessages(usuario.id) : undefined
  const { reply, heard, action } = await answer(turn, history)
  // For a voice note the stored incoming text is the transcription, '🎤' alone when there is none; never the bytes (D6).
  await Promise.all([remember(turn, message.audio ? heard || '🎤' : message.text, reply), record(turn, outcomeOf(action, reply), started)])
  return reply
}

/**
 * Parses and acts. For a voice note (D3, D5): the duration gate comes before any model call, every
 * reply starts with what was heard, a load is always confirmed in text, and `heard` is the
 * transcription for the VIP history.
 */
async function answer(turn: Turn, history: StoredMessage[] | undefined): Promise<{ reply: BotReply; heard?: string; action?: ParseResult }> {
  const { message, context, fmt, t } = turn
  const audio = message.audio

  // Before any model call (D3, D8): `unavailable` makes the adapter keep the pending question. Logs name the id, never the content.
  const refused = audio ? refuseVoiceNote(audio) : null
  if (refused) {
    console.info(`[bot] audio ${message.messageId} refused: ${refused}`)
    return { reply: { kind: 'unavailable', text: t(refused === 'too-long' ? 'audioLargo' : 'audioNoDescargado') } }
  }

  const action = await parseMessage(
    {
      text: message.text,
      audio: audio && !('error' in audio) ? audio : undefined,
      categories: context.categories.map((category) => category.nombre),
      recurringNames: context.recurring.map((definition) => definition.nombre),
      locale: turn.usuario.idioma,
      today: fmt.today,
      pending: message.pending,
      history,
      paymentMethods: offersPaymentMethods(turn),
    },
    createGeminiModel(),
  )

  const reply = await act(turn, action)
  if (!audio) return { reply, action }

  const heard = 'transcripcion' in action ? action.transcripcion : undefined
  if (action.accion === 'no_entendido' && !heard) return { reply: { kind: 'text', text: t('audioSinVoz') }, heard, action }
  // `no_disponible` carries no transcription: its text goes out as it is.
  if (reply.kind === 'none' || heard === undefined) return { reply, heard, action }

  const text = `${t('escuche', { texto: heard })}\n${reply.text}`
  return { reply: reply.kind === 'loaded' ? { ...reply, text, alwaysText: true } : { ...reply, text }, heard, action }
}

/**
 * What a parsed turn ended in, for `eventos_bot` (0048): a question by what it asks, a load, a
 * load refused (the daily limit, a transfer without the feature), else the parser's action. No
 * action means a voice note refused before the model.
 */
function outcomeOf(action: ParseResult | undefined, reply: BotReply): string {
  if (!action) return 'audio_rechazado'
  if (reply.kind === 'ask') return `pregunta_${reply.pending.pregunta}`
  if (reply.kind === 'loaded') return 'cargado'
  if (action.accion === 'cargar') return 'carga_rechazada'
  return action.accion
}

/** Whether the account is offered the payment-method feature (`payment-method` → *The feature is offered by country*, D14). */
function offersPaymentMethods({ usuario }: Turn): boolean {
  return paymentMethodsOffered(usuario.pais, usuario.medio_pago_habilitado)
}

async function act(turn: Turn, action: ParseResult): Promise<BotReply> {
  const { t } = turn
  switch (action.accion) {
    case 'cargar':
      // Not offered: no method is read and no transfer is loaded, whatever the model returned.
      if (!offersPaymentMethods(turn)) {
        if (action.tipo === 'transferencia') return { kind: 'text', text: t('noEntendi') }
        return load(turn, { ...action, medio_pago: null })
      }
      return load(turn, action)
    case 'repreguntar':
      if (action.falta === 'deposito') return askDeposit(turn, action)
      return ask(turn, { pregunta: 'categoria', tipo: action.tipo, monto: action.monto, diasAtras: action.dias_atras })
    case 'no_entendido':
      return { kind: 'text', text: t('noEntendi') }
    case 'no_disponible':
      return { kind: 'unavailable', text: t('noDisponible') }
    case 'borrar':
      return remove(turn)
    case 'corregir':
      return correct(turn, action)
    case 'consultar':
      return query(turn, action.consulta)
    case 'crear_categoria':
      return createCategory(turn, action)
  }
}

/**
 * A VIP account's turn goes to `mensajes` (design D8): the incoming text, linked to the row it
 * loaded, and the reply's text (the confirmation text even when the adapter reacts instead). A
 * failed write is logged: the reply still goes out.
 */
async function remember({ usuario, message }: Turn, incoming: string, reply: BotReply): Promise<void> {
  if (!usuario.vip) return
  try {
    await storeExchange({
      userId: usuario.id,
      channel: message.channel,
      externalId: message.messageId,
      incoming,
      outgoing: reply.kind === 'none' ? null : reply.text,
      transactionId: reply.kind === 'loaded' ? reply.transactionId : null,
    })
  } catch (error) {
    console.error('[bot] conversation not stored:', error)
  }
}

/** The turn's outcome to `eventos_bot` (0048), without content. A failed write is logged: the reply still goes out. */
async function record({ usuario, message }: Turn, outcome: string, started: number): Promise<void> {
  try {
    await recordBotEvent({ userId: usuario.id, channel: message.channel, outcome, voice: message.audio !== undefined, ms: performance.now() - started })
  } catch (error) {
    console.error('[bot] event not recorded:', error)
  }
}

function ask({ t, context }: Turn, pending: PendingQuestion): BotReply {
  const categorias = context.categories.map((category) => category.nombre).join(', ')
  return { kind: 'ask', text: t('preguntaCategoria', { categorias }), pending }
}

/**
 * "Ingresé 200 en el banco" (`bot-transaction-logging` → *An ambiguous deposit asks with two
 * buttons*): asked only of an account using the feature; anyone else gets a plain income.
 */
function askDeposit(turn: Turn, action: Repreguntar): BotReply | Promise<BotReply> {
  const { usuario, context, fmt, t } = turn
  const descripcion = action.descripcion ?? null
  if (!offersPaymentMethods(turn) || (!context.hasMarkedMovements && usuario.medio_pago_default == null)) {
    return load(turn, { accion: 'cargar', tipo: 'ingreso', monto: action.monto, categoria: null, descripcion, dias_atras: action.dias_atras, recurrente: null, medio_pago: null })
  }
  return {
    kind: 'ask',
    text: t('preguntaDeposito', { monto: formatBotAmount(fmt.locale, fmt.currency, action.monto, fmt.amountFormat) }),
    pending: { pregunta: 'deposito', monto: action.monto, diasAtras: action.dias_atras, descripcion },
    buttons: [
      { answer: 'transfer', label: t(ANSWER_LABELS.transfer) },
      { answer: 'income', label: t(ANSWER_LABELS.income) },
    ],
  }
}

/** A pressed deposit answer: the pending amount into the bank, as cash moved there or as new income. */
function answerDeposit(turn: Turn, answer: 'transfer' | 'income'): Promise<BotReply> | BotReply {
  const pending = turn.message.pending
  // The adapter only passes an answer with the question pending; anything else is dropped.
  if (pending?.pregunta !== 'deposito' || !offersPaymentMethods(turn)) return { kind: 'none' }
  return load(turn, {
    accion: 'cargar',
    tipo: answer === 'transfer' ? 'transferencia' : 'ingreso',
    monto: pending.monto,
    categoria: null,
    descripcion: answer === 'income' ? pending.descripcion : null,
    dias_atras: pending.diasAtras,
    recurrente: null,
    medio_pago: 'tarjeta',
  })
}

/**
 * A fixed charge already charged this cycle (`bot-transaction-logging`): nothing is written, and
 * two buttons ask whether the amount is a separate payment, to load as an ordinary expense in the
 * charge's category under its name.
 */
function askRepeated(turn: Turn, definition: BotRecurring, amount: number, diasAtras: number, said: PaymentMethod | undefined): BotReply {
  const { context, fmt, t } = turn
  return {
    kind: 'ask',
    text: t('yaCargado', { nombre: definition.nombre, monto: formatBotAmount(fmt.locale, fmt.currency, amount, fmt.amountFormat) }),
    pending: {
      pregunta: 'cargo_repetido',
      nombre: definition.nombre,
      categoria: context.categories.find((c) => c.id === definition.categoria_id)?.nombre ?? '',
      monto: amount,
      diasAtras,
      medioPago: said ?? null,
    },
    buttons: [
      { answer: 'repeat', label: t(ANSWER_LABELS.repeat) },
      { answer: 'same', label: t(ANSWER_LABELS.same) },
    ],
  }
}

/** A pressed answer to the repeated charge: the pending amount as a separate expense, or nothing. */
function answerRepeated(turn: Turn, answer: 'repeat' | 'same'): Promise<BotReply> | BotReply {
  const pending = turn.message.pending
  // The adapter only passes an answer with the question pending; anything else is dropped.
  if (pending?.pregunta !== 'cargo_repetido') return { kind: 'none' }
  if (answer === 'same') return { kind: 'text', text: turn.t('nadaCargado', { nombre: pending.nombre }) }
  return load(turn, {
    accion: 'cargar',
    tipo: 'gasto',
    monto: pending.monto,
    categoria: pending.categoria,
    descripcion: pending.nombre,
    dias_atras: pending.diasAtras,
    recurrente: null,
    medio_pago: offersPaymentMethods(turn) ? pending.medioPago : null,
  })
}

async function load(turn: Turn, action: Cargar): Promise<BotReply> {
  const { data, fmt, message, usuario } = turn
  // 100 new movements a day per account, 500 in its first week, shared with the MCP (0044).
  const { data: allowed, error } = await data.client.rpc('consumir_cupo_altas_usuario', { p_usuario_id: usuario.id })
  if (error) throw new Error(error.message)
  if (allowed !== true) return { kind: 'text', text: turn.t('topeDiario') }
  const date = daysBefore(fmt.today, action.dias_atras)
  const amount = Math.abs(action.monto)
  // A load that answers the pending question is confirmed in text (spec): the category question
  // with its type and amount, the deposit question with its amount, as a transfer or an income,
  // or the repeated charge with its amount, as an expense.
  const pending = message.pending
  const answered =
    (pending?.pregunta === 'categoria' && pending.tipo === action.tipo && pending.monto === action.monto) ||
    (pending?.pregunta === 'deposito' && pending.monto === action.monto && (action.tipo === 'transferencia' || action.tipo === 'ingreso')) ||
    (pending?.pregunta === 'cargo_repetido' && pending.monto === action.monto && action.tipo === 'gasto')
  // The method the message said, else the account's default; only a said one is named (D10).
  const said: PaymentMethod | undefined = action.medio_pago ?? undefined
  const method = action.medio_pago ?? (offersPaymentMethods(turn) ? usuario.medio_pago_default : null)

  if (action.tipo === 'transferencia') {
    const into = action.medio_pago!
    await createSupabaseTransferMutations(data).create({ amount, into, date })
    return loaded(turn, { tipo: 'transferencia', amount, date, into }, await writtenRowId(turn), answered)
  }

  if (action.tipo === 'ingreso') {
    await createSupabaseIncomeMutations(data).create({ amount, date, description: action.descripcion ?? '', paymentMethod: method })
    return loaded(turn, { tipo: 'ingreso', amount, date, name: action.descripcion, method: said }, await writtenRowId(turn), answered)
  }

  if (action.tipo === 'ahorro') {
    const withdrawal = action.monto < 0
    const locale = turn.usuario.idioma
    const resumen = createTranslator({ locale, messages: MESSAGES[locale], namespace: 'resumen' })
    await createSupabaseSavingsMutations(data).addSavingsMovement({
      kind: withdrawal ? 'withdrawal' : 'deposit',
      amount,
      date,
      name: action.descripcion ?? resumen(withdrawal ? 'retiro' : 'deposito'),
      alreadySaved: false,
    })
    return loaded(turn, { tipo: 'ahorro', amount: action.monto, date }, await writtenRowId(turn), answered)
  }

  const definition = action.recurrente ? findByName(turn.context.recurring, action.recurrente) : undefined
  if (definition) {
    const reply = await completeRecurring(turn, definition, amount, date, action.dias_atras, answered, said)
    if (reply) return reply
  }

  // A plan that ended (or vanished) since the context was read is loaded as an ordinary expense in
  // its category, under its name: the payment is real (design D6).
  const category = definition
    ? turn.context.categories.find((c) => c.id === definition.categoria_id)
    : findCategory(turn.context.categories, action.categoria)
  if (!category) return ask(turn, { pregunta: 'categoria', tipo: 'gasto', monto: action.monto, diasAtras: action.dias_atras })

  const name = definition?.nombre ?? action.descripcion
  await createSupabaseExpenseMutations(data).create(category.id, { amount, date, description: name ?? '', paymentMethod: method })
  const summary: LoadSummary = {
    tipo: 'gasto',
    amount,
    date,
    name,
    category: category.nombre,
    budget: await budgetOf(turn, category.id, date),
    method: said,
  }
  return loaded(turn, summary, await writtenRowId(turn), answered)
}

/**
 * Completes this cycle's charge of `definition` (design D6). Null when the plan ended or the
 * definition is gone, so the caller loads an ordinary expense. An amount that differs from the
 * definition's changes only this charge, and the reply says so (`recurring-expenses`). The charge
 * keeps its definition's method unless the message said one, written on this charge only. A
 * charge deleted "only this month" comes back confirmed (0047); one already charged asks whether
 * this is a separate payment.
 */
async function completeRecurring(
  turn: Turn,
  definition: BotRecurring,
  amount: number,
  date: string,
  diasAtras: number,
  answered: boolean,
  said: PaymentMethod | undefined,
): Promise<BotReply | null> {
  const { usuario, data, message, context, fmt, t } = turn
  const range = await cycleRange(data.client, {
    diaInicio: usuario.dia_inicio_ciclo,
    timezone: usuario.timezone,
    ref: new Date(`${date}T12:00:00Z`),
  })

  const { data: id, error } = await data.client.rpc('completar_cargo_recurrente', {
    p_usuario_id: usuario.id,
    p_movimiento_id: definition.id,
    p_periodo: localDateOf(range.inicio, usuario.timezone),
    p_monto: amount,
    p_fecha: date,
    p_canal: message.channel,
    p_mensaje_id_externo: message.messageId,
    p_medio_pago: said ?? null,
  })

  if (error) {
    if (error.message === 'already-confirmed') return askRepeated(turn, definition, amount, diasAtras, said)
    if (error.message === 'plan-completed' || error.message === 'not-found') return null
    throw new Error(error.message)
  }

  const summary: LoadSummary = {
    tipo: 'gasto',
    amount,
    date,
    name: definition.nombre,
    category: context.categories.find((c) => c.id === definition.categoria_id)?.nombre ?? definition.nombre,
    budget: await budgetOf(turn, definition.categoria_id, date),
    method: said,
  }
  const differs = amount !== definition.monto_actual
  const note = differs
    ? t('soloEsteMes', { nombre: definition.nombre, monto: formatBotAmount(fmt.locale, fmt.currency, definition.monto_actual, fmt.amountFormat) })
    : undefined
  return loaded(turn, summary, id as string, answered || differs, note)
}

function loaded({ fmt }: Turn, summary: LoadSummary, transactionId: string, alwaysText: boolean, note?: string): BotReply {
  const text = confirmationText(fmt, summary)
  return {
    kind: 'loaded',
    text: note ? `${text}\n${note}` : text,
    icon: loadIcon(summary),
    transactionId,
    alwaysText,
    lastLoad: transactionId,
  }
}

/** The row this message's creator just wrote: `(usuario_id, canal, mensaje_id_externo)` is unique (design D1). */
async function writtenRowId({ data, message }: Turn): Promise<string> {
  const { data: row, error } = await data.client
    .from('transacciones')
    .select('id')
    .eq('usuario_id', data.usuarioId)
    .eq('canal', message.channel)
    .eq('mensaje_id_externo', message.messageId)
    .single<{ id: string }>()
  if (error) throw error
  return row.id
}

/**
 * The category's budget bar after the write, from the dashboard's own summary (design D10): null
 * when the date is outside the cycle in progress, the category has no budget there, or the read
 * failed (the load is already written, so the confirmation goes out without the line).
 */
async function budgetOf({ data, usuario }: Turn, categoryId: string, date: string): Promise<LoadBudget | null> {
  try {
    const summary = (await resumenMensual(data.client, usuario)).data
    if (date < summary.cycle.start || date > summary.cycle.end) return null
    return summary.expenses.groups.find((group) => group.id === categoryId)?.budget ?? null
  } catch (error) {
    console.error('[bot] budget line skipped:', error)
    return null
  }
}

type LoadRow = {
  id: string
  tipo: 'gasto' | 'ingreso' | 'ahorro' | 'transferencia'
  /** Kept by a correction; on a transfer, the pocket it went into. */
  medio_pago: PaymentMethod | null
  monto: number
  fecha: string
  descripcion: string | null
  categoria_id: string | null
  movimiento_recurrente_id: string | null
  ciclo_mes: string | null
  categoria: { nombre: string } | null
}

/**
 * A load the chat may change (design D3): the account's own row, not deleted and confirmed. A
 * recurring charge that a delete reopened is pending again, so it no longer counts as a load.
 */
async function readLoad({ data }: Turn, id: string | undefined): Promise<LoadRow | null> {
  if (!id) return null
  const { data: row, error } = await data.client
    .from('transacciones')
    .select('id, tipo, monto, fecha, descripcion, categoria_id, movimiento_recurrente_id, ciclo_mes, medio_pago, categoria:categorias(nombre)')
    .eq('id', id)
    .eq('usuario_id', data.usuarioId)
    .eq('estado', 'confirmada')
    .is('borrado_en', null)
    .maybeSingle<LoadRow>()
  if (error) throw error
  return row ? { ...row, monto: Number(row.monto) } : null
}

/**
 * `borrar` and Undo (design D3): an ordinary row is soft-deleted through its contract; a completed
 * recurring charge goes back to pending at the definition's amount on its day in that cycle,
 * keeping its message id so a retry of the original message is still discarded.
 */
async function deleteLoad({ data }: Turn, row: LoadRow): Promise<void> {
  if (row.movimiento_recurrente_id && row.ciclo_mes) {
    const definition = await data.client
      .from('movimientos_recurrentes')
      .select('monto_actual, dia_del_mes')
      .eq('id', row.movimiento_recurrente_id)
      .eq('usuario_id', data.usuarioId)
      .single<{ monto_actual: number; dia_del_mes: number }>()
    if (definition.error) throw definition.error

    expectRows(
      await data.client
        .from('transacciones')
        .update({
          estado: 'pendiente',
          monto: definition.data.monto_actual,
          fecha: `${fechaEnCiclo(row.ciclo_mes, definition.data.dia_del_mes)}T12:00:00Z`,
        })
        .eq('id', row.id)
        .eq('usuario_id', data.usuarioId)
        .is('borrado_en', null)
        .select('id'),
    )
    return
  }

  if (row.tipo === 'gasto') await createSupabaseExpenseMutations(data).softDelete(row.id)
  else if (row.tipo === 'ingreso') await createSupabaseIncomeMutations(data).softDelete(row.id)
  else if (row.tipo === 'transferencia') await createSupabaseTransferMutations(data).softDelete(row.id)
  else await createSupabaseSavingsMutations(data).softDelete(row.id)
}

/** What the delete, correct and undo replies say about a row: amount, category or type, and day. */
function describeLoad({ fmt, usuario }: Turn, row: LoadRow, amount = Math.abs(row.monto), categoria = row.categoria?.nombre ?? '') {
  return {
    monto: formatBotAmount(fmt.locale, fmt.currency, amount, fmt.amountFormat),
    tipo: row.tipo,
    categoria,
    direccion: row.medio_pago ?? 'tarjeta',
    dia: formatBotDay(fmt.locale, fmt.today, localDateOf(row.fecha, usuario.timezone), fmt.t),
  }
}

async function remove(turn: Turn): Promise<BotReply> {
  const row = await readLoad(turn, turn.message.lastLoadId)
  if (!row) return { kind: 'text', text: turn.t('nadaQueCorregir'), lastLoad: null }

  await deleteLoad(turn, row)
  return { kind: 'text', text: turn.t('borrado', describeLoad(turn, row)), lastLoad: null }
}

/** Undo deletes the row its button names, even when newer loads exist (design D2). */
async function undo(turn: Turn, id: string): Promise<BotReply> {
  const row = await readLoad(turn, id)
  if (!row) return { kind: 'text', text: turn.t('yaDeshecho') }

  await deleteLoad(turn, row)
  return {
    kind: 'text',
    text: turn.t('deshecho', describeLoad(turn, row)),
    lastLoad: id === turn.message.lastLoadId ? null : undefined,
  }
}

/**
 * `corregir` on the channel's last load (design D3). A category moves an expense through the
 * web's own update. An amount goes through the contract for ordinary expenses and incomes, and
 * as a direct update of `monto` for savings (no update in their contract) and recurring charges
 * (the definition never changes). A withdrawal stays negative.
 */
async function correct(turn: Turn, action: Corregir): Promise<BotReply> {
  const { data, context, usuario, t } = turn
  const row = await readLoad(turn, turn.message.lastLoadId)
  if (!row) return { kind: 'text', text: t('nadaQueCorregir'), lastLoad: null }

  const amount = action.monto ?? Math.abs(row.monto)
  // A correction never changes the method (`bot-transaction-logging` → *A load carries its payment method*).
  const date = localDateOf(row.fecha, usuario.timezone)
  const draft = { amount, date, description: row.descripcion ?? '', paymentMethod: row.medio_pago }
  let categoria = row.categoria?.nombre ?? ''

  if (action.categoria !== undefined) {
    if (row.tipo !== 'gasto') return { kind: 'text', text: t('soloGastosCategoria') }
    const category = findByName(context.categories, action.categoria)
    if (!category) {
      return { kind: 'text', text: t('categoriaNoExiste', { categorias: context.categories.map((c) => c.nombre).join(', ') }) }
    }
    await createSupabaseExpenseMutations(data).update(row.id, draft, category.id)
    categoria = category.nombre
  } else if (row.tipo === 'transferencia') {
    await createSupabaseTransferMutations(data).update(row.id, { amount, into: row.medio_pago!, date })
  } else if (row.movimiento_recurrente_id || row.tipo === 'ahorro') {
    expectRows(
      await data.client
        .from('transacciones')
        .update({ monto: row.monto < 0 ? -amount : amount })
        .eq('id', row.id)
        .eq('usuario_id', data.usuarioId)
        .is('borrado_en', null)
        .select('id'),
    )
  } else if (row.tipo === 'gasto') {
    await createSupabaseExpenseMutations(data).update(row.id, draft, row.categoria_id!)
  } else {
    await createSupabaseIncomeMutations(data).update(row.id, draft)
  }

  return { kind: 'text', text: t('corregido', describeLoad(turn, row, amount, categoria)) }
}

/** The month and free-margin queries, from the dashboard's own summary of the cycle in progress (design D7). */
async function query(turn: Turn, consulta: 'margen_libre' | 'mes'): Promise<BotReply> {
  const { data, usuario, fmt, t } = turn
  const summary = (await resumenMensual(data.client, usuario)).data
  const money = (amount: number) => formatBotAmount(fmt.locale, fmt.currency, amount, fmt.amountFormat)
  const link = `${SITE_URL}/dashboard`

  if (consulta === 'margen_libre') return { kind: 'text', text: t('consultaLibre', { monto: money(summary.freeMargin), link }) }

  const { top, rest } = topCategories(summary.expenses.groups)
  const lines = top.map((group) => t('consultaLinea', { categoria: group.name, monto: money(group.total) }))
  // The categories left out go in one line that says how many, so the lines add up to the total.
  if (rest.count > 0) lines.push(t('consultaResto', { cantidad: rest.count, monto: money(rest.total) }))
  const lineas = lines.map((line) => `\n${line}`).join('')
  return { kind: 'text', text: t('consultaMes', { total: money(summary.expenses.total), lineas, link }) }
}

/**
 * `crear_categoria` (design D7): an equal name exists already; a similar one asks first, and
 * `confirmada` is trusted only when the channel held that question for that name. The category
 * lives from the cycle in progress on, with the first palette color no category of the account uses.
 */
async function createCategory(turn: Turn, action: CrearCategoria): Promise<BotReply> {
  const { data, context, message, fmt, t } = turn
  const nombre = action.nombre.trim()
  const pending = message.pending?.pregunta === 'crear_categoria' ? message.pending : undefined
  const confirmed = action.confirmada && pending !== undefined && normalizeName(pending.nombre) === normalizeName(nombre)

  const clash = similarCategory(nombre, context.categories)
  if (clash?.kind === 'same') return { kind: 'text', text: t('categoriaExiste', { nombre: clash.category.nombre }) }
  if (clash && !confirmed) {
    return {
      kind: 'ask',
      text: t('categoriaParecida', { nombre, parecida: clash.category.nombre }),
      pending: { pregunta: 'crear_categoria', nombre, presupuesto: action.presupuesto ?? null, parecida: clash.category.nombre },
    }
  }

  const presupuesto = confirmed ? pending.presupuesto : (action.presupuesto ?? null)
  const used = await data.client.from('categorias').select('color').eq('usuario_id', data.usuarioId)
  if (used.error) throw used.error
  const usedColors = new Set((used.data as { color: string }[]).map((row) => row.color))
  const color = CATEGORY_COLORS.find((c) => !usedColors.has(c)) ?? CATEGORY_COLORS[0]

  try {
    await createSupabaseCategoryMutations(data).create({ name: nombre, color, budget: presupuesto }, context.cycle, 'onward')
  } catch (error) {
    if ((error as Error).message === DUPLICATE_CATEGORY_NAME) return { kind: 'text', text: t('categoriaExiste', { nombre }) }
    throw error
  }

  return presupuesto
    ? { kind: 'text', text: t('categoriaCreadaConPresupuesto', { nombre, monto: formatBotAmount(fmt.locale, fmt.currency, presupuesto, fmt.amountFormat) }) }
    : { kind: 'text', text: t('categoriaCreada', { nombre }) }
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
 * First contact from an identifier that isn't linked to any account (§4). An account is created
 * only on the web and WhatsApp is linked from it, so there is nothing to ask the chat for: the
 * reply, when it exists, is one line that sends the person to the web and to the account's
 * settings to link the number. Today it replies nothing (decision of 2026-10-03, block 10).
 */
/**
 * A message from a number with no channel that is not a linking message (`whatsapp-linking` →
 * *An unknown number is answered once*): one reply, in Spanish and English because the language
 * is unknown, that sends the person to the web; nothing when the number was answered before. No
 * account and no channel are created from the chat. Rate limiting (block 10) goes in front of this.
 */
export async function processUnknownNumber({
  channel,
  externalId,
  text,
  answered,
}: {
  channel: Channel
  externalId: string
  text: string
  answered: boolean
}): Promise<Extract<BotReply, { kind: 'text' | 'none' }>> {
  void channel
  void externalId
  void text
  if (answered) return { kind: 'none' }
  const lines = (['es', 'en'] as const).map((locale) =>
    createTranslator({ locale, messages: MESSAGES[locale], namespace: 'bot' })('desconocido', { url: SITE_URL }),
  )
  return { kind: 'text', text: lines.join('\n\n') }
}
