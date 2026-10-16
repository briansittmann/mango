import { Check } from 'lucide-react'
import { Fragment } from 'react'
import { CardThumb } from '@/components/atoms/card-thumb'
import { Money } from '@/components/atoms/money'
import type { CategoryColor } from '@/lib/data/dashboard'
import { cn } from '@/lib/utils'

type UpcomingChargeRowProps = {
  day: number
  name: string
  /** The muted line's parts: the category's name, then the card's name, "esperado X" and "4 de 10" when they apply. */
  details: string[]
  amount: number
  currency: string
  color: CategoryColor
  /** The colour of the card the charge leaves from; draws its thumbnail left of the amount. */
  cardColor?: CategoryColor | null
  charged: boolean
  /** The full accessible name: name, day, category, card, amount, state, progress and expected amount. */
  label: string
  onActivate?: () => void
  first?: boolean
}

/**
 * One row of "Próximos cobros" (`upcoming-charges` → *Expanded state lists pending charges first*),
 * in the geometry of a "Movimientos" row (design D1–D4): the day on a mark tinted with the category,
 * a check badge once taken, the name over a muted line, and a flat amount.
 */
export function UpcomingChargeRow({ day, name, details, amount, currency, color, cardColor, charged, label, onActivate, first }: UpcomingChargeRowProps) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={!onActivate}
      onClick={onActivate}
      className={cn(
        'pressable relative flex min-h-row w-full items-center gap-3 px-inset py-2.5 text-left outline-none hover:bg-foreground/[0.04] focus-visible:outline-2 focus-visible:-outline-offset-2',
        !first && 'before:absolute before:left-[60px] before:right-0 before:top-0 before:h-px before:bg-border',
      )}
    >
      <span
        aria-hidden
        className="relative grid size-8 shrink-0 place-items-center rounded-full text-label-ui font-medium text-foreground tabular-nums"
        // The tint of a "Movimientos" mark plus a 1.5px ring in the full colour, so even the muted
        // categories read as theirs (inset, so the mark keeps its 32px).
        style={{
          background: `color-mix(in oklab, var(--cat-${color}) 16%, transparent)`,
          boxShadow: `inset 0 0 0 1.5px var(--cat-${color})`,
        }}
      >
        {day}
        {charged ? (
          <span className="absolute -bottom-1 -right-1 grid size-3.5 place-items-center rounded-full bg-foreground text-card ring-2 ring-card">
            <Check className="size-2.5" strokeWidth={3} />
          </span>
        ) : null}
      </span>
      <span className="block min-w-0 flex-1">
        <span className="block truncate text-body-lg text-foreground">{name}</span>
        {/* Wraps instead of truncating, the expected amount and the progress being what it is for
            (D3), and only between parts, so "4 de 10" never splits. */}
        <span className="block text-body-sm text-muted-foreground">
          {details.map((part, index) => (
            <Fragment key={index}>
              {index > 0 ? ' · ' : null}
              <span className="whitespace-nowrap">{part}</span>
            </Fragment>
          ))}
        </span>
      </span>
      {/* The "Movimientos" amount box without its chip: same right edge, flat at rest (D4). The card
          thumbnail rides inside it, a fixed gap from the amount, so it never moves the amount. */}
      <span className="inline-flex shrink-0 items-center gap-2 px-2 py-0.5 text-tabular-numeric-md text-foreground">
        {cardColor ? <CardThumb color={cardColor} /> : null}
        <Money amount={amount} currency={currency} />
      </span>
    </button>
  )
}
