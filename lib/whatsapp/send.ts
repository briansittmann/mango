/**
 * Sends a text over the WhatsApp Cloud API (design D11). Never throws: by the time a reply is
 * sent the movement is already written, so a failed send is logged (number masked) and dropped.
 */
export async function sendText(phone: string, text: string): Promise<void> {
  const token = process.env.WHATSAPP_TOKEN
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID

  if (!token || !phoneNumberId) {
    console.error(`[whatsapp] missing WHATSAPP_TOKEN or WHATSAPP_PHONE_NUMBER_ID, reply to ${maskPhone(phone)} not sent`)
    return
  }

  try {
    const response = await fetch(`https://graph.facebook.com/v21.0/${phoneNumberId}/messages`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to: phone.replace(/\D/g, ''),
        type: 'text',
        text: { body: text },
      }),
    })

    if (!response.ok) {
      console.error(`[whatsapp] send to ${maskPhone(phone)} failed: ${response.status} ${await response.text()}`)
    }
  } catch (error) {
    console.error(`[whatsapp] send to ${maskPhone(phone)} failed:`, error)
  }
}

/** Only the last 4 digits: the full number doesn't go into the logs. */
export function maskPhone(phone: string): string {
  return `…${phone.slice(-4)}`
}
