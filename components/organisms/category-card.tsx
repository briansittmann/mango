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

  return (
    <div
      className={`overflow-hidden rounded-card border bg-card ${open ? '' : 'border-border hover:border-foreground/25'}`}
      style={open ? { borderColor: `var(--cat-${group.color})` } : undefined}
    >
      <button type="button" onClick={onToggle} className="flex min-h-[72px] w-full items-center gap-3 px-4">
        <CategoryDot color={group.color} className="size-3.5" />
        <span className="flex-1 truncate text-left font-display text-headline-sm text-foreground">{name}</span>
        {group.budget ? (
          <span className="text-tabular-numeric-md text-lg font-semibold text-foreground">
            {tCategoria.rich('gastadoDePresupuesto', {
              gastado: format.number(group.budget.spent, { ...currencyFormatOptions, currency }),
              presupuesto: format.number(group.budget.amount, { ...currencyFormatOptions, currency }),
              muted: (chunks) => <span className="font-normal text-muted-foreground">{chunks}</span>,
            })}
          </span>
        ) : (
          <Money amount={group.total} currency={currency} className="text-tabular-numeric-md text-lg font-semibold text-foreground" />
        )}
        <ExpandChevron open={open} />
      </button>

      {group.budget ? (
        <div className="px-4 pb-3">
          <BudgetProgress budget={group.budget} currency={currency} />
        </div>
      ) : null}

      {open ? (
        <div className="flex flex-col">
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
          <div className="px-4 pb-4">
            <AddRow label={t('anadirGasto')} onClick={onAddExpense} />
          </div>
        </div>
      ) : null}
    </div>
  )
}
