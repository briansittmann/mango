'use client'

import { useMemo, useRef, useState, type ReactNode } from 'react'
import { useFormatter, useTranslations } from 'next-intl'
import { currencyFormatOptions } from '@/i18n/formats'
import { Button } from '@/components/ui/button'
import { Avatar } from '@/components/atoms/avatar'
import { ShortDate } from '@/components/atoms/short-date'
import { AddRow } from '@/components/molecules/add-row'
import { MonthSelector } from '@/components/molecules/month-selector'
import { SummaryRow } from '@/components/molecules/summary-row'
import { AccountMenu } from '@/components/organisms/account-menu'
import { CategoryCard } from '@/components/organisms/category-card'
import { CategoryPieChart } from '@/components/organisms/category-pie-chart'
import { FreeMarginCard } from '@/components/organisms/free-margin-card'
import { MonthlyBarsChart } from '@/components/organisms/monthly-bars-chart'
import { SummaryCard } from '@/components/organisms/summary-card'
import type { DashboardActions, DashboardData } from '@/lib/data/dashboard'

type DashboardTemplateProps = {
  data: DashboardData
  actions: DashboardActions
  notice?: ReactNode
}

type SummaryKey = 'income' | 'expenses' | 'savings'

export function DashboardTemplate({ data, actions, notice }: DashboardTemplateProps) {
  const t = useTranslations('dashboard')
  const tResumen = useTranslations('resumen')
  const tMenu = useTranslations('menuCuenta')
  const format = useFormatter()
  const [openIds, setOpenIds] = useState<Set<string>>(new Set())
  const [openSummary, setOpenSummary] = useState<SummaryKey | null>(null)
  const [accountMenuOpen, setAccountMenuOpen] = useState(false)
  const expensesRef = useRef<HTMLDivElement>(null)
  const currency = data.user.currency

  function toggleCard(id: string) {
    setOpenIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  function toggleSummary(key: SummaryKey) {
    setOpenSummary((prev) => (prev === key ? null : key))
  }

  const sortedExpenseGroups = useMemo(
    () => [...data.expenses.groups].sort((a, b) => b.total - a.total),
    [data.expenses.groups],
  )

  return (
    <div className="min-h-full bg-background text-foreground">
      <header className="sticky top-0 z-10 flex items-center justify-between px-4 py-3">
        <div className="flex-1" />
        <MonthSelector
          month={data.cycle.month}
          inProgress={data.cycle.inProgress}
          onPrevious={actions.previousCycle}
          onNext={actions.nextCycle}
        />
        <div className="flex flex-1 justify-end">
          <button
            type="button"
            onClick={() => setAccountMenuOpen(true)}
            aria-label={tMenu('abrirMenuDeCuenta')}
            className="rounded-full"
          >
            <Avatar name={data.user.name} photoUrl={data.user.photoUrl} />
          </button>
        </div>
      </header>
      {notice}
      <main className="mx-auto flex max-w-lg flex-col gap-4 px-4 py-4">
        <FreeMarginCard amount={data.freeMargin} currency={currency} />
        <div className="grid grid-cols-3 items-start gap-2">
          <SummaryCard
            label={tResumen('ingresos')}
            total={data.income.total}
            currency={currency}
            open={openSummary === 'income'}
            onToggle={() => toggleSummary('income')}
          >
            <div className="flex flex-col divide-y divide-border">
              {data.income.sources.map((source) => (
                <SummaryRow
                  key={source.id}
                  name={source.name}
                  amount={source.actual}
                  currency={currency}
                  detail={tResumen('estimado', {
                    real: format.number(source.actual, { ...currencyFormatOptions, currency }),
                    estimado: format.number(source.estimated, { ...currencyFormatOptions, currency }),
                  })}
                />
              ))}
            </div>
            <AddRow label={t('anadirIngreso')} onClick={actions.addIncome} />
          </SummaryCard>

          <SummaryCard
            label={tResumen('gastos')}
            total={data.expenses.total}
            currency={currency}
            open={openSummary === 'expenses'}
            onToggle={() => toggleSummary('expenses')}
          >
            <div className="flex flex-col divide-y divide-border">
              {sortedExpenseGroups.map((group) => (
                <SummaryRow
                  key={group.id}
                  color={group.color}
                  name={group.name ?? t('gastosFijos')}
                  amount={group.total}
                  currency={currency}
                />
              ))}
            </div>
            <button
              type="button"
              onClick={() => expensesRef.current?.scrollIntoView({ behavior: 'smooth' })}
              className="flex min-h-12 w-full items-center justify-center rounded-lg text-sm font-medium text-brand-ink transition-colors hover:bg-brand/10"
            >
              {tResumen('verTodosLosGastos')}
            </button>
          </SummaryCard>

          <SummaryCard
            label={tResumen('ahorro')}
            total={data.savings.cycle}
            currency={currency}
            open={openSummary === 'savings'}
            onToggle={() => toggleSummary('savings')}
          >
            <SummaryRow name={tResumen('acumulado')} amount={data.savings.accumulated} currency={currency} />
            <div className="flex flex-col divide-y divide-border">
              {data.savings.movements.map((movement) => (
                <SummaryRow
                  key={movement.id}
                  name={movement.name}
                  amount={movement.amount}
                  currency={currency}
                  detail={<ShortDate date={movement.date} timeZone={data.user.timezone} />}
                />
              ))}
            </div>
            <AddRow label={t('anadirMovimientoAhorro')} onClick={actions.addSavingsMovement} />
          </SummaryCard>
        </div>

        <div className="flex items-center justify-end">
          <Button variant="ghost" size="sm" onClick={() => setOpenIds(new Set())}>
            {t('colapsarTodo')}
          </Button>
        </div>
        <div ref={expensesRef} className="flex flex-col gap-3">
          {data.expenses.groups.map((group) => (
            <CategoryCard
              key={group.id}
              group={group}
              currency={currency}
              timeZone={data.user.timezone}
              open={openIds.has(group.id)}
              onToggle={() => toggleCard(group.id)}
              onAddExpense={actions.addExpense ? () => actions.addExpense!(group.id) : undefined}
            />
          ))}
        </div>
        <CategoryPieChart groups={data.expenses.groups} total={data.expenses.total} currency={currency} />
        <MonthlyBarsChart history={data.history} currentMonth={data.cycle.month} />
      </main>
      <AccountMenu
        user={data.user}
        actions={actions}
        open={accountMenuOpen}
        onClose={() => setAccountMenuOpen(false)}
      />
    </div>
  )
}
