'use client'

import { animate, useMotionValue } from 'motion/react'
import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { useAmountFormatter } from '@/components/atoms/amount-format'
import { AnimatedAmount } from '@/components/ui/counter/animated-amount'
import { cn } from '@/lib/utils'

type LiveAmountProps = {
  amount: number
  currency: string
  className?: string
  currencyClassName?: string
}

function subscribeToReducedMotion(onChange: () => void) {
  const query = matchMedia('(prefers-reduced-motion: reduce)')
  query.addEventListener('change', onChange)
  return () => query.removeEventListener('change', onChange)
}

function getReducedSnapshot() {
  return matchMedia('(prefers-reduced-motion: reduce)').matches
}

function getReducedServerSnapshot() {
  return true
}

/**
 * A figure that follows a value changing under the finger (the onboarding's live free margin,
 * `add-web-onboarding` D10, D14): the first paint is the dashboard's count-up; from the first change
 * on, a `MotionValue` written straight to the DOM with Apple's critically damped spring
 * (`bounce: 0`, 0.4 s), so a new target retargets from wherever the number is, with its velocity.
 * Reduced motion sets the value at once. The sign and the figure are the only parts that change;
 * the symbol keeps its place and size.
 */
export function LiveAmount({ amount, currency, className, currencyClassName }: LiveAmountProps) {
  const { parts, figure } = useAmountFormatter()
  const reduced = useSyncExternalStore(subscribeToReducedMotion, getReducedSnapshot, getReducedServerSnapshot)
  const value = useMotionValue(amount)
  const initial = useRef(amount)
  const [live, setLive] = useState(false)
  const signRef = useRef<HTMLSpanElement>(null)
  const figureRef = useRef<HTMLSpanElement>(null)

  // Layout from the full form: the symbol's side never changes for a currency, the sign may appear.
  const layout = parts(amount, currency)

  useEffect(() => {
    if (amount !== initial.current) setLive(true)
  }, [amount])

  useEffect(() => {
    if (!live) {
      value.set(amount)
      return
    }
    if (reduced) {
      value.set(amount)
      return
    }
    const controls = animate(value, amount, { type: 'spring', bounce: 0, duration: 0.4 })
    return () => controls.stop()
  }, [amount, live, reduced, value])

  useEffect(() => {
    if (!live) return
    // The figure rolls in the target's unit and decimals (no cents under an integer target, `k`
    // under an abbreviated one); the sign follows the current value.
    const paint = (current: number) => {
      if (signRef.current) signRef.current.textContent = parts(current, currency).sign
      if (figureRef.current) figureRef.current.textContent = figure(current, currency, amount)
    }
    paint(value.get())
    return value.on('change', paint)
  }, [live, value, parts, figure, currency, amount])

  if (!live) {
    return <AnimatedAmount amount={amount} currency={currency} className={className} currencyClassName={currencyClassName} />
  }

  const symbol = (
    <span className={cn(currencyClassName, currencyClassName && (layout.symbolFirst ? 'mr-2' : 'ml-2'))}>
      {currencyClassName ? layout.symbol : layout.symbolFirst ? `${layout.symbol} ` : ` ${layout.symbol}`}
    </span>
  )

  return (
    <span className={className} style={{ fontVariantNumeric: 'tabular-nums' }}>
      {/* The settled figure is what assistive technology reads; the moving one is decoration. */}
      <span className="sr-only">{layout.text}</span>
      <span aria-hidden="true">
        <span ref={signRef} />
        {layout.symbolFirst ? symbol : null}
        <span ref={figureRef} data-live-figure />
        {layout.symbolFirst ? null : symbol}
      </span>
    </span>
  )
}
