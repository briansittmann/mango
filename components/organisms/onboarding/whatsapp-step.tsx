import { useTranslations } from 'next-intl'
import { FieldRow } from '@/components/molecules/field-row'

type WhatsAppStepProps = {
  phone: string
  code: string
  onPhoneChange: (phone: string) => void
  onCodeChange: (code: string) => void
  inviteRequired: boolean
  /** The account's country's prefix, as the phone placeholder (`+54 9 11 …`). */
  callingCode: string | null
  error: 'taken' | 'invalid' | 'save' | null
  /** The number was stored: the honest line while the onboarding closes. */
  saved: boolean
  disabled?: boolean
}

/**
 * Step 7 (`onboarding` → *Closing step stores a WhatsApp request and sends nothing*, D11): the
 * explanation, the phone and, while the invitation is required, the code. "Vincular" and "Seguir
 * sin WhatsApp" are the template's. The copy never says a message was sent.
 */
export function WhatsAppStep({ phone, code, onPhoneChange, onCodeChange, inviteRequired, callingCode, error, saved, disabled }: WhatsAppStepProps) {
  const t = useTranslations('onboarding')
  const placeholder = callingCode ? `${callingCode} …` : '+…'
  const errorText = error === 'taken' ? t('whatsapp.numeroEnOtraCuenta') : error === 'invalid' ? t('whatsapp.numeroInvalido') : error === 'save' ? t('errorGuardar') : null

  return (
    <div className="flex flex-col gap-4">
      <h1 className="font-display text-headline-lg text-foreground">{t('whatsapp.titulo')}</h1>
      <p className="text-body-md text-muted-foreground">{t(inviteRequired ? 'whatsapp.explicacion' : 'whatsapp.explicacionSinCodigo')}</p>
      <div className="rounded-card border bg-card">
        <FieldRow label={t('whatsapp.telefono')} htmlFor="whatsapp-phone">
          <input
            id="whatsapp-phone"
            type="tel"
            autoComplete="tel"
            inputMode="tel"
            enterKeyHint={inviteRequired ? 'next' : 'done'}
            placeholder={placeholder}
            readOnly={disabled}
            aria-invalid={error === 'taken' || error === 'invalid' || undefined}
            aria-describedby={errorText ? 'whatsapp-error' : undefined}
            value={phone}
            onChange={(event) => onPhoneChange(event.target.value)}
            className="field-focus w-44 rounded-lg bg-muted px-2 py-1.5 text-right text-body-lg text-foreground outline-none placeholder:text-muted-foreground/70"
          />
        </FieldRow>
        {inviteRequired ? (
          <FieldRow label={t('whatsapp.codigo')} htmlFor="whatsapp-code">
            <input
              id="whatsapp-code"
              type="text"
              autoComplete="one-time-code"
              autoCapitalize="characters"
              enterKeyHint="done"
              readOnly={disabled}
              value={code}
              onChange={(event) => onCodeChange(event.target.value)}
              className="field-focus w-44 rounded-lg bg-muted px-2 py-1.5 text-right font-mono text-body-lg uppercase text-foreground outline-none"
            />
          </FieldRow>
        ) : null}
      </div>
      {errorText ? (
        <p id="whatsapp-error" role="alert" className="text-body-sm text-destructive-ink">
          {errorText}
        </p>
      ) : null}
      {saved ? (
        <p role="status" className="text-body-md text-foreground">
          {t('whatsapp.guardado')}
        </p>
      ) : null}
    </div>
  )
}
