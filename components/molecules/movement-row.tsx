import { ArrowDownLeft, ArrowUpRight, PiggyBank } from 'lucide-react'
import type { Ref } from 'react'
import { CategoryDot } from '@/components/atoms/category-dot'
import { Money } from '@/components/atoms/money'
import type { CategoryColor } from '@/lib/data/dashboard'
import { cn } from '@/lib/utils'

type MovementRowProps = {
  kind: 'expense' | 'income' | 'savings'
  name: string
  /** The muted line: the category's name, "Ingreso", "Depósito" or "Retiro". */
  kindLabel: string
  /** Signed for savings (a withdrawal is negative), positive otherwise. */
  amount: number
  currency: string
  /** The expense's category colour; unused for the other kinds. */
  color?: CategoryColor
  /** The full accessible name: description, kind, day and signed amount. */
  label: string
  onActivate?: () => void
  first?: boolean
  rowRef?: Ref<HTMLElement>
}

/**
 * One row of the "Movimientos" card (`transaction-list` → *Movement rows*, design D7): a mark of its
 * kind, the description over a muted line that names the kind, and the amount. Income carries a
 * "+" in the brand ink; savings carry "+" or "−" in the regular ink; expenses are unsigned.
 */
export function MovementRow({ kind, name, kindLabel, amount, currency, color, label, onActivate, first, rowRef }: MovementRowProps) {
  const sign = kind === 'expense' ? null : amount < 0 ? '−' : '+'
  const content = (
    <>
      <span
        aria-hidden
        className={cn('grid size-8 shrink-0 place-items-center rounded-full', kind !== 'expense' && 'bg-muted')}
        style={kind === 'expense' && color ? { background: `color-mix(in oklab, var(--cat-${color}) 16%, transparent)` } : undefined}
      >
        {kind === 'expense' && color ? (
          <CategoryDot color={color} />
        ) : kind === 'income' ? (
          <ArrowDownLeft className="size-4 text-brand-ink" />
        ) : amount < 0 ? (
          <ArrowUpRight className="size-4 text-foreground" />
        ) : (
          <PiggyBank className="size-4 text-foreground" />
        )}
      </span>
      <span className="block min-w-0 flex-1">
        <span className="block truncate text-body-lg text-foreground">{name}</span>
        <span className="block truncate text-body-sm text-muted-foreground">{kindLabel}</span>
      </span>
      <span
        className={cn(
          // Same padding with or without the chip, so every amount ends on one line.
          'shrink-0 rounded-lg px-2 py-0.5 text-tabular-numeric-md',
          kind === 'income' ? 'text-brand-ink' : 'text-foreground',
          onActivate && 'bg-muted',
        )}
      >
        {sign}
        <Money amount={Math.abs(amount)} currency={currency} />
      </span>
    </>
  )
  const className = cn(
    'relative flex min-h-row w-full items-center gap-3 px-inset py-2.5 text-left hover:bg-foreground/[0.04]',
    !first && 'before:absolute before:left-[60px] before:right-0 before:top-0 before:h-px before:bg-border',
  )

  if (onActivate) {
    return (
      <button
        ref={rowRef as Ref<HTMLButtonElement>}
        type="button"
        onClick={onActivate}
        aria-label={label}
        data-movement-row={kind}
        className={cn(className, 'pressable outline-none focus-visible:outline-2 focus-visible:-outline-offset-2')}
      >
        {content}
      </button>
    )
  }

  // Read-only rows still take focus after "Mostrar más" (D8), so they are focusable but not tabbable.
  return (
    <div ref={rowRef as Ref<HTMLDivElement>} tabIndex={-1} role="group" aria-label={label} data-movement-row={kind} className={cn(className, 'outline-none')}>
      {content}
    </div>
  )
}
