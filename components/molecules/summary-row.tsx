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
  signed?: boolean
  onClick?: () => void
}

export function SummaryRow({ color, name, detail, amount, currency, tone, signed, onClick }: SummaryRowProps) {
  const className = cn(
    'relative flex min-h-row w-full items-center gap-3 px-inset py-2.5 text-left before:absolute before:left-4 before:right-0 before:top-0 before:h-px before:bg-border first:before:hidden hover:bg-foreground/[0.04]',
    onClick && 'pressable',
  )
  const content = (
    <>
      {color ? <CategoryDot color={color} /> : null}
      <div className="min-w-0 flex-1">
        <p className="truncate text-body-lg text-foreground">{name}</p>
        {detail ? <div className="truncate text-body-sm text-muted-foreground">{detail}</div> : null}
      </div>
      <Money
        amount={amount}
        currency={currency}
        signDisplay={signed ? 'exceptZero' : undefined}
        className={cn(
          'shrink-0 text-tabular-numeric-md',
          tone === 'positive' && 'text-positive',
          tone === 'negative' && 'text-destructive',
          !tone && 'text-foreground',
        )}
      />
    </>
  )

  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={className}>
        {content}
      </button>
    )
  }

  return <div className={className}>{content}</div>
}
