import { CircleAlert, TriangleAlert } from 'lucide-react'
import { useFormatter, useTranslations } from 'next-intl'
import { currencyFormatOptions } from '@/i18n/formats'
import { ProgressBar } from '@/components/atoms/progress-bar'
import type { BudgetStatus } from '@/lib/data/dashboard'

type BudgetProgressProps = {
  budget: BudgetStatus
  currency: string
}

export function BudgetProgress({ budget, currency }: BudgetProgressProps) {
  const t = useTranslations('categoria')
  const format = useFormatter()

  const remainingText =
    budget.weeklyAllowance !== null
      ? t('disponibleSemanal', {
          monto: format.number(budget.weeklyAllowance, { ...currencyFormatOptions, currency }),
        })
      : t('disponibleDias', {
          monto: format.number(budget.remaining, { ...currencyFormatOptions, currency }),
          dias: budget.daysLeft,
        })

  const valueText = t.markup('gastadoDePresupuesto', {
    gastado: format.number(budget.spent, { ...currencyFormatOptions, currency }),
    presupuesto: format.number(budget.amount, { ...currencyFormatOptions, currency }),
    muted: (chunks) => chunks,
  })

  return (
    <div className="flex flex-col">
      <ProgressBar usage={budget.usage} level={budget.level} valueText={valueText} />
      {budget.level === 'exceeded' ? (
        <p className="mt-2 flex items-center gap-1.5 text-body-sm font-medium text-destructive">
          <CircleAlert aria-hidden className="size-4 shrink-0" />
          {t('overBudget', {
            monto: format.number(budget.spent - budget.amount, { ...currencyFormatOptions, currency }),
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
