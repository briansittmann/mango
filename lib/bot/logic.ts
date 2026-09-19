/**
 * Bot logic. **Knows nothing about WhatsApp** (ARCHITECTURE.md §3): it
 * receives the internal format and decides *what* to reply. The *how* — text
 * or reaction, depending on progressive confirmation — is decided by the
 * adapter.
 *
 * If Telegram or Signal gets added tomorrow, this file doesn't change.
 */

export type IncomingMessage = {
  userId: string
  text: string
  messageId: string
}

export type BotReply =
  | { kind: 'text'; text: string }
  | { kind: 'none' }
  | {
      /**
       * `recurring-expenses` → *The bot asks whether a change is permanent, and the adapter
       * owns the answer*. Returned once this cycle's pending charge for `definitionId` has
       * already been completed and confirmed at `loadedAmount` — this reply only *reports*
       * that it differs from the definition's `expectedAmount`. It decides nothing: no
       * question is asked and no definition is updated here. That belongs to the adapter
       * (`lib/whatsapp/adapter.ts`), which owns the conversation's state across turns.
       */
      kind: 'recurring-discrepancy'
      definitionId: string
      definitionName: string
      expectedAmount: number
      loadedAmount: number
    }

export async function processMessage(message: IncomingMessage): Promise<BotReply> {
  // TODO: Gemini parser + Zod validation, transaction charge (category that
  // doesn't match → `otros`, without asking again) and advisor mode (§3, §5).
  // TODO: intercept the user with `onboarding_completo = false` and trigger
  // the wizard before parsing anything (§11).
  // TODO: when the loaded amount differs from a matched definition's expected amount,
  // complete and confirm this cycle's charge at the loaded amount and return
  // `{ kind: 'recurring-discrepancy', ... }` instead of `{ kind: 'text' }` — never ask
  // anything here and never touch the definition (recurring-expenses, see `BotReply` above).
  void message
  return { kind: 'none' }
}

/**
 * First contact from a number that isn't registered. **Not silently
 * ignored** (§4): the invitation code is requested, and the three possible
 * errors — doesn't exist, already used, expired — are distinguished in the
 * message, in case the person doesn't know if the problem is the code or
 * their number.
 */
export async function processUnknownNumber(
  phone: string,
  text: string
): Promise<BotReply> {
  // TODO: validate the code against `invitaciones`, burn it (`usada_por` +
  // `usada_en`) and start onboarding: name → country → cycle day → test
  // expense (§4).
  // TODO: rate limit attempts per number before touching the database, or
  // codes can be brute-forced (§10).
  //
  // Doesn't return the code request yet because the bot's texts live in
  // translation files, not embedded here (§2), and that piece isn't built.
  void phone
  void text
  return { kind: 'none' }
}
