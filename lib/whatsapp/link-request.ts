/**
 * The message that links a WhatsApp number to a web account — **a stub** (`add-web-onboarding`
 * D11, `onboarding` → *Closing step stores a WhatsApp request and sends nothing*).
 *
 * The closing step of `/onboarding` stores the number in `usuarios.telefono`, the code in
 * `usuarios.codigo_invitacion` and the time in `usuarios.whatsapp_solicitado_en`, then calls this.
 * Today it sends nothing: the first message is initiated by Mango, outside any 24-hour window, so
 * it needs a template approved by Meta (ARCHITECTURE.md §14), and with the test number the phone
 * must be among its five recipients.
 *
 * Block 10 of `ROADMAP.md` replaces the body with: validate the code against `invitaciones` (unused,
 * not expired), send the Meta template to the number, and, when the person answers from WhatsApp,
 * create the `canales` row that links the chat to the account. The copy the web shows stays
 * honest until then: "we saved your number; Mango will write to you".
 */
export async function requestChannelLink(usuarioId: string): Promise<{ sent: false; reason: 'template-pending' }> {
  void usuarioId
  return { sent: false, reason: 'template-pending' }
}
