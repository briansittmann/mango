import type { ReactNode } from 'react'
import { ExpandChevron } from '@/components/atoms/expand-chevron'
import { Money } from '@/components/atoms/money'

type SummaryCardProps = {
  label: string
  total: number
  currency: string
  open: boolean
  onToggle: () => void
  children: ReactNode
}

export function SummaryCard({ label, total, currency, open, onToggle, children }: SummaryCardProps) {
  return (
    <div className={`rounded-xl border bg-card p-3 ${open ? 'border-foreground/20' : 'border-border'}`}>
      <button type="button" onClick={onToggle} className="flex min-h-12 w-full flex-col items-center gap-1 text-center">
        <span className="truncate text-xs font-medium text-muted-foreground">{label}</span>
        <Money amount={total} currency={currency} className="text-sm font-medium text-foreground" />
        <ExpandChevron open={open} />
      </button>

      {open ? <div className="mt-3 flex flex-col gap-3 border-t border-border pt-3">{children}</div> : null}
    </div>
  )
}
