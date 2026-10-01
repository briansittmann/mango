import { useAmountFormatter } from '@/components/atoms/amount-format'
import { cn } from '@/lib/utils'

type MoneyProps = {
  amount: number
  currency: string
  className?: string
  currencyClassName?: string
  signDisplay?: Intl.NumberFormatOptions['signDisplay']
}

export function Money({ amount, currency, className, currencyClassName, signDisplay }: MoneyProps) {
  const { parts } = useAmountFormatter()
  const formatted = parts(amount, currency, signDisplay)

  if (!currencyClassName) {
    return (
      <span className={className} style={{ fontVariantNumeric: 'tabular-nums' }}>
        {formatted.text}
      </span>
    )
  }

  const symbolIndex = formatted.parts.findIndex((part) => part.type === 'symbol')

  return (
    <span className={className} style={{ fontVariantNumeric: 'tabular-nums' }}>
      {formatted.parts.map((part, index) => {
        const isSpaceNextToCurrency =
          part.type === 'literal' && part.value.trim() === '' && (index === symbolIndex - 1 || index === symbolIndex + 1)

        if (isSpaceNextToCurrency) {
          return null
        }

        if (part.type === 'symbol') {
          return (
            <span key={index} className={cn(currencyClassName, formatted.symbolFirst ? 'mr-2' : 'ml-2')}>
              {part.value}
            </span>
          )
        }

        return part.value
      })}
    </span>
  )
}
