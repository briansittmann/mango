import { Banknote, CreditCard } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { Money } from '@/components/atoms/money'
import { ShortDate } from '@/components/atoms/short-date'
import type { PaymentMethod } from '@/lib/data/payment-method'
import { cn } from '@/lib/utils'

type ExpenseRowProps = {
  name: string
  date: string
  amount: number
  currency: string
  timeZone: string
  onActivate?: () => void
  first?: boolean
  /** A muted banknote or card before the date, and the method in words for assistive technology (D9). */
  paymentMethod?: PaymentMethod | null
}

/** The date line; with a method, the icon sits before the date and a row without one keeps the old markup. */
function DateLine({ date, timeZone, paymentMethod }: Pick<ExpenseRowProps, 'date' | 'timeZone' | 'paymentMethod'>) {
  const t = useTranslations('medioPago')
  if (!paymentMethod) return <ShortDate date={date} timeZone={timeZone} className="block text-body-sm text-muted-foreground" />
  const Icon = paymentMethod === 'efectivo' ? Banknote : CreditCard
  return (
    <span data-payment-method={paymentMethod} className="flex items-center gap-1 text-body-sm text-muted-foreground">
      <Icon aria-hidden className="size-3.5 shrink-0" />
      <ShortDate date={date} timeZone={timeZone} />
      <span className="sr-only">{t(paymentMethod === 'efectivo' ? 'sufijoEfectivo' : 'sufijoTarjeta')}</span>
    </span>
  )
}

export function ExpenseRow({ name, date, amount, currency, timeZone, onActivate, first, paymentMethod }: ExpenseRowProps) {
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
          <DateLine date={date} timeZone={timeZone} paymentMethod={paymentMethod} />
        </span>
        <Money amount={amount} currency={currency} className={amountClassName} />
      </button>
    )
  }

  return (
    <div className={rowClassName}>
      <div className="min-w-0 flex-1">
        <p className="truncate text-body-lg text-foreground">{name}</p>
        {paymentMethod ? (
          <DateLine date={date} timeZone={timeZone} paymentMethod={paymentMethod} />
        ) : (
          <ShortDate date={date} timeZone={timeZone} className="text-body-sm text-muted-foreground" />
        )}
      </div>
      <Money amount={amount} currency={currency} className={amountClassName} />
    </div>
  )
}
