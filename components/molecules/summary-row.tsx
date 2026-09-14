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
}

export function SummaryRow({ color, name, detail, amount, currency }: SummaryRowProps) {
  return (
    <div className="flex min-h-12 items-center gap-3 py-2">
      {color ? <CategoryDot color={color} /> : null}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm text-foreground">{name}</p>
        {detail ? <div className="truncate text-xs text-muted-foreground">{detail}</div> : null}
      </div>
      <Money
        amount={amount}
        currency={currency}
        className={cn('shrink-0 text-sm', amount < 0 ? 'text-destructive' : 'text-foreground')}
      />
    </div>
  )
}
