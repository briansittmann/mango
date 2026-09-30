import { createTranslator } from 'next-intl'

import {
  processMessage,
  processUnknownNumber,
  type BotReply,
} from '@/lib/bot/logic'
import { clearPendingQuestion, readChannelState, setLastLoad, writePendingQuestion } from '@/lib/data/channels'
import { messageAlreadyProcessed } from '@/lib/data/transactions'
import { findUserIdByPhone, readConfirmationState, setConfirmedLoads } from '@/lib/data/users'
import es from '@/messages/es.json'
import en from '@/messages/en.json'
import { isInviteRequired } from './invite'
import { maskPhone, sendReaction, sendText, sendUndoButton } from './send'

import type { WhatsAppMessage } from './payload'

export { maskPhone }

/** Loads confirmed in text before reactions take over, in mode `auto` (§3). One constant for every account. */
export const TEXT_CONFIRMATIONS = 15

/** An Undo button's id names the row it deletes (`add-bot-conversation` design D2). */
const UNDO_PREFIX = 'undo:'
const UNDO_ID = /^undo:([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i

const MESSAGES = { es, en }

/**
 * Adapter: resolves the number against the linked `whatsapp` channels, discards retries and
 * calls the bot logic with the internal format `{ userId, text, messageId, channel, pending,
 * lastLoadId, undoId }` (ARCHITECTURE.md §3). It owns the channel's state (design D1, D7, D12):
 * reads the pending question and the last load before the logic, writes the question on an `ask`
 * and clears it on any other reply, and applies the reply's `lastLoad`. It also decides how a load
 * is confirmed (D6).
 */
export async function handleMessages(messages: WhatsAppMessage[]): Promise<void> {
  for (const message of messages) {
    try {
      await handleMessage(message)
    } catch (error) {
      // A message that fails doesn't take the rest of the batch down with it.
      console.error(`[whatsapp] error processing ${message.messageId}:`, error)
    }
  }
}

async function handleMessage(message: WhatsAppMessage): Promise<void> {
  const userId = await findUserIdByPhone(message.phone)

  if (!userId) {
    const reply = await processUnknownNumber({
      channel: 'whatsapp',
      externalId: message.phone,
      text: message.text,
      inviteRequired: isInviteRequired(process.env.WHATSAPP_REQUIRE_INVITE),
    })
    await sendReply(message.phone, reply)
    return
  }

  if (await messageAlreadyProcessed(userId, 'whatsapp', message.messageId)) {
    console.info(`[whatsapp] retry discarded: ${message.messageId}`)
    return
  }

  const undoId = message.buttonId === undefined ? undefined : UNDO_ID.exec(message.buttonId)?.[1]
  if (message.buttonId !== undefined && !undoId) {
    console.info(`[whatsapp] unknown button discarded: ${message.messageId}`)
    return
  }

  const { pending, lastLoadId } = await readChannelState('whatsapp', message.phone)

  const reply = await processMessage({
    userId,
    text: message.text,
    messageId: message.messageId,
    channel: 'whatsapp',
    pending: pending ?? undefined,
    lastLoadId: lastLoadId ?? undefined,
    undoId,
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
 * with an Undo button while the account has fewer than `TEXT_CONFIRMATIONS` loads in mode `auto`,
 * always in mode `texto` or when the logic asks for text, and a reaction with the confirmation's
 * icon otherwise. Every load raises the count, whichever form went out; the sends never throw.
 */
async function confirmLoad(userId: string, message: WhatsAppMessage, reply: Extract<BotReply, { kind: 'loaded' }>): Promise<void> {
  const state = await readConfirmationState(userId)
  const asText =
    reply.alwaysText ||
    state.modo_confirmacion === 'texto' ||
    (state.modo_confirmacion === 'auto' && state.cargas_confirmadas < TEXT_CONFIRMATIONS)

  if (asText) {
    const t = createTranslator({ locale: state.idioma, messages: MESSAGES[state.idioma], namespace: 'bot' })
    await sendUndoButton(message.phone, reply.text, `${UNDO_PREFIX}${reply.transactionId}`, t('deshacer'))
  } else {
    await sendReaction(message.phone, message.messageId, reply.icon)
  }

  await setConfirmedLoads(userId, state.cargas_confirmadas + 1)
}

/** Every reply that is not a load is plain text, without buttons. */
async function sendReply(phone: string, reply: BotReply): Promise<void> {
  if (reply.kind === 'none') return
  await sendText(phone, reply.text)
}
