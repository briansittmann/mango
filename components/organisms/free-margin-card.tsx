import { useTranslations } from 'next-intl'
import { Money } from '@/components/atoms/money'

type FreeMarginCardProps = {
  amount: number
  currency: string
}

export function FreeMarginCard({ amount, currency }: FreeMarginCardProps) {
  const t = useTranslations('dashboard')

  return (
    <div className="relative overflow-hidden rounded-2xl border border-border bg-card px-4 py-6 text-center">
      <div aria-hidden className="pointer-events-none absolute inset-0 bg-hero-glow blur-3xl" />
      <p className="relative text-xs font-medium text-muted-foreground">{t('margenLibre')}</p>
      <Money
        amount={amount}
        currency={currency}
        className="relative mt-1 block text-4xl font-semibold text-foreground"
      />
    </div>
  )
}
