import { createTranslator } from 'next-intl'

import {
  processMessage,
  processUnknownNumber,
  type BotReply,
} from '@/lib/bot/logic'
import { allowLinkAttempt, clearPendingQuestion, linkChannel, readChannelState, registerUnknownContact, setLastLoad, writePendingQuestion } from '@/lib/data/channels'
import { localDateOf } from '@/lib/data/supabase/cycle'
import { messageAlreadyProcessed } from '@/lib/data/transactions'
import { findUserIdByPhone, readConfirmationState, setConfirmedLoads } from '@/lib/data/users'
import es from '@/messages/es.json'
import en from '@/messages/en.json'
import { ANSWER_BUTTONS, UNDO_PREFIX, buttonAction, handleIncoming, type AdapterTexts } from './handle-message'
import { downloadMedia, type MediaResult } from './media'
import { maskPhone, sendButtons, sendReaction, sendText } from './send'

import type { WhatsAppMessage } from './payload'

export { maskPhone }

/** Loads per local day confirmed in text before reactions take over, in mode `auto` (§3). One constant for every account. */
export const DAILY_TEXT_CONFIRMATIONS = 10

const MESSAGES = { es, en }

/** The replies the adapter sends on its own: the linking ones (`whatsapp-linking`) and the one for other media (`bot-voice-messages`), per language. */
const ADAPTER_TEXTS: AdapterTexts = {
  es: { vinculado: es.bot.vinculado, yaVinculado: es.bot.yaVinculado, codigoInvalido: es.bot.codigoInvalido, numeroEnOtraCuenta: es.bot.numeroEnOtraCuenta, cuentaYaVinculada: es.bot.cuentaYaVinculada, vincularEspera: es.bot.vincularEspera, soloTextoYAudio: es.bot.soloTextoYAudio },
  en: { vinculado: en.bot.vinculado, yaVinculado: en.bot.yaVinculado, codigoInvalido: en.bot.codigoInvalido, numeroEnOtraCuenta: en.bot.numeroEnOtraCuenta, cuentaYaVinculada: en.bot.cuentaYaVinculada, vincularEspera: en.bot.vincularEspera, soloTextoYAudio: en.bot.soloTextoYAudio },
}

/**
 * Adapter: resolves the number against the linked `whatsapp` channels, links a chat that sends
 * `vincular <código>` (`whatsapp-linking`, D5), answers a stranger once, discards retries, answers
 * other media with one fixed text, downloads a voice note (`add-voice-messages` D2) and calls the
 * bot logic with the internal format `{ userId, text, audio, messageId, channel, pending,
 * lastLoadId, undoId }` (ARCHITECTURE.md §3). It owns the channel's state (design D1, D7, D12):
 * reads the pending question and the last load before the logic, writes the question on an `ask`
 * and clears it on any other reply, and applies the reply's `lastLoad`. It also decides how a load
 * is confirmed (D6). The order of decisions lives in `handle-message.ts`, with the side effects
 * injected here.
 */
export async function handleMessages(messages: WhatsAppMessage[]): Promise<void> {
  for (const message of messages) {
    try {
      await handleIncoming(message, {
        findUserIdByPhone,
        linkChannel,
        allowLinkAttempt,
        registerUnknownContact,
        localeOf: async (userId) => (await readConfirmationState(userId)).idioma,
        processUnknownNumber,
        messageAlreadyProcessed: (userId, messageId) => messageAlreadyProcessed(userId, 'whatsapp', messageId),
        downloadMedia,
        handleKnown,
        sendText,
        texts: ADAPTER_TEXTS,
      })
    } catch (error) {
      // A message that fails doesn't take the rest of the batch down with it.
      console.error(`[whatsapp] error processing ${message.messageId}:`, error)
    }
  }
}

/** The known flow once the retry, media and linking checks passed (`handle-message.ts`). */
async function handleKnown(userId: string, message: WhatsAppMessage, audio?: MediaResult): Promise<void> {
  const { pending, lastLoadId } = await readChannelState('whatsapp', message.phone)

  // An Undo, or an answer to a question still pending; any other press is dropped (D10).
  const button = message.buttonId === undefined ? null : buttonAction(message.buttonId, pending)
  if (message.buttonId !== undefined && !button) {
    console.info(`[whatsapp] button discarded: ${message.messageId}`)
    return
  }

  const reply = await processMessage({
    userId,
    text: message.text,
    audio,
    messageId: message.messageId,
    channel: 'whatsapp',
    pending: pending ?? undefined,
    lastLoadId: lastLoadId ?? undefined,
    undoId: button && 'undoId' in button ? button.undoId : undefined,
    answer: button && 'answer' in button ? button.answer : undefined,
  })

  if (reply.kind === 'ask') {
    await writePendingQuestion('whatsapp', message.phone, reply.pending)
  } else if (reply.kind !== 'unavailable') {
    await clearPendingQuestion('whatsapp', message.phone)
  }
  if (reply.lastLoad !== undefined) await setLastLoad('whatsapp', message.phone, reply.lastLoad)

  if (reply.kind === 'loaded') {
    await confirmLoad(userId, message, reply)
  } else {
    await sendReply(message.phone, reply)
  }
}

/**
 * This is where **how** a load is confirmed gets decided (progressive confirmation, §3, D6): text
 * with an Undo button while the account has fewer than `DAILY_TEXT_CONFIRMATIONS` loads today (its
 * own time zone) in mode `auto`, always in mode `texto` or when the logic asks for text, and a
 * reaction with the confirmation's icon otherwise. Every load raises the counts, whichever form
 * went out; the sends never throw.
 */
async function confirmLoad(userId: string, message: WhatsAppMessage, reply: Extract<BotReply, { kind: 'loaded' }>): Promise<void> {
  const state = await readConfirmationState(userId)
  const today = localDateOf(new Date(), state.timezone)
  const loadsToday = state.cargas_dia_fecha === today ? state.cargas_dia : 0
  const asText =
    reply.alwaysText ||
    state.modo_confirmacion === 'texto' ||
    (state.modo_confirmacion === 'auto' && loadsToday < DAILY_TEXT_CONFIRMATIONS)

  if (asText) {
    const t = createTranslator({ locale: state.idioma, messages: MESSAGES[state.idioma], namespace: 'bot' })
    await sendButtons(message.phone, reply.text, [{ id: `${UNDO_PREFIX}${reply.transactionId}`, title: t('deshacer') }])
  } else {
    await sendReaction(message.phone, message.messageId, reply.icon)
  }

  await setConfirmedLoads(userId, state.cargas_confirmadas + 1, loadsToday + 1, today)
}

/** Every reply that is not a load is plain text, except a question that offers answer buttons. */
async function sendReply(phone: string, reply: BotReply): Promise<void> {
  if (reply.kind === 'none') return
  if (reply.kind === 'ask' && reply.buttons) {
    await sendButtons(phone, reply.text, reply.buttons.map(({ answer, label }) => ({ id: ANSWER_BUTTONS[answer], title: label })))
    return
  }
  await sendText(phone, reply.text)
}
