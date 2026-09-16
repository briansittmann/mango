import { Money } from '@/components/atoms/money'
import { ShortDate } from '@/components/atoms/short-date'
import { cn } from '@/lib/utils'

type ExpenseRowProps = {
  name: string
  date: string
  amount: number
  currency: string
  timeZone: string
  onActivate?: () => void
  first?: boolean
}

export function ExpenseRow({ name, date, amount, currency, timeZone, onActivate, first }: ExpenseRowProps) {
  const rowClassName = cn(
    'relative flex min-h-row w-full items-center gap-3 px-inset py-2.5 text-left hover:bg-foreground/[0.04]',
    !first && 'before:absolute before:left-4 before:right-0 before:top-0 before:h-px before:bg-border',
  )
  const amountClassName = cn(
    'shrink-0 text-tabular-numeric-md text-foreground',
    onActivate && 'rounded-lg bg-muted px-2 py-0.5',
  )

  if (onActivate) {
    return (
      <button type="button" onClick={onActivate} className={cn(rowClassName, 'pressable')}>
        <span className="block min-w-0 flex-1">
          <span className="block truncate text-body-lg text-foreground">{name}</span>
          <ShortDate date={date} timeZone={timeZone} className="block text-body-sm text-muted-foreground" />
        </span>
        <Money amount={amount} currency={currency} className={amountClassName} />
      </button>
    )
  }

  return (
    <div className={rowClassName}>
      <div className="min-w-0 flex-1">
        <p className="truncate text-body-lg text-foreground">{name}</p>
        <ShortDate date={date} timeZone={timeZone} className="text-body-sm text-muted-foreground" />
      </div>
      <Money amount={amount} currency={currency} className={amountClassName} />
    </div>
  )
}
