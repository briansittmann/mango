import { useFormatter, useTranslations } from 'next-intl'
import { Money } from '@/components/atoms/money'
import { currencyFormatOptions } from '@/i18n/formats'

type FreeMarginCardProps = {
  amount: number
  currency: string
  income: number
}

export function FreeMarginCard({ amount, currency, income }: FreeMarginCardProps) {
  const t = useTranslations('dashboard')
  const format = useFormatter()

  return (
    <div className="hero-card rounded-card border p-5">
      <div className="flex items-start justify-between">
        <p className="flex items-center gap-1.5 text-label-caps uppercase text-brand-ink">
          <span aria-hidden className="size-1.5 rounded-full bg-brand-ink" />
          {t('margenLibre')}
        </p>
        <span className="flex items-center gap-1.5 rounded-full border border-brand/30 bg-brand/10 px-2.5 py-1 text-label-caps uppercase text-brand-ink">
          <span aria-hidden className="size-1.5 rounded-full bg-brand" />
          {t('available')}
        </span>
      </div>
      <Money
        amount={amount}
        currency={currency}
        currencyClassName="text-headline-md"
        className="hero-value mt-2 block font-display text-display-mobile sm:text-display"
      />
      <div className="mt-4 h-px bg-brand/30" />
      <div className="mt-3 flex items-center justify-between text-body-md">
        <span className="text-muted-foreground">{t('freeMarginIncome')}</span>
        <span className="font-semibold text-foreground">
          {format.number(income, { ...currencyFormatOptions, currency })}
        </span>
      </div>
    </div>
  )
}
