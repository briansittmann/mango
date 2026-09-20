import { useState, type ReactNode } from 'react'
import { Collapsible } from '@/components/atoms/collapsible'
import { ExpandChevron } from '@/components/atoms/expand-chevron'
import { AnimatedAmount } from '@/components/ui/counter/animated-amount'

type SummaryGroupItem = {
  key: string
  label: string
  total: number
  /** Integer digits the tile is built for — see `AnimatedAmount`. */
  places: number
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
  const [lastKey, setLastKey] = useState<string | null>(openKey ?? items[0]?.key ?? null)
  const [prevOpenKey, setPrevOpenKey] = useState(openKey)

  if (openKey !== prevOpenKey) {
    setPrevOpenKey(openKey)
    if (openKey) setLastKey(openKey)
  }

  const panelItem = items.find((item) => item.key === lastKey)

  return (
    <div className="rounded-card border border-border bg-card overflow-hidden">
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
              className="pressable relative flex flex-col items-start p-3 text-left"
            >
              <span className="flex w-full items-center justify-between gap-1">
                <span className="truncate text-label-ui text-muted-foreground">{item.label}</span>
                <ExpandChevron open={open} className="size-4" />
              </span>
              <AnimatedAmount
                amount={item.total}
                currency={currency}
                places={item.places}
                className={`mt-2 whitespace-nowrap text-foreground ${item.total >= 100000 ? 'text-tabular-numeric-md' : 'text-tabular-numeric-lg'}`}
              />
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
