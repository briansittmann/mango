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
  /** "Ya ahorrado", shown after the date on a deposit the user already had. */
  tag?: string
  /** Opens the movement's edit sheet; without it the row is read-only. */
  onActivate?: () => void
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
  tag,
  onActivate,
}: SavingsMovementRowProps) {
  const isDeposit = amount > 0

  // A ref callback, not an effect: it runs during the commit that mounts this row — exactly when
  // the savings panel is first opened, since `SummaryGroup` only renders the active panel's tree —
  // and before the browser paints, so the row's opacity is never seen at 1 before its tween starts.
  const setRowRef = useCallback(
    (el: HTMLElement | null) => {
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

  const className = cn(
    'relative flex min-h-row w-full items-center gap-3 px-inset py-2.5 text-left before:absolute before:left-4 before:right-0 before:top-0 before:h-px before:bg-border first:before:hidden',
    onActivate && 'pressable hover:bg-foreground/[0.04]',
  )
  const content = (
    <>
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
      <span className="block min-w-0 flex-1">
        <span className="block truncate text-body-lg text-foreground">{name}</span>
        <span className="block text-body-sm text-muted-foreground">
          <ShortDate date={date} timeZone={timeZone} />
          {tag ? ` · ${tag}` : null}
        </span>
      </span>
      <span
        className={cn(
          'shrink-0 text-tabular-numeric-md',
          isDeposit ? 'text-brand-ink' : 'text-foreground',
          onActivate && 'rounded-lg bg-muted px-2 py-0.5',
        )}
      >
        {isDeposit ? '+' : '−'}<Money amount={Math.abs(amount)} currency={currency} />
      </span>
    </>
  )

  if (onActivate) {
    return (
      <button ref={setRowRef} type="button" onClick={onActivate} data-savings-movement-row className={className}>
        {content}
      </button>
    )
  }

  return (
    <div ref={setRowRef} data-savings-movement-row className={className}>
      {content}
    </div>
  )
}
