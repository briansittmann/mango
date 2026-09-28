import {
  processMessage,
  processUnknownNumber,
  type BotReply,
} from '@/lib/bot/logic'
import { clearPendingQuestion, readPendingQuestion, writePendingQuestion } from '@/lib/data/channels'
import { messageAlreadyProcessed } from '@/lib/data/transactions'
import { findUserIdByPhone } from '@/lib/data/users'
import { isInviteRequired } from './invite'
import { maskPhone, sendText } from './send'

import type { WhatsAppMessage } from './payload'

export { maskPhone }

/**
 * Adapter: resolves the number against the linked `whatsapp` channels, discards retries and
 * calls the bot logic with the internal format `{ userId, text, messageId, channel, pending }`
 * (ARCHITECTURE.md §3). It owns the channel's pending question (design D7, D12): reads it before
 * the logic, writes it on an `ask` and clears it on any other reply.
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

  const pending = await readPendingQuestion('whatsapp', message.phone)

  const reply = await processMessage({
    userId,
    text: message.text,
    messageId: message.messageId,
    channel: 'whatsapp',
    pending: pending ?? undefined,
  })

  if (reply.kind === 'ask') {
    await writePendingQuestion('whatsapp', message.phone, reply.pending)
  } else if (reply.kind !== 'unavailable') {
    await clearPendingQuestion('whatsapp', message.phone)
  }

  await sendReply(message.phone, reply)
}

/**
 * A `recurring-discrepancy` reply turned into a question, held across turns. `recurring-expenses`
 * → *The bot asks whether a change is permanent, and the adapter owns the answer*: the message
 * logic (`lib/bot/logic.ts`) only reports the discrepancy: it never asks anything and never
 * updates a definition. Holding this — and answering it — is the adapter's job, because it is
 * WhatsApp-specific conversation state, not something the platform-agnostic logic should know
 * about (D1's "no answer is not a state to store" applies to the *definition*, not to this —
 * this pending decision itself is exactly the state the adapter is responsible for holding).
 */
type PendingRecurringDecision = {
  userId: string
  definitionId: string
  expectedAmount: number
  loadedAmount: number
}

/**
 * This is where **how** the bot replies gets decided: text with an Undo
 * button for the first 15 charges, emoji reaction from the 16th on
 * (progressive confirmation, §3). The bot logic doesn't take part in that
 * decision.
 */
async function sendReply(phone: string, reply: BotReply): Promise<void> {
  if (reply.kind === 'none') return

  if (reply.kind === 'recurring-discrepancy') {
    // TODO (recurring-expenses): turn this into the follow-up question ("¿Son {loadedAmount}
    // todos los meses?"), store a `PendingRecurringDecision` for this phone number, and resolve
    // it on the next turn: an affirmative answer updates the definition's expected amount via
    // `actions.recurring`'s eventual Supabase-backed equivalent; silence or a negative answer
    // both clear the pending decision without touching the definition — this cycle's charge
    // simply stands as the exception, exactly as the message logic already left it.
    console.info(
      `[whatsapp] recurring discrepancy for ${maskPhone(phone)}: ${reply.definitionName} expected ${reply.expectedAmount}, loaded ${reply.loadedAmount}`,
    )
  }

  // TODO: choose message or reaction based on the user's `cargas_confirmadas` and
  // `modo_confirmacion` (§3, `add-bot-conversation`).
  await sendText(phone, reply.text)
}
