import { useTranslations } from 'next-intl'
import { AmountField } from '@/components/molecules/amount-field'

type SavingsStepProps = {
  value: string
  onChange: (text: string) => void
  currency: string
  invalid: boolean
  disabled?: boolean
}

/**
 * Step 6 (`onboarding` → *Savings target step*, D11): one optional amount on a surface. The hero
 * stays on screen from step 5 and the preview line sits under it, both rendered by the template.
 */
export function SavingsStep({ value, onChange, currency, invalid, disabled }: SavingsStepProps) {
  const t = useTranslations('onboarding')
  const tAmount = useTranslations('hojaGasto')

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-card border bg-card">
        <AmountField
          id="savings-target"
          label={t('ahorro.meta')}
          currency={currency}
          value={value}
          onChange={onChange}
          disabled={disabled}
          optional
          invalid={invalid}
          invalidMessage={tAmount('importeInvalido')}
        />
        <p className="px-inset pb-3 text-body-sm text-muted-foreground">{t('ahorro.opcional')}</p>
      </div>
    </div>
  )
}
