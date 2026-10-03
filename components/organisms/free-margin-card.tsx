'use client'

import { useState, useSyncExternalStore, type MouseEvent } from 'react'
import { useFormatter, useTranslations } from 'next-intl'
import { useAmountFormatter } from '@/components/atoms/amount-format'
import { Collapsible } from '@/components/atoms/collapsible'
import { useFirstReveal } from '@/components/hooks/use-first-reveal'
import { ChartTooltip, TooltipValue, useChartTooltip } from '@/components/molecules/chart-tooltip'
import { AnimatedAmount } from '@/components/ui/counter/animated-amount'
import { cn } from '@/lib/utils'

type FreeMarginCardProps = {
  amount: number
  currency: string
  /** The cycle's income and net savings, for the composition strip (`dashboard-ui` → *Cycle header and free margin*); without them (the landing's sample) there is no strip. */
  income?: number
  savings?: number
}

type SegmentKey = 'gastado' | 'ahorrado' | 'libre'

const SEGMENT_CLASS: Record<SegmentKey, string> = {
  gastado: 'bg-foreground/20',
  ahorrado: 'bg-brand/50',
  libre: 'bg-brand',
}

const STRIP_ID = 'free-margin-composition'
/** The desktop layout's breakpoint (`lg`), where the strip is always shown. */
const WIDE_QUERY = '(min-width: 64rem)'

function subscribeToWide(onChange: () => void) {
  const query = matchMedia(WIDE_QUERY)
  query.addEventListener('change', onChange)
  return () => query.removeEventListener('change', onChange)
}

export function FreeMarginCard({ amount, currency, income = 0, savings = 0 }: FreeMarginCardProps) {
  const t = useTranslations('dashboard')
  const format = useFormatter()
  const { money } = useAmountFormatter()
  const tooltip = useChartTooltip()
  const [revealRef, revealed] = useFirstReveal()
  const wide = useSyncExternalStore(subscribeToWide, () => matchMedia(WIDE_QUERY).matches, () => false)
  const [open, setOpen] = useState(false)

  // What the free margin counts as spent is whatever of the income is neither saved nor free.
  const spent = income - savings - amount
  const segments = (
    [
      { key: 'gastado', value: spent },
      { key: 'ahorrado', value: savings },
      { key: 'libre', value: amount },
    ] as { key: SegmentKey; value: number }[]
  ).filter((segment) => segment.value > 0)
  const showStrip = amount >= 0 && income > 0 && segments.length > 0
  const share = (value: number) => format.number(value / income, { style: 'percent', maximumFractionDigits: 0 })
  // Below `lg` the strip is folded away and the whole card opens it, with nothing on screen that
  // says so: the number is the screen's answer and the strip is context for whoever wants it.
  const toggles = showStrip && !wide
  const expanded = wide || open

  const heading = (
    <>
      <span className="block text-body-lg text-muted-foreground">{t('margenLibre')}</span>
      <AnimatedAmount
        amount={amount}
        currency={currency}
        currencyClassName="text-headline-md"
        className="hero-value mt-2 block font-display text-display-mobile sm:text-display"
      />
    </>
  )

  return (
    <div
      ref={(node) => {
        revealRef(node)
        tooltip.containerRef(node)
      }}
      onClick={toggles ? () => setOpen((value) => !value) : undefined}
      data-toggle={toggles ? '' : undefined}
      className={cn('hero-card rounded-card border px-inset py-5', amount < 0 && 'hero-card--negative')}
    >
      {toggles ? (
        // The click bubbles to the card, which owns the toggle; the button is the keyboard and
        // assistive-technology handle on it (its name is the label and the figure).
        <button
          type="button"
          aria-expanded={open}
          aria-controls={STRIP_ID}
          className="block w-full rounded-lg text-left outline-none focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"
        >
          {heading}
        </button>
      ) : (
        <div>{heading}</div>
      )}
      {showStrip ? (
        // At `lg` CSS shows the strip from the first paint, before the media query is read.
        <Collapsible open={expanded} id={STRIP_ID} className="lg:grid-rows-[1fr] lg:opacity-100">
          <div className="pt-5" data-composition-strip>
            <div role="group" aria-label={t('composicion')} className="flex gap-0.5">
              {segments.map((segment, index) => (
                <div
                  key={segment.key}
                  tabIndex={0}
                  role="img"
                  aria-label={`${t(segment.key)} · ${money(segment.value, currency)} · ${t('delIngreso', { porcentaje: share(segment.value) })}`}
                  data-segment={segment.key}
                  className="chart-fade -my-2.5 min-w-1 rounded-full py-2.5 outline-none focus-visible:[&>span]:ring-2 focus-visible:[&>span]:ring-ring focus-visible:[&>span]:ring-offset-2 focus-visible:[&>span]:ring-offset-card"
                  style={{ flexGrow: segment.value, flexBasis: 0, ['--fade-delay' as string]: `${index * 40}ms` }}
                  data-revealed={revealed ? '' : undefined}
                  // A tap on a segment shows its tooltip; it must not fold the strip it sits in.
                  onClick={(event: MouseEvent) => event.stopPropagation()}
                  {...tooltip.trigger(
                    segment.key,
                    <TooltipValue
                      value={money(segment.value, currency)}
                      label={`${t(segment.key)} · ${t('delIngreso', { porcentaje: share(segment.value) })}`}
                    />,
                    { touchToggle: true },
                  )}
                >
                  <span className={cn('block h-1.5 rounded-full', SEGMENT_CLASS[segment.key])} />
                </div>
              ))}
            </div>
            {/* Each label starts under its segment but never shrinks below its text, so a thin segment's
                label pushes the next one along instead of printing over it. */}
            <div aria-hidden className="mt-2 flex gap-2">
              {segments.map((segment, index) => (
                <span
                  key={segment.key}
                  className="chart-fade min-w-max text-label-ui text-muted-foreground"
                  style={{ flexGrow: segment.value, flexBasis: 0, ['--fade-delay' as string]: `${index * 40 + 80}ms` }}
                  data-revealed={revealed ? '' : undefined}
                >
                  {t(segment.key)}
                </span>
              ))}
            </div>
          </div>
        </Collapsible>
      ) : null}
      <ChartTooltip state={tooltip} />
    </div>
  )
}
