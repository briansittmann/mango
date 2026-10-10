import { useState, type ReactNode } from 'react'
import { useTranslations } from 'next-intl'
import { Collapsible } from '@/components/atoms/collapsible'
import { ExpandChevron } from '@/components/atoms/expand-chevron'
import { Sparkline } from '@/components/atoms/sparkline'
import { TrendDelta } from '@/components/atoms/trend-delta'
import { useFirstReveal } from '@/components/hooks/use-first-reveal'
import { AnimatedAmount } from '@/components/ui/counter/animated-amount'
import { cn } from '@/lib/utils'

export type SummaryGroupItem = {
  key: string
  label: string
  total: number
  /**
   * Six history points ending at the shown cycle, and whether a rise is good (`dashboard-ui` →
   * *Summary cards*). Hidden for now (2026-10-03): the template passes it only behind
   * `SHOW_SUMMARY_TRENDS`, off until the tiles show them again.
   */
  trend?: { points: number[]; upIsGood: boolean }
  /** One line of context under the total, shown by the `tiles` layout only (`desktop-shell` → *Stat tiles*). */
  caption?: string
  /** Whether the tile opens a panel (`dialog`) or runs an action in place; the accordion ignores it. */
  opens?: boolean
  panel: ReactNode
}

type SummaryGroupProps = {
  items: SummaryGroupItem[]
  openKey: string | null
  onToggle: (key: string) => void
  currency: string
  /**
   * `accordion` is the phone's grouped surface with one panel at a time under the columns;
   * `tiles` (at `lg`) is three separate bordered tiles with no panel — the page opens the
   * panel as a side sheet from `openKey` (design D4).
   */
  layout?: 'accordion' | 'tiles'
}

const PANEL_ID = 'summary-group-panel'

export function SummaryGroup({ items, openKey, onToggle, currency, layout = 'accordion' }: SummaryGroupProps) {
  const tResumen = useTranslations('resumen')
  const [lastKey, setLastKey] = useState<string | null>(openKey ?? items[0]?.key ?? null)
  const [prevOpenKey, setPrevOpenKey] = useState(openKey)
  const [revealRef, revealed] = useFirstReveal()

  if (openKey !== prevOpenKey) {
    setPrevOpenKey(openKey)
    if (openKey) setLastKey(openKey)
  }

  const panelItem = items.find((item) => item.key === lastKey)

  function trendSlot(item: SummaryGroupItem) {
    if (!item.trend) return null
    const points = item.trend.points
    const current = points[points.length - 1] ?? item.total
    const previous = points[points.length - 2] ?? 0
    return (
      <>
        {/* The delta row keeps its height when there is no base to compare against, so the
            three columns stay in step (`dashboard-ui` → *The three columns keep one shape*). */}
        <span className="mt-1.5 flex h-[18px] w-full items-center" data-summary-trend>
          <TrendDelta current={current} previous={previous} upIsGood={item.trend.upIsGood} label={tResumen('vsCicloAnterior')} />
        </span>
        <Sparkline points={points} revealed={revealed} className="mt-1 h-5" />
      </>
    )
  }

  if (layout === 'tiles') {
    return (
      <div ref={revealRef} className="grid h-full grid-cols-3 gap-stack" data-summary-tiles>
        {items.map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => onToggle(item.key)}
            aria-haspopup={item.opens ? 'dialog' : undefined}
            aria-expanded={item.opens ? openKey === item.key : undefined}
            data-summary-column={item.key}
            className="pressable summary-tile flex min-w-0 flex-col items-start justify-center rounded-card border border-border bg-card px-inset py-5 text-left [--press-scale:0.99]"
          >
            {/* Label and caption step up one size at `xl`; at exactly 1024px each tile is ~170px wide. */}
            <span className="w-full truncate text-body-md text-muted-foreground xl:text-body-lg">{item.label}</span>
            <AnimatedAmount
              amount={item.total}
              currency={currency}
              className={cn('mt-2 whitespace-nowrap text-foreground', item.total >= 100000 ? 'text-headline-md' : 'text-headline-lg')}
            />
            {item.caption ? <span className="mt-2 w-full truncate text-body-md text-muted-foreground xl:text-body-lg">{item.caption}</span> : null}
            {trendSlot(item)}
          </button>
        ))}
      </div>
    )
  }

  return (
    <div ref={revealRef} className="rounded-card border border-border bg-card overflow-hidden">
      <div className="grid grid-cols-3 divide-x divide-border">
        {items.map((item) => {
          const open = openKey === item.key
          return (
            <button
              key={item.key}
              type="button"
              onClick={() => onToggle(item.key)}
              aria-expanded={open}
              aria-controls={PANEL_ID}
              data-summary-column={item.key}
              className="pressable relative flex flex-col items-start p-3 text-left"
            >
              <span className="flex w-full items-center justify-between gap-1">
                <span className="truncate text-label-ui text-muted-foreground">{item.label}</span>
                <ExpandChevron open={open} className="size-4" />
              </span>
              <AnimatedAmount
                amount={item.total}
                currency={currency}
                className={`mt-2 whitespace-nowrap text-foreground ${item.total >= 100000 ? 'text-tabular-numeric-md' : 'text-tabular-numeric-lg'}`}
              />
              {trendSlot(item)}
              {open ? <span aria-hidden className="absolute inset-x-3 bottom-0 h-0.5 rounded-full bg-brand" /> : null}
            </button>
          )
        })}
      </div>
      <Collapsible open={openKey !== null} id={PANEL_ID} className="border-t border-border">
        {panelItem?.panel}
      </Collapsible>
    </div>
  )
}
