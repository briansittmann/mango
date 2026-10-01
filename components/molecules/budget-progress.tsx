import { CircleAlert, TriangleAlert } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useAmountFormatter } from '@/components/atoms/amount-format'
import { ProgressBar } from '@/components/atoms/progress-bar'
import type { BudgetStatus } from '@/lib/data/dashboard'

type BudgetProgressProps = {
  budget: BudgetStatus
  currency: string
  /** A projected cycle: an empty bar with no text under it (`dashboard-ui`). */
  projected?: boolean
}

export function BudgetProgress({ budget, currency, projected = false }: BudgetProgressProps) {
  const t = useTranslations('categoria')
  const { money } = useAmountFormatter()

  if (projected) {
    return <ProgressBar usage={0} level="ok" valueText={money(budget.amount, currency)} />
  }

  const remainingText =
    budget.weeklyAllowance !== null
      ? t('disponibleSemanal', {
          monto: money(budget.weeklyAllowance, currency),
        })
      : t('disponibleDias', {
          monto: money(budget.remaining, currency),
          dias: budget.daysLeft,
        })

  const valueText = t.markup('gastadoDePresupuesto', {
    gastado: money(budget.spent, currency),
    presupuesto: money(budget.amount, currency),
    // The card header animates the spent figure inside this tag; spoken aloud it is just the number.
    montoGastado: (chunks) => chunks,
    muted: (chunks) => chunks,
  })

  return (
    <div className="flex flex-col">
      <ProgressBar usage={budget.usage} level={budget.level} valueText={valueText} />
      {budget.level === 'exceeded' ? (
        <p className="mt-2 flex items-center gap-1.5 text-body-sm font-medium text-destructive">
          <CircleAlert aria-hidden className="size-4 shrink-0" />
          {t('overBudget', {
            monto: money(budget.spent - budget.amount, currency),
          })}
        </p>
      ) : budget.level === 'warning' ? (
        <p className="mt-2 flex items-center gap-1.5 text-body-sm text-muted-foreground">
          <TriangleAlert aria-hidden className="size-4 shrink-0 text-warning-ink" />
          <span>
            <span className="font-medium text-foreground">{t('nearLimit')}</span>
            {' · '}
            {remainingText}
          </span>
        </p>
      ) : (
        <p className="mt-2 text-body-sm text-muted-foreground">{remainingText}</p>
      )}
    </div>
  )
}
