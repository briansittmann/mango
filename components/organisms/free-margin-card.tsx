import { useTranslations } from 'next-intl'
import { AnimatedAmount } from '@/components/ui/counter/animated-amount'
import { cn } from '@/lib/utils'

type FreeMarginCardProps = {
  amount: number
  currency: string
}

export function FreeMarginCard({ amount, currency }: FreeMarginCardProps) {
  const t = useTranslations('dashboard')

  return (
    <div className={cn('hero-card rounded-card border px-inset py-5', amount < 0 && 'hero-card--negative')}>
      <p className="text-body-lg text-muted-foreground">{t('margenLibre')}</p>
      <AnimatedAmount
        amount={amount}
        currency={currency}
        currencyClassName="text-headline-md"
        className="hero-value mt-2 block font-display text-display-mobile sm:text-display"
      />
    </div>
  )
}
