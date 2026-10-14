import { Check, Clock } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { LinkCode, previewMessage, WhatsAppQr } from '@/components/molecules/whatsapp-link'
import { cn } from '@/lib/utils'
// A pure formatter over the stored number, not data access (add-whatsapp-linking D8).
// eslint-disable-next-line @typescript-eslint/no-restricted-imports
import { formatPhone } from '@/lib/data/phone'

export type LinkPhase = 'idle' | 'waiting' | 'linked'

type WhatsAppStepProps = {
  /** The number people write to; null when the deployment has none (the manual line shows). */
  number: string | null
  /** The account's live code; null until it arrives (the bubble shows a placeholder). */
  code: string | null
  /** The linked identifier once the chat sent the message. */
  linked: string | null
  phase: LinkPhase
  /** A tablet or a computer: the QR to scan takes the link's place. */
  qr: boolean
}

/**
 * Step 7 (`onboarding` → *Closing step*, `add-whatsapp-linking` D7, D11): the explanation, a chat
 * preview with the real code (the person's bubble, then Mango's reply, entering 400 ms apart),
 * the QR on a tablet or a computer, the state row and the code for typing by hand.
 * "Vincular WhatsApp", "Ir a mi mes" and "Seguir sin WhatsApp" are the template's.
 */
export function WhatsAppStep({ number, code, linked, phase, qr }: WhatsAppStepProps) {
  const t = useTranslations('onboarding')

  return (
    <div className="flex flex-col gap-4">
      <h1 className="font-display text-headline-lg text-foreground">{t('whatsapp.titulo')}</h1>
      <p className="text-body-md text-muted-foreground">{t('whatsapp.explicacion')}</p>

      {/* The chat preview: what will happen, with the real code (D11: the stagger recipe, 150 and 550 ms). */}
      <div data-chat-preview className="flex flex-col gap-2 rounded-card border bg-card p-4">
        <div
          data-bubble="person"
          className="onboarding-fade-in max-w-[82%] self-end rounded-[18px] rounded-br-[6px] bg-brand/[0.16] px-3.5 py-2 text-body-md text-foreground motion-reduce:animate-none"
          style={{ animationDelay: '150ms' }}
        >
          {previewMessage(code)}
        </div>
        <div
          data-bubble="mango"
          className="onboarding-fade-in max-w-[82%] self-start rounded-[18px] rounded-bl-[6px] bg-foreground/[0.06] px-3.5 py-2 text-body-md text-foreground motion-reduce:animate-none"
          style={{ animationDelay: '550ms' }}
        >
          {t('whatsapp.previewMango')}
        </div>
      </div>

      {qr && number && phase !== 'linked' ? (
        <WhatsAppQr
          number={number}
          code={code}
          labels={{ titulo: t('whatsapp.qrTitulo'), linea: t('whatsapp.qrLinea'), abrirAqui: t('whatsapp.qrAbrirAqui'), qr: t('whatsapp.qr') }}
        />
      ) : null}

      {/* The state row: hidden while idle; "waiting" is static; "linked" pops its check (D11). */}
      {phase !== 'idle' ? (
        <div data-link-state={phase} className="flex items-start gap-3 rounded-card border bg-card px-4 py-3">
          <span
            className={cn(
              'grid size-9 shrink-0 place-items-center rounded-full',
              phase === 'linked' ? 'bg-brand/[0.16] text-brand-ink' : 'bg-foreground/[0.06] text-muted-foreground',
            )}
          >
            {phase === 'linked' ? (
              <Check aria-hidden className="size-5 animate-segment-pop motion-reduce:animate-none" />
            ) : (
              <Clock aria-hidden className="size-5" />
            )}
          </span>
          {/* Keyed on the phase: the new text fades in over 200 ms (D11, cross-fade). */}
          <div key={phase} className="min-w-0 flex-1 transition-opacity duration-200 ease-[ease] starting:opacity-0 motion-reduce:transition-none">
            <p role="status" className="text-body-lg font-semibold text-foreground">
              {phase === 'linked' ? t('whatsapp.estadoVinculado') : t('whatsapp.estadoEsperando')}
            </p>
            <p className="text-body-sm text-muted-foreground">{phase === 'linked' && linked ? formatPhone(linked) : t('whatsapp.estadoEsperandoLinea')}</p>
          </div>
        </div>
      ) : null}

      {phase !== 'linked' ? (
        <LinkCode number={number} code={code} labels={{ codigo: t('whatsapp.codigo'), sinNumero: t('whatsapp.sinNumero', { codigo: code ?? '······' }) }} />
      ) : null}
    </div>
  )
}
