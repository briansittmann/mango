'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { useAmountFormatter } from '@/components/atoms/amount-format'
import { Collapsible } from '@/components/atoms/collapsible'
import { ExpandChevron } from '@/components/atoms/expand-chevron'
import { UpcomingChargeRow } from '@/components/molecules/upcoming-charge-row'
import type { UpcomingCharge } from '@/lib/data/upcoming-charges'

type UpcomingChargesCardProps = {
  charges: UpcomingCharge[]
  currency: string
  open: boolean
  onToggle: () => void
  onOpenDefinition?: (charge: UpcomingCharge) => void
}

const PANEL_ID = 'upcoming-charges-panel'
const TAKEN_ID = 'upcoming-charges-taken'
const NAME_ID = 'upcoming-charges-name'
const NEXT_ID = 'upcoming-charges-next'
const PENDING_HEADING_ID = 'upcoming-charges-pending'

export function selectNextCharge(charges: UpcomingCharge[]): UpcomingCharge | null {
  if (charges.length === 0) return null
  const pending = charges.filter((charge) => !charge.charged)
  const pool = pending.length > 0 ? pending : charges
  return pool.reduce((lowest, charge) => (charge.day < lowest.day ? charge : lowest))
}

export function UpcomingChargesCard({ charges, currency, open, onToggle, onOpenDefinition }: UpcomingChargesCardProps) {
  const t = useTranslations('proximosCobros')
  const tRecurrente = useTranslations('gastoRecurrente')
  const { money } = useAmountFormatter()
  // Taken charges start folded on load and keep the user's choice afterwards (design D5).
  const [takenOpen, setTakenOpen] = useState(false)

  if (charges.length === 0) return null

  const nextCharge = selectNextCharge(charges)
  const total = charges.reduce((sum, charge) => sum + charge.amount, 0)
  const pending = charges.filter((charge) => !charge.charged)
  const taken = charges.filter((charge) => charge.charged)

  function renderRow(charge: UpcomingCharge, first: boolean) {
    const amountText = money(charge.amount, currency)
    const stateText = t(charge.charged ? 'cobrado' : 'pendiente')
    const progressText = charge.progress
      ? tRecurrente('progreso', { hechas: charge.progress.done, total: charge.progress.total })
      : null
    const expectedText =
      charge.amount !== charge.expectedAmount ? tRecurrente('esperado', { monto: money(charge.expectedAmount, currency) }) : null
    // The visible muted line is part of the name too (label in name), after what the row is for.
    const rowLabel = [t('fila', { nombre: charge.name, dia: charge.day }), charge.category, amountText, stateText, progressText, expectedText]
      .filter(Boolean)
      .join(', ')

    return (
      <UpcomingChargeRow
        key={charge.id}
        day={charge.day}
        name={charge.name}
        details={[charge.category, expectedText, progressText].filter((part): part is string => !!part)}
        amount={charge.amount}
        currency={currency}
        color={charge.color}
        charged={charge.charged}
        label={rowLabel}
        onActivate={onOpenDefinition ? () => onOpenDefinition(charge) : undefined}
        first={first}
      />
    )
  }

  return (
    <div className="overflow-hidden rounded-card border border-border bg-card">
      <div className="relative flex min-h-14 items-center gap-3 px-inset">
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={open}
          aria-controls={PANEL_ID}
          aria-labelledby={`${NAME_ID} ${NEXT_ID}`}
          className="pressable absolute inset-0 [--press-scale:1]"
        />
        <div className="pointer-events-none relative flex flex-1 items-center gap-3">
          <span id={NAME_ID} className="flex-1 truncate text-left text-body-lg font-medium text-foreground">
            {t('titulo')}
          </span>
          {nextCharge ? (
            <span id={NEXT_ID} className="shrink-0 text-label-ui text-muted-foreground">
              {t('fila', { nombre: nextCharge.name, dia: nextCharge.day })}
            </span>
          ) : null}
          <ExpandChevron open={open} />
        </div>
      </div>

      <Collapsible open={open} id={PANEL_ID}>
        {pending.length > 0 ? (
          <div role="group" aria-labelledby={PENDING_HEADING_ID}>
            <h3 id={PENDING_HEADING_ID} className="px-inset pb-1 pt-1 text-label-ui text-muted-foreground">
              {t('grupoPendientes')}
            </h3>
            {pending.map((charge, index) => renderRow(charge, index === 0))}
          </div>
        ) : null}

        {taken.length > 0 ? (
          <>
            <button
              type="button"
              onClick={() => setTakenOpen((value) => !value)}
              aria-expanded={takenOpen}
              aria-controls={TAKEN_ID}
              className="pressable flex min-h-12 w-full items-center gap-3 px-inset text-left outline-none [--press-scale:1] focus-visible:outline-2 focus-visible:-outline-offset-2"
            >
              <span className="flex-1 text-label-ui text-muted-foreground">{t('grupoCobrados', { n: taken.length })}</span>
              {/* A 16px chevron centred in the header chevron's 20px column. */}
              <span className="grid size-5 shrink-0 place-items-center">
                <ExpandChevron open={takenOpen} className="size-4" />
              </span>
            </button>
            <Collapsible open={takenOpen} id={TAKEN_ID}>
              {taken.map((charge, index) => renderRow(charge, index === 0))}
            </Collapsible>
          </>
        ) : null}

        <div className="border-t border-border" />
        <p className="px-inset py-3 text-body-sm text-muted-foreground" style={{ fontVariantNumeric: 'tabular-nums' }}>
          {t('pie', { monto: money(total, currency) })}
        </p>
      </Collapsible>
    </div>
  )
}
