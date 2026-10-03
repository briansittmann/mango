import { useState } from 'react'
import { Check, ChevronDown, Clock, Loader2 } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { Collapsible } from '@/components/atoms/collapsible'
import { PhoneField, phoneValid, type PhoneDraft } from '@/components/molecules/phone-field'
import { LinkCode, previewMessage } from '@/components/molecules/whatsapp-link'
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
  phone: PhoneDraft
  onPhoneChange: (next: PhoneDraft) => void
  onSavePhone: () => void
  savingPhone: boolean
  phoneError: 'taken' | 'invalid' | 'save' | null
  phoneSaved: boolean
  disabled?: boolean
}

/**
 * Step 7 (`onboarding` → *Closing step*, `add-whatsapp-linking` D7, D11): the explanation, a chat
 * preview with the real code (the person's bubble, then Mango's reply, entering 400 ms apart),
 * the state row, the code for typing by hand, and the optional number under a collapsed line.
 * "Vincular WhatsApp", "Ir a mi mes" and "Seguir sin WhatsApp" are the template's.
 */
export function WhatsAppStep({ number, code, linked, phase, phone, onPhoneChange, onSavePhone, savingPhone, phoneError, phoneSaved, disabled }: WhatsAppStepProps) {
  const t = useTranslations('onboarding')
  const [phoneOpen, setPhoneOpen] = useState(false)
  const errorText =
    phoneError === 'taken' ? t('whatsapp.numeroEnOtraCuenta') : phoneError === 'invalid' ? t('whatsapp.numeroInvalido') : phoneError === 'save' ? t('errorGuardar') : null
  const canSave = phoneValid(phone) && !savingPhone && !disabled

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

      {/* The optional number, folded under one line: only for Meta's recipient list while the test number lasts. */}
      <div className="rounded-card border bg-card">
        <button
          type="button"
          onClick={() => setPhoneOpen((open) => !open)}
          disabled={disabled}
          aria-expanded={phoneOpen}
          aria-controls="whatsapp-phone-panel"
          className="pressable flex min-h-row w-full items-center gap-3 px-inset text-left text-body-lg text-foreground disabled:opacity-50"
        >
          <span className="flex-1">{t('whatsapp.dejarNumero')}</span>
          <ChevronDown aria-hidden className={cn('size-5 text-muted-foreground transition-[rotate] duration-200 ease-drawer motion-reduce:transition-none', phoneOpen && 'rotate-180')} />
        </button>
        <Collapsible id="whatsapp-phone-panel" open={phoneOpen}>
          <div className="flex flex-col gap-3 px-inset pb-4">
            <PhoneField
              idPrefix="onboarding"
              value={phone}
              onChange={onPhoneChange}
              labels={{ country: t('whatsapp.pais'), local: t('whatsapp.numeroLocal'), invalid: t('whatsapp.numeroInvalido'), taken: t('whatsapp.numeroEnOtraCuenta') }}
              error={phoneError === 'taken' || phoneError === 'invalid' ? phoneError : null}
              disabled={disabled || savingPhone}
            />
            {phoneError === 'save' && errorText ? (
              <p role="alert" className="text-body-sm text-destructive-ink">
                {errorText}
              </p>
            ) : null}
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={onSavePhone}
                disabled={!canSave}
                aria-busy={savingPhone || undefined}
                className="onboarding-button relative flex h-11 items-center justify-center overflow-hidden rounded-[16px] bg-foreground/[0.06] px-4 text-body-md font-semibold text-foreground outline-none focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-50"
              >
                <span className={cn('transition-opacity duration-150 motion-reduce:transition-none', savingPhone && 'opacity-0')}>{t('whatsapp.guardarNumero')}</span>
                {savingPhone ? <Loader2 aria-hidden className="absolute inset-0 m-auto size-5 animate-spin" /> : null}
              </button>
              {phoneSaved ? (
                <p role="status" className="flex items-center gap-1.5 text-body-sm font-medium text-brand-ink">
                  <Check aria-hidden className="size-4" />
                  {t('whatsapp.numeroGuardado')}
                </p>
              ) : null}
            </div>
            <p className="text-body-sm text-muted-foreground">{t('whatsapp.paraQue')}</p>
          </div>
        </Collapsible>
      </div>
    </div>
  )
}
