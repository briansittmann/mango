import { useTranslations } from 'next-intl'
import { Money } from '@/components/atoms/money'

type FreeMarginCardProps = {
  amount: number
  currency: string
}

export function FreeMarginCard({ amount, currency }: FreeMarginCardProps) {
  const t = useTranslations('dashboard')

  return (
    <div className="hero-card rounded-card border p-5">
      <p className="flex items-center gap-1.5 text-label-caps uppercase text-brand-ink">
        <span aria-hidden className="size-1.5 rounded-full bg-brand-ink" />
        {t('margenLibre')}
      </p>
      <Money
        amount={amount}
        currency={currency}
        currencyClassName="text-headline-md"
        className="hero-value mt-2 block font-display text-display-mobile sm:text-display"
      />
    </div>
  )
}
