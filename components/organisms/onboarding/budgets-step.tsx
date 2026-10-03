import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { useAmountFormatter } from '@/components/atoms/amount-format'
import { CategoryDot } from '@/components/atoms/category-dot'
import { Collapsible } from '@/components/atoms/collapsible'
import { AmountInput, parseAmount } from '@/components/molecules/amount-field'
import { BudgetProgress } from '@/components/molecules/budget-progress'
import { cn } from '@/lib/utils'
import type { BudgetStatus, CategoryColor } from '@/lib/data/dashboard'

/** One category of the envelope model, as the template computes it from the drafts (D10). */
export type EnvelopeRow = {
  id: string
  name: string
  color: CategoryColor
  /** The category's active fixed expenses, at their expected amounts. */
  fixed: number
  /** The budget as typed, parsed; null for empty or invalid. */
  budget: number | null
  /** The dashboard card's budget figures for this budget (spent = the fixed charges); null without one. */
  status: BudgetStatus | null
}

export type Envelope = {
  income: number
  rows: EnvelopeRow[]
  margin: number
}

type BudgetsStepProps = {
  envelope: Envelope
  currency: string
  drafts: Record<string, string>
  onDraftChange: (categoryId: string, text: string) => void
  /** Writes the committed value; resolves `'invalid'` for a bad value (nothing written) or `'failed'`. */
  onCommit: (categoryId: string, text: string) => Promise<'ok' | 'invalid' | 'failed'>
  onIncomeStep: () => void
}

/**
 * The bar's segments: each category's share of the total spending, in its colour. A category spends
 * what the margin reserves for it, `max(budget, fixed)`; one with neither has no segment.
 */
export function envelopeSegments(envelope: Envelope): { id: string; color: string; share: number; offset: number }[] {
  const reserved = envelope.rows.map((row) => ({ row, amount: Math.max(row.budget ?? 0, row.fixed) })).filter((entry) => entry.amount > 0)
  const total = reserved.reduce((sum, entry) => sum + entry.amount, 0)
  if (total <= 0) return []
  let offset = 0
  return reserved.map(({ row, amount }) => {
    const segment = { id: row.id, color: `var(--cat-${row.color})`, share: amount / total, offset }
    offset += segment.share
    return segment
  })
}

/**
 * Step 5 (`onboarding` → *Budgets step with the live free margin*, D10): the envelope bar and one
 * row per category with its budget field. The hero with the number lives in the template, where it
 * persists into step 6. Fields write on commit (blur or Enter); the margin moves on every keystroke.
 */
export function BudgetsStep({ envelope, currency, drafts, onDraftChange, onCommit, onIncomeStep }: BudgetsStepProps) {
  const t = useTranslations('onboarding')
  const tCategory = useTranslations('hojaCategoria')
  const tCategoria = useTranslations('categoria')
  const { money, parts } = useAmountFormatter()
  const [errors, setErrors] = useState<Record<string, 'invalid' | 'failed'>>({})
  const [busy, setBusy] = useState<Record<string, boolean>>({})
  const symbol = parts(1, currency)
  const segments = envelopeSegments(envelope)

  async function commit(categoryId: string) {
    const text = drafts[categoryId] ?? ''
    if (text.trim() !== '' && parseAmount(text) == null) {
      setErrors((prev) => ({ ...prev, [categoryId]: 'invalid' }))
      return
    }
    setBusy((prev) => ({ ...prev, [categoryId]: true }))
    const result = await onCommit(categoryId, text)
    setBusy((prev) => ({ ...prev, [categoryId]: false }))
    setErrors((prev) => {
      const next = { ...prev }
      if (result === 'ok') delete next[categoryId]
      else next[categoryId] = result
      return next
    })
  }

  return (
    <div className="flex flex-col gap-4">
      {segments.length > 0 ? (
        <div
          role="img"
          aria-label={t('presupuestos.reparto')}
          data-envelope-bar
          className="relative h-1.5 w-full overflow-hidden rounded-full bg-foreground/10"
        >
          {segments.map((segment) => (
            <span
              key={segment.id}
              data-segment={segment.id}
              className="onboarding-envelope absolute inset-y-0 left-0 w-full rounded-full"
              style={{ background: segment.color, transform: `translateX(${segment.offset * 100}%) scaleX(${segment.share})` }}
            />
          ))}
        </div>
      ) : null}
      {envelope.income <= 0 ? (
        <p className="flex flex-wrap items-center gap-x-2 text-body-md text-muted-foreground">
          <span>{t('presupuestos.sinIngresos')}</span>
          <button type="button" onClick={onIncomeStep} className="onboarding-button font-medium text-brand-ink outline-none focus-visible:outline-2">
            {t('presupuestos.irAIngresos')}
          </button>
        </p>
      ) : null}

      {envelope.rows.length === 0 ? (
        <p className="text-body-md text-muted-foreground">{t('presupuestos.sinCategorias')}</p>
      ) : (
        <>
        {/* Right above the fields, so a column of empty boxes does not read as a form to fill. */}
        <p data-budgets-hint className="text-body-md text-muted-foreground">
          {t('presupuestos.opcional')}
        </p>
        <div className="rounded-card border bg-card">
          {envelope.rows.map((row, index) => {
            const fieldId = `budget-${row.id}`
            const error = errors[row.id]
            const invalid = error === 'invalid'
            return (
              <div key={row.id}>
                <div
                  className={cn(
                    'relative flex min-h-14 items-center gap-3 px-inset',
                    index > 0 && 'before:absolute before:left-4 before:right-0 before:top-0 before:h-px before:bg-border',
                  )}
                >
                  <CategoryDot color={row.color} className="size-2.5 shrink-0" />
                  <label htmlFor={fieldId} className="flex min-w-0 flex-1 flex-col py-2">
                    <span className="truncate text-body-lg text-foreground">{row.name}</span>
                    {row.fixed > 0 ? <span className="text-body-sm text-muted-foreground">{t('presupuestos.fijos', { monto: money(row.fixed, currency) })}</span> : null}
                  </label>
                  <div className="field-focus flex shrink-0 items-center gap-1 rounded-lg bg-muted px-2 py-1.5">
                    {symbol.symbolFirst ? <span className="text-tabular-numeric-lg text-foreground">{symbol.symbol}</span> : null}
                    <AmountInput
                      id={fieldId}
                      enterKeyHint="done"
                      autoComplete="off"
                      aria-label={t('presupuestos.presupuestoDe', { categoria: row.name })}
                      aria-invalid={invalid || undefined}
                      aria-describedby={error ? `${fieldId}-error` : undefined}
                      readOnly={busy[row.id]}
                      value={drafts[row.id] ?? ''}
                      onChange={(text) => {
                        onDraftChange(row.id, text)
                        setErrors((prev) => {
                          if (!prev[row.id]) return prev
                          const next = { ...prev }
                          delete next[row.id]
                          return next
                        })
                      }}
                      onBlur={() => void commit(row.id)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') event.currentTarget.blur()
                      }}
                      className="w-24 bg-transparent text-right text-tabular-numeric-lg text-foreground outline-none"
                    />
                    {!symbol.symbolFirst ? <span className="text-tabular-numeric-lg text-foreground">{symbol.symbol}</span> : null}
                  </div>
                </div>
                {error ? (
                  <p id={`${fieldId}-error`} role="alert" className="px-inset pb-2 text-body-sm text-destructive-ink">
                    {tCategory(invalid ? 'presupuestoInvalido' : 'errorGuardar')}
                  </p>
                ) : null}
                {/* A budget shows the dashboard card's bar right away: "820 € de 900 €" and the
                    weekly allowance, so the person sees what a budget will look like in their month.
                    It opens with the switch-reveal of the basics step's format control. */}
                <Collapsible open={row.status != null}>
                  <div className="px-inset pb-3" data-budget-progress={row.id}>
                    {row.status ? (
                      <>
                        <p className="mb-2 text-tabular-numeric-md font-semibold text-foreground">
                          {tCategoria.rich('gastadoDePresupuesto', {
                            gastado: money(row.status.spent, currency),
                            presupuesto: money(row.status.amount, currency),
                            montoGastado: (chunks) => <>{chunks}</>,
                            muted: (chunks) => <span className="font-normal text-muted-foreground">{chunks}</span>,
                          })}
                        </p>
                        <BudgetProgress budget={row.status} currency={currency} />
                      </>
                    ) : null}
                  </div>
                </Collapsible>
              </div>
            )
          })}
        </div>
        </>
      )}
    </div>
  )
}
