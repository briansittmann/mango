/**
 * Sends a text over the WhatsApp Cloud API (design D11). Never throws: by the time a reply is
 * sent the movement is already written, so a failed send is logged (number masked) and dropped.
 */
export async function sendText(phone: string, text: string): Promise<void> {
  await send(phone, 'send', { type: 'text', text: { body: text } })
}

/**
 * The confirmation text with one reply button (`add-bot-conversation` design D2). `buttonId`
 * comes back in the press; `label` is at most 20 characters. Never throws, like `sendText`.
 */
export async function sendUndoButton(phone: string, text: string, buttonId: string, label: string): Promise<void> {
  await send(phone, 'button', {
    type: 'interactive',
    interactive: {
      type: 'button',
      body: { text },
      action: { buttons: [{ type: 'reply', reply: { id: buttonId, title: label } }] },
    },
  })
}

/** An emoji reaction on the user's own message (design D6). Never throws, like `sendText`. */
export async function sendReaction(phone: string, messageId: string, emoji: string): Promise<void> {
  await send(phone, 'reaction', { type: 'reaction', reaction: { message_id: messageId, emoji } })
}

async function send(phone: string, what: string, message: Record<string, unknown>): Promise<void> {
  const token = process.env.WHATSAPP_TOKEN
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID

  if (!token || !phoneNumberId) {
    console.error(`[whatsapp] missing WHATSAPP_TOKEN or WHATSAPP_PHONE_NUMBER_ID, ${what} to ${maskPhone(phone)} not sent`)
    return
  }

  try {
    const response = await fetch(`https://graph.facebook.com/v21.0/${phoneNumberId}/messages`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ messaging_product: 'whatsapp', to: phone.replace(/\D/g, ''), ...message }),
    })

    if (!response.ok) {
      console.error(`[whatsapp] ${what} to ${maskPhone(phone)} failed: ${response.status} ${await response.text()}`)
    }
  } catch (error) {
    console.error(`[whatsapp] ${what} to ${maskPhone(phone)} failed:`, error)
  }
}

/** Only the last 4 digits: the full number doesn't go into the logs. */
export function maskPhone(phone: string): string {
  return `…${phone.slice(-4)}`
}
