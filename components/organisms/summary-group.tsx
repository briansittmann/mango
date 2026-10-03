import { useState, type ReactNode } from 'react'
import { useTranslations } from 'next-intl'
import { Collapsible } from '@/components/atoms/collapsible'
import { ExpandChevron } from '@/components/atoms/expand-chevron'
import { Sparkline } from '@/components/atoms/sparkline'
import { TrendDelta } from '@/components/atoms/trend-delta'
import { useFirstReveal } from '@/components/hooks/use-first-reveal'
import { AnimatedAmount } from '@/components/ui/counter/animated-amount'

type SummaryGroupItem = {
  key: string
  label: string
  total: number
  /**
   * Six history points ending at the shown cycle, and whether a rise is good (`dashboard-ui` →
   * *Summary cards*). Hidden for now (2026-10-03): the template passes it only behind
   * `SHOW_SUMMARY_TRENDS`, off until the tiles show them again.
   */
  trend?: { points: number[]; upIsGood: boolean }
  panel: ReactNode
}

type SummaryGroupProps = {
  items: SummaryGroupItem[]
  openKey: string | null
  onToggle: (key: string) => void
  currency: string
}

const PANEL_ID = 'summary-group-panel'

export function SummaryGroup({ items, openKey, onToggle, currency }: SummaryGroupProps) {
  const tResumen = useTranslations('resumen')
  const [lastKey, setLastKey] = useState<string | null>(openKey ?? items[0]?.key ?? null)
  const [prevOpenKey, setPrevOpenKey] = useState(openKey)
  const [revealRef, revealed] = useFirstReveal()

  if (openKey !== prevOpenKey) {
    setPrevOpenKey(openKey)
    if (openKey) setLastKey(openKey)
  }

  const panelItem = items.find((item) => item.key === lastKey)

  return (
    <div ref={revealRef} className="rounded-card border border-border bg-card overflow-hidden">
      <div className="grid grid-cols-3 divide-x divide-border">
        {items.map((item) => {
          const open = openKey === item.key
          const points = item.trend?.points ?? []
          const current = points[points.length - 1] ?? item.total
          const previous = points[points.length - 2] ?? 0
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
              {item.trend ? (
                <>
                  {/* The delta row keeps its height when there is no base to compare against, so the
                      three columns stay in step (`dashboard-ui` → *The three columns keep one shape*). */}
                  <span className="mt-1.5 flex h-[18px] w-full items-center" data-summary-trend>
                    <TrendDelta current={current} previous={previous} upIsGood={item.trend.upIsGood} label={tResumen('vsCicloAnterior')} />
                  </span>
                  <Sparkline points={points} revealed={revealed} className="mt-1 h-5" />
                </>
              ) : null}
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
