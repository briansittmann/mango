import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { ExpandChevron } from '@/components/atoms/expand-chevron'
import { Money } from '@/components/atoms/money'

type SummaryCardProps = {
  label: string
  total: number
  currency: string
  open: boolean
  onToggle: () => void
  accent?: boolean
  header?: ReactNode
  children: ReactNode
}

export function SummaryCard({ label, total, currency, open, onToggle, accent, header, children }: SummaryCardProps) {
  return (
    <div className="contents">
      <div
        className={cn(
          'order-1 rounded-card border bg-card',
          open
            ? 'border-brand/60 bg-muted shadow-[inset_0_1px_0_0_var(--raised-highlight)]'
            : 'border-border hover:border-brand/35',
        )}
      >
        <button type="button" onClick={onToggle} aria-expanded={open} className="flex min-h-[104px] w-full flex-col p-3 text-left">
          <span className="flex w-full items-center justify-between">
            <span className="text-label-caps uppercase text-muted-foreground">{label}</span>
            <ExpandChevron open={open} className="size-4" />
          </span>
          <Money
            amount={total}
            currency={currency}
            className={`mt-4 text-tabular-numeric-lg ${accent ? 'text-hero-accent text-glow-sm' : 'text-foreground'}`}
          />
        </button>
      </div>

      {open ? (
        <div className="order-2 col-span-3 rounded-card border border-border bg-card py-1">
          {header}
          {children}
        </div>
      ) : null}
    </div>
  )
}
