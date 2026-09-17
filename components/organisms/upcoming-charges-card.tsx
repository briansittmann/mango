import { Check, ChevronDown } from 'lucide-react'
import { useFormatter, useTranslations } from 'next-intl'
import { currencyFormatOptions } from '@/i18n/formats'
import { CategoryDot } from '@/components/atoms/category-dot'
import { Collapsible } from '@/components/atoms/collapsible'
import { DayChip } from '@/components/atoms/day-chip'
import { Money } from '@/components/atoms/money'
import type { UpcomingCharge } from '@/lib/data/upcoming-charges'
import { cn } from '@/lib/utils'

type UpcomingChargesCardProps = {
  charges: UpcomingCharge[]
  currency: string
  open: boolean
  onToggle: () => void
}

const PANEL_ID = 'upcoming-charges-panel'
const NAME_ID = 'upcoming-charges-name'
const NEXT_ID = 'upcoming-charges-next'

export function selectNextCharge(charges: UpcomingCharge[]): UpcomingCharge | null {
  if (charges.length === 0) return null
  const pending = charges.filter((charge) => !charge.charged)
  const pool = pending.length > 0 ? pending : charges
  return pool.reduce((lowest, charge) => (charge.day < lowest.day ? charge : lowest))
}

export function UpcomingChargesCard({ charges, currency, open, onToggle }: UpcomingChargesCardProps) {
  const t = useTranslations('proximosCobros')
  const format = useFormatter()

  if (charges.length === 0) return null

  const nextCharge = selectNextCharge(charges)
  const total = charges.reduce((sum, charge) => sum + charge.amount, 0)

  return (
    <div className="overflow-hidden rounded-card border border-border bg-card">
      <div className="relative flex min-h-11 items-center gap-3 px-inset">
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={open}
          aria-controls={PANEL_ID}
          aria-labelledby={`${NAME_ID} ${NEXT_ID}`}
          className="pressable absolute inset-0 [--press-scale:1]"
        />
        <div className="pointer-events-none relative flex flex-1 items-center gap-3">
          <span id={NAME_ID} className="flex-1 truncate text-left text-body-lg text-muted-foreground">
            {t('titulo')}
          </span>
          {nextCharge ? (
            <span id={NEXT_ID} className="shrink-0 text-label-ui text-muted-foreground">
              {t('fila', { nombre: nextCharge.name, dia: nextCharge.day })}
            </span>
          ) : null}
          <ChevronDown
            aria-hidden
            className={cn('size-4 shrink-0 text-muted-foreground transition-transform', open && 'rotate-180')}
          />
        </div>
      </div>

      <Collapsible open={open} id={PANEL_ID}>
        <div className="flex flex-col">
          {charges.map((charge) => {
            const amountText = format.number(charge.amount, { ...currencyFormatOptions, currency })
            const stateText = t(charge.charged ? 'cobrado' : 'pendiente')
            const rowLabel = `${t('fila', { nombre: charge.name, dia: charge.day })}, ${amountText}, ${stateText}`

            return (
              <div
                key={charge.id}
                aria-label={rowLabel}
                className={cn('flex min-h-row items-center gap-3 px-inset', charge.charged && 'opacity-[0.55]')}
              >
                <div aria-hidden className="flex flex-1 items-center gap-3">
                  <DayChip day={charge.day} />
                  <CategoryDot color={charge.color} className="size-1.5" />
                  <span className="flex min-w-0 flex-1 items-center gap-1">
                    <span className="truncate text-body-lg text-foreground">{charge.name}</span>
                    {charge.charged ? <Check className="size-3.5 shrink-0 text-foreground" /> : null}
                  </span>
                  <Money amount={charge.amount} currency={currency} className="shrink-0 text-tabular-numeric-md text-foreground" />
                </div>
              </div>
            )
          })}
        </div>

        <div className="border-t border-border" />
        <p className="px-inset py-3 text-body-sm text-muted-foreground" style={{ fontVariantNumeric: 'tabular-nums' }}>
          {t('pie', { monto: format.number(total, { ...currencyFormatOptions, currency }) })}
        </p>
      </Collapsible>
    </div>
  )
}
