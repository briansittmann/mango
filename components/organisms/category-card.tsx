import { useFormatter, useTranslations } from 'next-intl'
import { currencyFormatOptions } from '@/i18n/formats'
import { CategoryDot } from '@/components/atoms/category-dot'
import { ExpandChevron } from '@/components/atoms/expand-chevron'
import { Money } from '@/components/atoms/money'
import { AddRow } from '@/components/molecules/add-row'
import { BudgetProgress } from '@/components/molecules/budget-progress'
import { ExpenseRow } from '@/components/molecules/expense-row'
import type { ExpenseGroup } from '@/lib/data/dashboard'

type CategoryCardProps = {
  group: ExpenseGroup
  currency: string
  timeZone: string
  open: boolean
  onToggle: () => void
  onAddExpense?: () => void
}

export function CategoryCard({ group, currency, timeZone, open, onToggle, onAddExpense }: CategoryCardProps) {
  const t = useTranslations('dashboard')
  const tCategoria = useTranslations('categoria')
  const format = useFormatter()

  const name = group.name ?? t('gastosFijos')
  const headerAmount = group.budget
    ? tCategoria('gastadoDePresupuesto', {
        gastado: format.number(group.budget.spent, { ...currencyFormatOptions, currency }),
        presupuesto: format.number(group.budget.amount, { ...currencyFormatOptions, currency }),
      })
    : null

  return (
    <div className={`rounded-xl border bg-card p-3 ${open ? 'border-foreground/20' : 'border-border'}`}>
      <button type="button" onClick={onToggle} className="flex min-h-12 w-full items-center gap-3">
        <CategoryDot color={group.color} />
        <span className="flex-1 truncate text-left text-sm font-medium text-foreground">{name}</span>
        {headerAmount !== null ? (
          <span className="text-sm text-foreground">{headerAmount}</span>
        ) : (
          <Money amount={group.total} currency={currency} className="text-sm text-foreground" />
        )}
        <ExpandChevron open={open} />
      </button>

      {open ? (
        <div className="mt-3 flex flex-col gap-3 border-t border-border pt-3">
          {group.budget ? <BudgetProgress budget={group.budget} currency={currency} /> : null}
          <div className="flex flex-col divide-y divide-border">
            {group.expenses.map((expense) => (
              <ExpenseRow
                key={expense.id}
                name={expense.name}
                date={expense.date}
                amount={expense.amount}
                currency={currency}
                timeZone={timeZone}
              />
            ))}
          </div>
          <AddRow label={t('anadirGasto')} onClick={onAddExpense} />
        </div>
      ) : null}
    </div>
  )
}
