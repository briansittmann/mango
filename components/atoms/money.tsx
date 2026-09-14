import { useFormatter, useLocale } from 'next-intl'
import { currencyFormatOptions } from '@/i18n/formats'
import { cn } from '@/lib/utils'

type MoneyProps = {
  amount: number
  currency: string
  className?: string
  currencyClassName?: string
  signDisplay?: Intl.NumberFormatOptions['signDisplay']
}

export function Money({ amount, currency, className, currencyClassName, signDisplay }: MoneyProps) {
  const format = useFormatter()
  const locale = useLocale()

  if (!currencyClassName) {
    return (
      <span className={className} style={{ fontVariantNumeric: 'tabular-nums' }}>
        {format.number(amount, { ...currencyFormatOptions, currency, signDisplay })}
      </span>
    )
  }

  const parts = new Intl.NumberFormat(locale, { ...currencyFormatOptions, currency, signDisplay }).formatToParts(amount)
  const currencyIndex = parts.findIndex((part) => part.type === 'currency')
  const currencyIsFirst = currencyIndex === 0

  return (
    <span className={className} style={{ fontVariantNumeric: 'tabular-nums' }}>
      {parts.map((part, index) => {
        const isSpaceNextToCurrency =
          part.type === 'literal' && part.value.trim() === '' && (index === currencyIndex - 1 || index === currencyIndex + 1)

        if (isSpaceNextToCurrency) {
          return null
        }

        if (part.type === 'currency') {
          return (
            <span key={index} className={cn(currencyClassName, currencyIsFirst ? 'mr-2' : 'ml-2')}>
              {part.value}
            </span>
          )
        }

        return part.value
      })}
    </span>
  )
}
