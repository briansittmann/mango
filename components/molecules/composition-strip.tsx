'use client'

import type { MouseEvent } from 'react'
import { useFormatter, useTranslations } from 'next-intl'
import { useAmountFormatter } from '@/components/atoms/amount-format'
import { useFirstReveal } from '@/components/hooks/use-first-reveal'
import { ChartTooltip, TooltipValue, useChartTooltip } from '@/components/molecules/chart-tooltip'
import { cn } from '@/lib/utils'

type CompositionStripProps = {
  /** The free margin, the cycle's income and its net savings (`dashboard-ui` → *Cycle header and free margin*). */
  amount: number
  income: number
  savings: number
  currency: string
  className?: string
  /** Drawn at once instead of on its first scroll into view: for the fixed sidebar, which never scrolls. */
  instant?: boolean
}

type SegmentKey = 'gastado' | 'ahorrado' | 'libre'

const SEGMENT_CLASS: Record<SegmentKey, string> = {
  gastado: 'bg-foreground/20',
  ahorrado: 'bg-brand/50',
  libre: 'bg-brand',
}

/** Whether the strip has anything to show: a non-negative margin over a positive income. */
export function hasComposition(amount: number, income: number): boolean {
  return amount >= 0 && income > 0
}

/**
 * The income's split into spent, saved and free: one thin bar, a label under each segment, a
 * tooltip with the amount and the share. Shared by the hero card (below `lg`) and the sidebar's
 * savings block (at `lg`), which is why it owns its reveal and its tooltip.
 */
export function CompositionStrip({ amount, income, savings, currency, className, instant = false }: CompositionStripProps) {
  const t = useTranslations('dashboard')
  const format = useFormatter()
  const { money } = useAmountFormatter()
  const tooltip = useChartTooltip()
  const [revealRef, seen] = useFirstReveal()
  const revealed = instant || seen

  // What the free margin counts as spent is whatever of the income is neither saved nor free.
  const spent = income - savings - amount
  const segments = (
    [
      { key: 'gastado', value: spent },
      { key: 'ahorrado', value: savings },
      { key: 'libre', value: amount },
    ] as { key: SegmentKey; value: number }[]
  ).filter((segment) => segment.value > 0)
  if (!hasComposition(amount, income) || segments.length === 0) return null
  const share = (value: number) => format.number(value / income, { style: 'percent', maximumFractionDigits: 0 })

  return (
    <div
      ref={(node) => {
        revealRef(node)
        tooltip.containerRef(node)
      }}
      className={cn('relative', className)}
      data-composition-strip
    >
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
            // A tap on a segment shows its tooltip; it must not fold the card it may sit in.
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
      <ChartTooltip state={tooltip} />
    </div>
  )
}
