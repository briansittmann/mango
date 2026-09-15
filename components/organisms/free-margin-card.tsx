import { useTranslations } from 'next-intl'
import { Money } from '@/components/atoms/money'

type FreeMarginCardProps = {
  amount: number
  currency: string
}

export function FreeMarginCard({ amount, currency }: FreeMarginCardProps) {
  const t = useTranslations('dashboard')

  return (
    <div className="hero-card rounded-card border px-inset py-5">
      <p className="text-body-lg text-muted-foreground">{t('margenLibre')}</p>
      <Money
        amount={amount}
        currency={currency}
        currencyClassName="text-headline-md"
        className="hero-value mt-2 block font-display text-display-mobile sm:text-display"
      />
    </div>
  )
}
