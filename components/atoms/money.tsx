import { useFormatter } from 'next-intl'
import { currencyFormatOptions } from '@/i18n/formats'

type MoneyProps = {
  amount: number
  currency: string
  className?: string
}

export function Money({ amount, currency, className }: MoneyProps) {
  const format = useFormatter()

  return (
    <span className={className} style={{ fontVariantNumeric: 'tabular-nums' }}>
      {format.number(amount, { ...currencyFormatOptions, currency })}
    </span>
  )
}
