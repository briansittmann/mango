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

  return (
    <div className="flex flex-col">
      <ProgressBar usage={budget.usage} level={budget.level} />
      <p className="mt-2 text-body-md text-muted-foreground">{remainingText}</p>
    </div>
  )
}
