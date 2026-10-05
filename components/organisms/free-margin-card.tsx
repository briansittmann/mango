'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { useAmountFormatter } from '@/components/atoms/amount-format'
import { Collapsible } from '@/components/atoms/collapsible'
import { CompositionStrip, hasComposition } from '@/components/molecules/composition-strip'
import { AnimatedAmount } from '@/components/ui/counter/animated-amount'
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
}

const STRIP_ID = 'free-margin-composition'

export function FreeMarginCard({ amount, currency, income = 0, savings = 0, presentation = 'card' }: FreeMarginCardProps) {
  const t = useTranslations('dashboard')
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
          // Four tiles at exactly 1024px leave ~230px each: the number steps down one size and back up at `xl`.
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
    </div>
  )
}
