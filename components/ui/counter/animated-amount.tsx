'use client'

import { useCallback, useMemo, useSyncExternalStore } from 'react'
import { useAmountFormatter } from '@/components/atoms/amount-format'
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
  const { parts, figure } = useAmountFormatter()
  const animate = useSyncExternalStore(subscribeToReducedMotion, getAnimateSnapshot, getAnimateServerSnapshot)

  // The sign, the symbol and the spaces as the full form lays them out; only the figure rolls
  // (in the abbreviated unit when the format in effect calls for one, D12).
  const formatted = useMemo(() => parts(amount, currency), [parts, amount, currency])
  const symbolIndex = formatted.parts.findIndex((part) => part.type === 'symbol')

  // The number only — the currency symbol is painted beside it so `currencyClassName` can size it.
  const formatNumber = useCallback((value: number) => figure(value, currency, amount), [figure, currency, amount])

  return (
    <span className={className} style={{ fontVariantNumeric: 'tabular-nums' }}>
      {!animate ? (
        <Money amount={amount} currency={currency} currencyClassName={currencyClassName} />
      ) : (
        // The figure is exposed once, as text, and the count is left to the eye.
        <>
          <span className="sr-only">{formatted.text}</span>
          <span aria-hidden="true">
            {formatted.parts.map((part, index) => {
              if (part.type === 'figure') {
                return <CountUp key={index} className="count-up" to={Math.abs(amount)} duration={DURATION} format={formatNumber} />
              }
              if (part.type === 'symbol') {
                return currencyClassName ? (
                  <span key={index} className={cn(currencyClassName, formatted.symbolFirst ? 'mr-2' : 'ml-2')}>
                    {part.value}
                  </span>
                ) : (
                  part.value
                )
              }
              // With a sized symbol its margin replaces the locale's space.
              const spaceNextToSymbol =
                part.type === 'literal' && part.value.trim() === '' && (index === symbolIndex - 1 || index === symbolIndex + 1)
              return currencyClassName && spaceNextToSymbol ? null : part.value
            })}
          </span>
        </>
      )}
    </span>
  )
}
