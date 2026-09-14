'use client'

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { useFormatter, useTranslations } from 'next-intl'
import { currencyFormatOptions } from '@/i18n/formats'
import { cn } from '@/lib/utils'
import { Avatar } from '@/components/atoms/avatar'
import { Money } from '@/components/atoms/money'
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
import { AnimatedContent } from '@/components/ui/animated-content'
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
  const [scrolled, setScrolled] = useState(false)
  const expensesRef = useRef<HTMLDivElement>(null)
  const currency = data.user.currency

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 56)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

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
    <div className="pb-12">
      <div className="sticky -top-[76px] z-30">
        <div
          aria-hidden
          className={cn(
            'glass-bar absolute inset-x-0 bottom-0 h-[72px] transition-opacity duration-300',
            scrolled ? 'opacity-100' : 'opacity-0',
          )}
        />
        <div className="relative mx-auto w-full max-w-[640px] px-4 pt-6 sm:px-5">
          <AnimatedContent distance={16} reverse duration={0.6}>
            <header className="flex h-11 items-center gap-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/mango-logo.svg" alt="" aria-hidden className="size-9 object-contain" />
              <span className="font-display text-headline-md">{t('appName')}</span>
            </header>
          </AnimatedContent>
          <AnimatedContent
            distance={16}
            reverse
            duration={0.6}
            className={cn(
              'absolute right-4 transition-[top] duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] sm:right-5',
              scrolled ? 'top-[86px]' : 'top-6',
            )}
          >
            <button
              type="button"
              onClick={() => setAccountMenuOpen(true)}
              aria-label={tMenu('abrirMenuDeCuenta')}
              className="grid size-11 place-items-center rounded-full"
            >
              <Avatar name={data.user.name} photoUrl={data.user.photoUrl} />
            </button>
          </AnimatedContent>
          <AnimatedContent className="pb-3 pt-5" distance={20} delay={0.12}>
            <MonthSelector
              month={data.cycle.month}
              inProgress={data.cycle.inProgress}
              onPrevious={actions.previousCycle}
              onNext={actions.nextCycle}
              onSelect={actions.selectCycle}
            />
          </AnimatedContent>
        </div>
      </div>
      <div className="mx-auto w-full max-w-[640px] px-4 sm:px-5">
      {notice ? (
        <AnimatedContent distance={12} delay={0.06} duration={0.6}>
          {notice}
        </AnimatedContent>
      ) : null}
      <AnimatedContent className="mt-4" distance={32} scale={0.97} duration={1} delay={0.2}>
        <FreeMarginCard amount={data.freeMargin} currency={currency} income={data.income.total} />
      </AnimatedContent>
      <AnimatedContent className="mt-4 grid grid-cols-3 items-start gap-2" distance={24} delay={0.32}>
          <SummaryCard
            label={tResumen('ingresos')}
            total={data.income.total}
            currency={currency}
            open={openSummary === 'income'}
            onToggle={() => toggleSummary('income')}
            header={
              <div className="flex items-center justify-between border-b border-border px-4 py-4">
                <div className="flex items-center gap-3">
                  <span aria-hidden className="size-3 rounded-full bg-brand" />
                  <span className="font-display text-headline-sm">{tResumen('incomeSources')}</span>
                </div>
                <Money amount={data.income.total} currency={currency} className="text-tabular-numeric-lg text-hero-accent" />
              </div>
            }
          >
            <div className="flex flex-col">
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
            <div className="px-4 pb-3">
              <AddRow label={t('anadirIngreso')} onClick={actions.addIncome} />
            </div>
          </SummaryCard>

          <SummaryCard
            label={tResumen('gastos')}
            total={data.expenses.total}
            currency={currency}
            open={openSummary === 'expenses'}
            onToggle={() => toggleSummary('expenses')}
          >
            <div className="flex flex-col">
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
              className="flex min-h-12 w-full items-center justify-center gap-2 text-label-ui text-muted-foreground"
            >
              {tResumen('verTodosLosGastos')}
              <ChevronDown className="size-4" aria-hidden />
            </button>
          </SummaryCard>

          <SummaryCard
            label={tResumen('ahorro')}
            total={data.savings.cycle}
            currency={currency}
            open={openSummary === 'savings'}
            onToggle={() => toggleSummary('savings')}
            accent
            header={
              <div className="flex items-center justify-between border-b border-border px-4 py-4">
                <div>
                  <p className="text-label-caps uppercase text-muted-foreground">{tResumen('cycleSavings')}</p>
                  <Money amount={data.savings.cycle} currency={currency} className="mt-1 text-tabular-numeric-lg text-hero-accent text-glow-sm" />
                </div>
                <div className="text-right">
                  <p className="text-label-caps uppercase text-muted-foreground">{tResumen('acumulado')}</p>
                  <Money amount={data.savings.accumulated} currency={currency} className="mt-1 text-tabular-numeric-lg text-foreground" />
                </div>
              </div>
            }
          >
            <div className="flex flex-col">
              {data.savings.movements.map((movement) => (
                <SummaryRow
                  key={movement.id}
                  name={movement.name}
                  amount={movement.amount}
                  currency={currency}
                  detail={<ShortDate date={movement.date} timeZone={data.user.timezone} />}
                  tone={movement.amount >= 0 ? 'positive' : 'negative'}
                />
              ))}
            </div>
            <div className="px-4 pb-3">
              <AddRow label={t('anadirMovimientoAhorro')} onClick={actions.addSavingsMovement} />
            </div>
          </SummaryCard>
      </AnimatedContent>

      <AnimatedContent className="mt-10 flex items-center justify-between" distance={16} delay={0.42}>
        <h2 className="text-label-caps uppercase text-muted-foreground">{t('expenseBreakdown')}</h2>
        <button
          type="button"
          onClick={() => setOpenIds(new Set())}
          className="inline-flex h-11 items-center gap-2 rounded-full border border-border bg-card px-4 text-label-ui text-foreground"
        >
          <ChevronUp className="size-4 text-brand-ink" aria-hidden />
          {t('colapsarTodo')}
        </button>
      </AnimatedContent>
      <div ref={expensesRef} className="mt-4 flex flex-col gap-3">
        {data.expenses.groups.map((group, index) => (
          <AnimatedContent
            key={group.id}
            id={index === 1 ? 'category-cascade' : undefined}
            trigger={index === 0 ? undefined : '#category-cascade'}
            threshold={0.2}
            distance={24}
            duration={0.22}
            delay={index === 0 ? 0.48 : (index - 1) * 0.06}
          >
            <CategoryCard
              group={group}
              currency={currency}
              timeZone={data.user.timezone}
              open={openIds.has(group.id)}
              onToggle={() => toggleCard(group.id)}
              onAddExpense={actions.addExpense ? () => actions.addExpense!(group.id) : undefined}
            />
          </AnimatedContent>
        ))}
      </div>
      <div className="mt-8 flex flex-col gap-4">
        <AnimatedContent
          trigger="#category-cascade"
          threshold={0.2}
          distance={40}
          duration={1}
          delay={(data.expenses.groups.length - 1) * 0.06}
        >
          <MonthlyBarsChart history={data.history} currentMonth={data.cycle.month} />
        </AnimatedContent>
        <AnimatedContent
          trigger="#category-cascade"
          threshold={0.2}
          distance={40}
          duration={1}
          delay={data.expenses.groups.length * 0.06 + 0.1}
        >
          <CategoryPieChart groups={data.expenses.groups} total={data.expenses.total} currency={currency} />
        </AnimatedContent>
      </div>
      </div>
      <AccountMenu
        user={data.user}
        actions={actions}
        open={accountMenuOpen}
        onClose={() => setAccountMenuOpen(false)}
      />
    </div>
  )
}
