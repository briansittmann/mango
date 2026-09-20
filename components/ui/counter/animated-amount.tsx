'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useLocale } from 'next-intl'
import { currencyFormatOptions } from '@/i18n/formats'
import { Money } from '@/components/atoms/money'
import { cn } from '@/lib/utils'
import { Counter, type PlaceValue } from './counter'

type AnimatedAmountProps = {
  amount: number
  currency: string
  /**
   * How many integer digits the counter is built for. Pass the biggest the figure is expected to
   * reach: columns above the current value are dropped rather than shown as leading zeros, so an
   * over-estimate costs nothing, while the count never redraws itself from the value the way the
   * component's own default `places` does. A value past `places` still shows in full.
   */
  places: number
  className?: string
  currencyClassName?: string
}

/** The box the counter is painted on, for the fade that masks the rolling digits. Set per surface
 * in `globals.css` — a fixed black bleeds over anything that is not a dark card. */
const SURFACE = 'var(--counter-surface, var(--card))'

/** Extra height above and below the digits, as a fraction of the font size, so the rolling glyphs
 * have somewhere to come from. The fade covers exactly this much. */
const PADDING_RATIO = 0.2

/** How far a digit's baseline sits above the bottom of its own box, as a fraction of the font size:
 * half the box, less the ~0.3em from a centred line box's middle down to its baseline. A clipped
 * inline-block has no baseline of its own — the bottom edge stands in for one — so the counter is
 * lowered by this much to sit on the text baseline of whatever is beside it, the currency symbol
 * above all. */
const BASELINE_OFFSET_RATIO = (1 + PADDING_RATIO) / 2 - 0.3

type Metrics = { fontSize: number; tracking: number }

export function AnimatedAmount({ amount, currency, places, className, currencyClassName }: AnimatedAmountProps) {
  const locale = useLocale()
  const ref = useRef<HTMLSpanElement>(null)
  const [metrics, setMetrics] = useState<Metrics | null>(null)

  // Reduced motion is read once, on mount, the way `AnimatedContent` reads it: with no metrics the
  // plain number is what renders, which is also what the server and the first client render paint,
  // so nothing swaps under hydration.
  useEffect(() => {
    const el = ref.current
    if (!el || matchMedia('(prefers-reduced-motion: reduce)').matches) return

    function read() {
      const style = getComputedStyle(el!)
      const tracking = parseFloat(style.letterSpacing)
      setMetrics({ fontSize: parseFloat(style.fontSize), tracking: Number.isNaN(tracking) ? 0 : tracking })
    }

    read()
    // The typography is responsive (`text-display-mobile sm:text-display`), and the roll height is
    // a pixel count, so it has to be taken again whenever the breakpoint can have moved.
    window.addEventListener('resize', read)
    return () => window.removeEventListener('resize', read)
  }, [])

  const format = useMemo(() => {
    const formatter = new Intl.NumberFormat(locale, { ...currencyFormatOptions, currency })
    const parts = formatter.formatToParts(Math.abs(amount))
    // 1234.5 always has both separators, which the amount itself may not: es-ES gives "." and ","
    // where en-US gives "," and ".".
    const probe = formatter.formatToParts(1234.5)

    const currencyIndex = parts.findIndex((part) => part.type === 'currency')
    const spacer = parts.find(
      (part, index) => part.type === 'literal' && (index === currencyIndex - 1 || index === currencyIndex + 1),
    )

    return {
      text: formatter.format(amount),
      symbol: parts[currencyIndex]?.value ?? '',
      symbolFirst: currencyIndex === 0,
      spacer: spacer?.value ?? '',
      // A locale's own minus, U+2212 in Spanish, not the hyphen it looks like.
      minusSign: formatter.formatToParts(-1).find((part) => part.type === 'minusSign')?.value ?? '-',
      group: probe.find((part) => part.type === 'group')?.value ?? '.',
      decimal: probe.find((part) => part.type === 'decimal')?.value ?? ',',
      fractionDigits: parts.reduce((total, part) => total + (part.type === 'fraction' ? part.value.length : 0), 0),
    }
  }, [locale, currency, amount])

  const counterPlaces = useMemo(() => {
    const integerDigits = Math.max(places, Math.floor(Math.abs(amount)).toString().length)
    const list: PlaceValue[] = []
    for (let exponent = integerDigits - 1; exponent >= 0; exponent--) {
      list.push(10 ** exponent)
      if (exponent > 0 && exponent % 3 === 0) list.push(format.group)
    }
    if (format.fractionDigits > 0) {
      list.push(format.decimal)
      for (let exponent = 1; exponent <= format.fractionDigits; exponent++) list.push(10 ** -exponent)
    }
    return list
  }, [places, amount, format])

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
    <span ref={ref} className={className} style={{ fontVariantNumeric: 'tabular-nums' }}>
      {metrics === null ? (
        <Money amount={amount} currency={currency} currencyClassName={currencyClassName} />
      ) : (
        // Each column carries all ten digits, so the counter reads aloud as "0123456789" per place.
        // The figure is exposed once, as text, and the roll is left to the eye.
        <>
          <span className="sr-only">{format.text}</span>
          <span aria-hidden="true">
            {format.symbolFirst ? symbol : null}
            {amount < 0 ? format.minusSign : null}
            <Counter
              value={Math.abs(amount)}
              from={0}
              places={counterPlaces}
              hideLeadingZeros
              fontSize={metrics.fontSize}
              padding={metrics.fontSize * PADDING_RATIO}
              gap={0}
              borderRadius={0}
              horizontalPadding={0}
              gradientHeight={metrics.fontSize * PADDING_RATIO}
              gradientFrom={SURFACE}
              // Tracking is set on the text, but a digit column is a fixed `1ch` box that text never
              // spans, so it has to be given back as a margin or the counter reads looser than the
              // static number it replaces.
              digitStyle={{ marginRight: metrics.tracking }}
              containerStyle={{ verticalAlign: -metrics.fontSize * BASELINE_OFFSET_RATIO }}
            />
            {format.symbolFirst ? null : symbol}
          </span>
        </>
      )}
    </span>
  )
}
