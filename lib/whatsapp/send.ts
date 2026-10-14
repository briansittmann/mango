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

/**
 * An approved Meta template, the only message allowed outside the 24-hour window (ARCHITECTURE.md
 * §14). `params` fill the body's `{{1}}`, `{{2}}`… in order. Never throws; true when Meta accepted it.
 */
export async function sendTemplate(phone: string, name: string, language: string, params: string[]): Promise<boolean> {
  return send(phone, `template ${name}`, {
    type: 'template',
    template: {
      name,
      language: { code: language },
      components: [{ type: 'body', parameters: params.map((text) => ({ type: 'text', text })) }],
    },
  })
}

async function send(phone: string, what: string, message: Record<string, unknown>): Promise<boolean> {
  const token = process.env.WHATSAPP_TOKEN
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID

  if (!token || !phoneNumberId) {
    console.error(`[whatsapp] missing WHATSAPP_TOKEN or WHATSAPP_PHONE_NUMBER_ID, ${what} to ${maskPhone(phone)} not sent`)
    return false
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
    return response.ok
  } catch (error) {
    console.error(`[whatsapp] ${what} to ${maskPhone(phone)} failed:`, error)
    return false
  }
}

/** Only the last 4 digits: the full number doesn't go into the logs. */
export function maskPhone(phone: string): string {
  return `…${phone.slice(-4)}`
}
