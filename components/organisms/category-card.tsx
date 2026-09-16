import { useFormatter, useTranslations } from 'next-intl'
import { currencyFormatOptions } from '@/i18n/formats'
import { Collapsible } from '@/components/atoms/collapsible'
import { CategoryDot } from '@/components/atoms/category-dot'
import { ExpandChevron } from '@/components/atoms/expand-chevron'
import { Money } from '@/components/atoms/money'
import { AddRow } from '@/components/molecules/add-row'
import { BudgetProgress } from '@/components/molecules/budget-progress'
import { ExpenseRow } from '@/components/molecules/expense-row'
import { SwipeToDelete } from '@/components/molecules/swipe-to-delete'
import type { Expense, ExpenseGroup } from '@/lib/data/dashboard'

type CategoryCardProps = {
  group: ExpenseGroup
  currency: string
  timeZone: string
  open: boolean
  onToggle: () => void
  onAddExpense?: () => void
  onEditExpense?: (expense: Expense) => void
  onDeleteExpense?: (expense: Expense) => Promise<void>
}

export function CategoryCard({
  group,
  currency,
  timeZone,
  open,
  onToggle,
  onAddExpense,
  onEditExpense,
  onDeleteExpense,
}: CategoryCardProps) {
  const t = useTranslations('dashboard')
  const tCategoria = useTranslations('categoria')
  const format = useFormatter()

  const name = group.name ?? t('gastosFijos')
  const panelId = `category-panel-${group.id}`

  return (
    <div
      className={`overflow-hidden rounded-card border bg-card ${open ? '' : 'border-border hover:border-foreground/25'}`}
      style={open ? { borderColor: `var(--cat-${group.color})` } : undefined}
    >
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        aria-controls={panelId}
        className="pressable flex min-h-14 w-full items-center gap-3 px-inset"
      >
        <CategoryDot color={group.color} className="size-2.5" />
        <span className="flex-1 truncate text-left text-body-lg font-medium text-foreground">{name}</span>
        {group.budget ? (
          <span className="text-tabular-numeric-md font-semibold text-foreground">
            {tCategoria.rich('gastadoDePresupuesto', {
              gastado: format.number(group.budget.spent, { ...currencyFormatOptions, currency }),
              presupuesto: format.number(group.budget.amount, { ...currencyFormatOptions, currency }),
              muted: (chunks) => <span className="font-normal text-muted-foreground">{chunks}</span>,
            })}
          </span>
        ) : (
          <Money amount={group.total} currency={currency} className="text-tabular-numeric-md font-semibold text-foreground" />
        )}
        <ExpandChevron open={open} />
      </button>

      {group.budget ? (
        <div className="px-inset pb-3">
          <BudgetProgress budget={group.budget} currency={currency} />
        </div>
      ) : null}

      <Collapsible open={open} id={panelId}>
        <div className="flex flex-col">
          {group.expenses.map((expense, index) => {
            const row = (
              <ExpenseRow
                name={expense.name || name}
                date={expense.date}
                amount={expense.amount}
                currency={currency}
                timeZone={timeZone}
                onActivate={onEditExpense ? () => onEditExpense(expense) : undefined}
                first={index === 0}
              />
            )
            return onDeleteExpense ? (
              <SwipeToDelete key={expense.id} onDelete={() => onDeleteExpense(expense)}>
                {row}
              </SwipeToDelete>
            ) : (
              <div key={expense.id}>{row}</div>
            )
          })}
          {group.kind === 'category' ? <AddRow label={t('anadirGasto')} onClick={onAddExpense} /> : null}
        </div>
      </Collapsible>
    </div>
  )
}
