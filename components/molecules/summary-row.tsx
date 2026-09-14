import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { CategoryDot } from '@/components/atoms/category-dot'
import { Money } from '@/components/atoms/money'
import type { CategoryColor } from '@/lib/data/dashboard'

type SummaryRowProps = {
  color?: CategoryColor
  name: string
  detail?: ReactNode
  amount: number
  currency: string
  tone?: 'positive' | 'negative'
}

export function SummaryRow({ color, name, detail, amount, currency, tone }: SummaryRowProps) {
  return (
    <div className="relative flex min-h-12 items-center gap-3 px-4 py-3 before:absolute before:left-4 before:right-0 before:top-0 before:h-px before:bg-border first:before:hidden hover:bg-foreground/[0.04]">
      {color ? (
        <div className="grid size-8 shrink-0 place-items-center rounded-full bg-muted">
          <CategoryDot color={color} />
        </div>
      ) : null}
      <div className="min-w-0 flex-1">
        <p className="truncate text-body-lg text-foreground">{name}</p>
        {detail ? <div className="truncate text-body-sm text-muted-foreground">{detail}</div> : null}
      </div>
      <Money
        amount={amount}
        currency={currency}
        className={cn(
          'shrink-0 text-tabular-numeric-md',
          tone === 'positive' && 'text-positive',
          tone === 'negative' && 'text-destructive',
          !tone && 'text-foreground',
        )}
      />
    </div>
  )
}
