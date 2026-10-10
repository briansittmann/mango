'use client'

import { useMemo } from 'react'
import { Drawer } from '@base-ui/react/drawer'
import { useTranslations } from 'next-intl'
import { CategoryDot } from '@/components/atoms/category-dot'
import { Money } from '@/components/atoms/money'
import { DaySelector } from '@/components/molecules/day-selector'
import { ExpenseRow } from '@/components/molecules/expense-row'
import { SheetShell } from '@/components/organisms/sheet-shell'
import { AnimatedAmount } from '@/components/ui/counter/animated-amount'
import type { DashboardData, Expense, ExpenseGroup } from '@/lib/data/dashboard'
// Pure arithmetic over the rows the dashboard already holds, like the calendar's (design D3).
// eslint-disable-next-line @typescript-eslint/no-restricted-imports
import { dailyTotals, dayExpenses } from '@/lib/data/weekly-spend'

type DaySheetProps = {
  open: boolean
  /** The day shown, `YYYY-MM-DD`; kept while the sheet is leaving. */
  date: string
  onDateChange: (date: string) => void
  onClose: () => void
  groups: ExpenseGroup[]
  cycle: DashboardData['cycle']
  timeZone: string
  currency: string
  /** Opens the expense sheet for a row; without it the rows are read-only. */
  onEdit?: (group: ExpenseGroup, expense: Expense) => void
}

/**
 * The day detail (`spend-insights` → *Day detail*): the rows a calendar cell counts, grouped by
 * category with subtotals and the day's total, and a selector to walk the cycle's days up to today.
 */
export function DaySheet({ open, date, onDateChange, onClose, groups, cycle, timeZone, currency, onEdit }: DaySheetProps) {
  const t = useTranslations('graficos')
  const tEscritorio = useTranslations('escritorio')
  const days = useMemo(() => dailyTotals(groups, cycle.start, cycle.end, timeZone, cycle.today), [groups, cycle.start, cycle.end, cycle.today, timeZone])
  const detail = useMemo(() => dayExpenses(groups, date, timeZone), [groups, date, timeZone])

  return (
    <SheetShell
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose()
      }}
      busy={false}
      isDirty={false}
      initialFocus={false}
      leading={
        <button type="button" onClick={onClose} className="pressable text-body-md text-muted-foreground">
          {tEscritorio('cerrar')}
        </button>
      }
      title={t('gastoDelDia')}
      trailing={null}
    >
      <Drawer.Content className="flex flex-1 flex-col overflow-y-auto overscroll-contain pb-4" data-day-sheet>
        <div className="px-inset pb-2">
          <DaySelector date={date} days={days} currency={currency} onChange={onDateChange} />
        </div>
        {/* Keyed by day so the list rises in again when the day changes. */}
        <div key={date} className="flex animate-stat-in flex-col motion-reduce:animate-none" data-day-list>
          {detail.items.length === 0 ? (
            <p className="px-inset py-8 text-center text-body-md text-muted-foreground">{t('sinGastos')}</p>
          ) : (
            detail.items.map((item) => (
              <section key={item.group.id} aria-labelledby={`day-cat-${item.group.id}`} className="mt-2" data-day-category={item.group.id}>
                <h3 id={`day-cat-${item.group.id}`} className="flex items-center gap-2 px-inset py-1.5 text-label-ui text-muted-foreground">
                  <CategoryDot color={item.group.color} />
                  <span className="min-w-0 flex-1 truncate">{item.group.name}</span>
                  <Money amount={item.total} currency={currency} className="shrink-0 tabular-nums" />
                </h3>
                {item.expenses.map((expense, index) => (
                  <ExpenseRow
                    key={expense.id}
                    name={expense.name}
                    date={expense.date}
                    amount={expense.amount}
                    currency={currency}
                    timeZone={timeZone}
                    onActivate={onEdit ? () => onEdit(item.group, expense) : undefined}
                    first={index === 0}
                  />
                ))}
              </section>
            ))
          )}
        </div>
        <div className="mx-inset mt-3 flex items-center justify-between gap-3 border-t border-border pt-3" aria-live="polite" data-day-total>
          <span className="text-body-lg text-muted-foreground">{t('totalDelDia')}</span>
          <AnimatedAmount amount={detail.total} currency={currency} className="font-display text-headline-sm text-foreground" />
        </div>
      </Drawer.Content>
    </SheetShell>
  )
}
