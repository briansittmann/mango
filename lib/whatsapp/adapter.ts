import {
  processMessage,
  processUnknownNumber,
  type BotReply,
} from '@/lib/bot/logic'
import { messageAlreadyProcessed } from '@/lib/data/transactions'
import { findUserIdByPhone } from '@/lib/data/users'

import type { WhatsAppMessage } from './payload'

/**
 * Adapter: resolves the number against the users, discards retries and
 * calls the bot logic with the internal format `{ userId, text,
 * messageId }` (ARCHITECTURE.md §3).
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
    const reply = await processUnknownNumber(message.phone, message.text)
    await sendReply(message.phone, reply)
    return
  }

  if (await messageAlreadyProcessed(userId, message.messageId)) {
    console.info(`[whatsapp] retry discarded: ${message.messageId}`)
    return
  }

  const reply = await processMessage({
    userId,
    text: message.text,
    messageId: message.messageId,
  })

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
    console.info(`[whatsapp] recurring discrepancy pending reply to ${maskPhone(phone)}`)
    return
  }

  // TODO: POST to the Cloud API with WHATSAPP_TOKEN and WHATSAPP_PHONE_NUMBER_ID,
  // choosing message or reaction based on the user's `cargas_confirmadas` and
  // `modo_confirmacion` (§3).
  console.info(`[whatsapp] reply pending send to ${maskPhone(phone)}`)
}

/** Only the last 4 digits: the full number doesn't go into the logs. */
function maskPhone(phone: string): string {
  return `…${phone.slice(-4)}`
}
