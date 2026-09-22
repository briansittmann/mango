import { useCallback } from 'react'
import { gsap } from 'gsap'
import { ArrowDown, ArrowUp } from 'lucide-react'
import { Money } from '@/components/atoms/money'
import { ShortDate } from '@/components/atoms/short-date'
import { cn } from '@/lib/utils'

type SavingsMovementRowProps = {
  name: string
  date: string
  amount: number
  currency: string
  timeZone: string
  depositLabel: string
  withdrawalLabel: string
  /** Position among the panel's movements — sets this row's stagger delay on entrance. */
  index: number
}

const STAGGER_SECONDS = 0.04

export function SavingsMovementRow({
  name,
  date,
  amount,
  currency,
  timeZone,
  depositLabel,
  withdrawalLabel,
  index,
}: SavingsMovementRowProps) {
  const isDeposit = amount > 0

  // A ref callback, not an effect: it runs during the commit that mounts this row — exactly when
  // the savings panel is first opened, since `SummaryGroup` only renders the active panel's tree —
  // and before the browser paints, so the row's opacity is never seen at 1 before its tween starts.
  const setRowRef = useCallback(
    (el: HTMLDivElement | null) => {
      if (!el) return
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        gsap.set(el, { clearProps: 'opacity,transform', opacity: 1 })
        return
      }
      gsap.set(el, { opacity: 0, y: 6 })
      gsap.to(el, {
        opacity: 1,
        y: 0,
        duration: 0.14,
        ease: 'power2.out',
        delay: index * STAGGER_SECONDS,
        clearProps: 'transform,opacity',
      })
    },
    [index],
  )

  return (
    <div
      ref={setRowRef}
      data-savings-movement-row
      className="relative flex min-h-row w-full items-center gap-3 px-inset py-2.5 before:absolute before:left-4 before:right-0 before:top-0 before:h-px before:bg-border first:before:hidden"
    >
      <span
        aria-label={isDeposit ? depositLabel : withdrawalLabel}
        className="flex size-7 shrink-0 items-center justify-center rounded-full bg-muted"
      >
        {isDeposit ? (
          <ArrowUp aria-hidden className="size-3.5 text-foreground" />
        ) : (
          <ArrowDown aria-hidden className="size-3.5 text-foreground" />
        )}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-body-lg text-foreground">{name}</p>
        <ShortDate date={date} timeZone={timeZone} className="block text-body-sm text-muted-foreground" />
      </div>
      <span className={cn('shrink-0 text-tabular-numeric-md', isDeposit ? 'text-brand-ink' : 'text-foreground')}>
        {isDeposit ? '+' : '−'}<Money amount={Math.abs(amount)} currency={currency} />
      </span>
    </div>
  )
}
