'use client'

import { useState, type MouseEvent } from 'react'
import { ArrowLeftRight, Banknote, CreditCard } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useAmountFormatter } from '@/components/atoms/amount-format'
import { Collapsible } from '@/components/atoms/collapsible'
import { CompositionStrip, hasComposition } from '@/components/molecules/composition-strip'
import { AnimatedAmount } from '@/components/ui/counter/animated-amount'
import type { PaymentMethod } from '@/lib/data/payment-method'
import { cn } from '@/lib/utils'

type FreeMarginCardProps = {
  amount: number
  currency: string
  /** The cycle's income and net savings, for the composition strip (`dashboard-ui` → *Cycle header and free margin*); without them (the landing's sample) there is no strip. */
  income?: number
  savings?: number
  /**
   * `card` is the phone's hero: the strip folded under the number, the whole card its toggle.
   * `tile` is the first stat tile at `lg` (`desktop-shell` → *Stat tiles*): label, number and the
   * income line, no strip (it lives in the sidebar) and no control.
   */
  presentation?: 'card' | 'tile'
  /**
   * The pockets block (`payment-method` → *The pockets block in the free-margin card*, D7): shown
   * under everything else while given, as controls of their own that never fold the strip.
   */
  pockets?: Record<PaymentMethod, number>
  onOpenPocket?: (method: PaymentMethod, opener: HTMLElement) => void
  /** Without it there is no swap button: the page supplies no transfer operations. */
  onMoveMoney?: (opener: HTMLElement) => void
}

const POCKET_ICONS = { efectivo: Banknote, tarjeta: CreditCard } as const

const STRIP_ID = 'free-margin-composition'

export function FreeMarginCard({
  amount,
  currency,
  income = 0,
  savings = 0,
  presentation = 'card',
  pockets,
  onOpenPocket,
  onMoveMoney,
}: FreeMarginCardProps) {
  const t = useTranslations('dashboard')
  const tMedio = useTranslations('medioPago')
  const tEscritorio = useTranslations('escritorio')
  const { money } = useAmountFormatter()
  const [open, setOpen] = useState(false)

  const tile = presentation === 'tile'
  const showStrip = !tile && hasComposition(amount, income)
  // Below `lg` the strip is folded away and the whole card opens it, with nothing on screen that
  // says so: the number is the screen's answer and the strip is context for whoever wants it.
  const toggles = showStrip

  const heading = (
    <>
      <span className="block text-body-lg text-muted-foreground">{t('margenLibre')}</span>
      <AnimatedAmount
        amount={amount}
        currency={currency}
        currencyClassName="text-headline-md"
        className={cn(
          'hero-value mt-2 block font-display text-display-mobile sm:text-display',
          // Four equal tiles at 1024px leave ~230px each: the number steps down one size, and back up at `xl`,
          // where the tile takes 5/14 of the row so a seven-digit figure fits.
          tile && 'lg:text-display-mobile xl:text-display',
        )}
      />
      {tile && income > 0 ? (
        <span className="mt-2 block truncate text-body-md text-muted-foreground xl:text-body-lg">{tEscritorio('deIngresos', { monto: money(income, currency) })}</span>
      ) : null}
    </>
  )

  return (
    <div
      onClick={toggles ? () => setOpen((value) => !value) : undefined}
      data-toggle={toggles ? '' : undefined}
      data-free-margin-tile={tile ? '' : undefined}
      className={cn('hero-card rounded-card border px-inset py-5', tile && 'flex h-full flex-col justify-center', amount < 0 && 'hero-card--negative')}
    >
      {toggles ? (
        // The click bubbles to the card, which owns the toggle; the button is the keyboard and
        // assistive-technology handle on it (its name is the label and the figure).
        <button
          type="button"
          aria-expanded={open}
          aria-controls={STRIP_ID}
          className="block w-full rounded-lg text-left outline-none focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"
        >
          {heading}
        </button>
      ) : (
        <div>{heading}</div>
      )}
      {showStrip ? (
        <Collapsible open={open} id={STRIP_ID}>
          <CompositionStrip amount={amount} income={income} savings={savings} currency={currency} className="pt-5" />
        </Collapsible>
      ) : null}
      {pockets ? (
        // Its own controls: a press here neither folds the strip nor scales the card.
        <div
          data-pockets
          onClick={(event: MouseEvent) => event.stopPropagation()}
          // The `lg` tile is ~170px wide: there the blocks stack and the swap button sits on the divider.
          className={cn('relative mt-5 grid gap-3 border-t border-border pt-4', tile ? 'grid-cols-1 xl:grid-cols-2' : 'grid-cols-2')}
        >
          {(['efectivo', 'tarjeta'] satisfies PaymentMethod[]).map((method) => {
            const Icon = POCKET_ICONS[method]
            return (
              <button
                key={method}
                type="button"
                data-pocket={method}
                aria-label={tMedio('verBolsillo', { bolsillo: tMedio(method), saldo: money(pockets[method], currency) })}
                onClick={(event) => onOpenPocket?.(method, event.currentTarget)}
                className={cn(
                  'pressable flex min-h-target min-w-0 flex-col gap-1 rounded-inner bg-muted px-3 py-2.5 [--press-scale:0.97]',
                  method === 'efectivo'
                    ? 'items-start pr-7 text-left'
                    : tile
                      ? 'items-start text-left xl:items-end xl:pl-7 xl:text-right'
                      : 'items-end pl-7 text-right',
                )}
              >
                <span className="flex items-center gap-1.5 text-body-sm text-muted-foreground">
                  <Icon aria-hidden className="size-4 shrink-0" />
                  {tMedio(method)}
                </span>
                <AnimatedAmount
                  amount={pockets[method]}
                  currency={currency}
                  className={cn('block max-w-full truncate text-headline-md tabular-nums', pockets[method] < 0 ? 'text-destructive-ink' : 'text-foreground')}
                />
              </button>
            )
          })}
          {onMoveMoney ? (
            <button
              type="button"
              aria-label={tMedio('moverPlata')}
              data-move-money
              onClick={(event) => onMoveMoney(event.currentTarget)}
              className={cn(
                'pressable absolute grid size-11 -translate-y-1/2 place-items-center rounded-full border-2 border-primary bg-card text-foreground shadow-sm [--press-scale:0.96]',
                tile
                  ? 'right-0 top-0 xl:right-auto xl:left-1/2 xl:top-[calc(50%+0.5rem)] xl:-translate-x-1/2'
                  : 'left-1/2 top-[calc(50%+0.5rem)] -translate-x-1/2',
              )}
            >
              <ArrowLeftRight aria-hidden className="size-4" />
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
