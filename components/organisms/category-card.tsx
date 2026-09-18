import { MoreHorizontal } from 'lucide-react'
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
  onOpenOptions?: () => void
  reordering?: boolean
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
  onOpenOptions,
  reordering = false,
}: CategoryCardProps) {
  const t = useTranslations('dashboard')
  const tCategoria = useTranslations('categoria')
  const tHojaCategoria = useTranslations('hojaCategoria')
  const format = useFormatter()

  const name = group.name
  const panelId = `category-panel-${group.id}`
  const nameId = `category-name-${group.id}`
  const amountId = `category-amount-${group.id}`
  // In reorder mode the card keeps its identity and nothing else: collapsed, dot and name only,
  // every control off. Its own open state is untouched, so leaving the mode restores it.
  const expanded = open && !reordering

  return (
    <div
      className={`overflow-hidden rounded-card border bg-card ${expanded ? '' : 'border-border hover:border-foreground/25'}`}
      style={expanded ? { borderColor: `var(--cat-${group.color})` } : undefined}
    >
      <div className="relative flex min-h-14 items-center gap-3 px-inset">
        {/* Interactive elements cannot nest, so the disclosure carries no visible content of its
            own — it is a full-header hit target under the header's content, which stays in the
            §9-required order (dot · name · amount · options · chevron) painted above it. */}
        <button
          type="button"
          onClick={onToggle}
          disabled={reordering}
          aria-expanded={expanded}
          aria-controls={panelId}
          aria-labelledby={reordering ? nameId : `${nameId} ${amountId}`}
          className="pressable absolute inset-0 [--press-scale:1]"
        />
        <div className="pointer-events-none relative flex flex-1 items-center gap-3">
          <CategoryDot color={group.color} className="size-2.5" />
          <span id={nameId} className="flex-1 truncate text-left text-body-lg font-medium text-foreground">
            {name}
          </span>
          {reordering ? null : group.budget ? (
            <span id={amountId} className="text-tabular-numeric-md font-semibold text-foreground">
              {tCategoria.rich('gastadoDePresupuesto', {
                gastado: format.number(group.budget.spent, { ...currencyFormatOptions, currency }),
                presupuesto: format.number(group.budget.amount, { ...currencyFormatOptions, currency }),
                muted: (chunks) => <span className="font-normal text-muted-foreground">{chunks}</span>,
              })}
            </span>
          ) : (
            <span id={amountId}>
              <Money amount={group.total} currency={currency} className="text-tabular-numeric-md font-semibold text-foreground" />
            </span>
          )}
          {reordering ? null : (
            <>
              <button
                type="button"
                data-category-options={group.id}
                onClick={onOpenOptions}
                disabled={!onOpenOptions}
                aria-label={tHojaCategoria('opcionesDeCategoria', { categoria: name })}
                className="pressable pointer-events-auto grid size-11 shrink-0 place-items-center rounded-full text-muted-foreground [--press-scale:0.9] hover:bg-foreground/[0.06] hover:text-foreground disabled:opacity-30"
              >
                <MoreHorizontal aria-hidden className="size-5" />
              </button>
              <ExpandChevron open={expanded} />
            </>
          )}
        </div>
      </div>

      {group.budget && !reordering ? (
        <div className="px-inset pb-3">
          <BudgetProgress budget={group.budget} currency={currency} />
        </div>
      ) : null}

      <Collapsible open={expanded} id={panelId}>
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
          <AddRow label={t('anadirGasto')} onClick={onAddExpense} />
        </div>
      </Collapsible>
    </div>
  )
}
