'use client'

import { useCallback, useMemo, useSyncExternalStore } from 'react'
import { useLocale } from 'next-intl'
import { currencyFormatOptions } from '@/i18n/formats'
import { Money } from '@/components/atoms/money'
import { cn } from '@/lib/utils'
import CountUp from './count-up'

type AnimatedAmountProps = {
  amount: number
  currency: string
  className?: string
  currencyClassName?: string
}

/** How long a figure takes to reach its value, in seconds. */
const DURATION = 1

function subscribeToReducedMotion(onChange: () => void) {
  const query = matchMedia('(prefers-reduced-motion: reduce)')
  query.addEventListener('change', onChange)
  return () => query.removeEventListener('change', onChange)
}

function getAnimateSnapshot() {
  return !matchMedia('(prefers-reduced-motion: reduce)').matches
}

// The server has no `matchMedia`, so it paints the plain number; nothing swaps under hydration
// until the client subscribes and reads the real preference.
function getAnimateServerSnapshot() {
  return false
}

export function AnimatedAmount({ amount, currency, className, currencyClassName }: AnimatedAmountProps) {
  const locale = useLocale()
  const animate = useSyncExternalStore(subscribeToReducedMotion, getAnimateSnapshot, getAnimateServerSnapshot)

  const format = useMemo(() => {
    const formatter = new Intl.NumberFormat(locale, { ...currencyFormatOptions, currency })
    const parts = formatter.formatToParts(Math.abs(amount))

    const currencyIndex = parts.findIndex((part) => part.type === 'currency')
    const spacer = parts.find(
      (part, index) => part.type === 'literal' && (index === currencyIndex - 1 || index === currencyIndex + 1),
    )

    return {
      text: formatter.format(amount),
      symbol: parts[currencyIndex]?.value ?? '',
      symbolFirst: currencyIndex === 0,
      spacer: spacer?.value ?? '',
      // `stripIfInteger` drops the cents on a round figure, so the counter follows the same rule
      // instead of rolling two zeros the static number never shows.
      fractionDigits: parts.reduce((total, part) => total + (part.type === 'fraction' ? part.value.length : 0), 0),
    }
  }, [locale, currency, amount])

  // The number only — the currency symbol is painted beside it so `currencyClassName` can size it.
  const formatNumber = useCallback(
    (value: number) =>
      new Intl.NumberFormat(locale, {
        useGrouping: true,
        minimumFractionDigits: format.fractionDigits,
        maximumFractionDigits: format.fractionDigits,
      }).format(value),
    [locale, format.fractionDigits],
  )

  const symbol = currencyClassName ? (
    <span className={cn(currencyClassName, format.symbolFirst ? 'mr-2' : 'ml-2')}>{format.symbol}</span>
  ) : (
    <>
      {format.symbolFirst ? null : format.spacer}
      {format.symbol}
      {format.symbolFirst ? format.spacer : null}
    </>
  )

  return (
    <span className={className} style={{ fontVariantNumeric: 'tabular-nums' }}>
      {!animate ? (
        <Money amount={amount} currency={currency} currencyClassName={currencyClassName} />
      ) : (
        // The figure is exposed once, as text, and the count is left to the eye.
        <>
          <span className="sr-only">{format.text}</span>
          <span aria-hidden="true">
            {format.symbolFirst ? symbol : null}
            <CountUp className="count-up" to={amount} duration={DURATION} format={formatNumber} />
            {format.symbolFirst ? null : symbol}
          </span>
        </>
      )}
    </span>
  )
}
