'use client'

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { useFormatter, useTranslations } from 'next-intl'
import { currencyFormatOptions } from '@/i18n/formats'
import { cn } from '@/lib/utils'
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
import { SummaryGroup } from '@/components/organisms/summary-group'
import { AnimatedContent } from '@/components/ui/animated-content'
import type { DashboardActions, DashboardData } from '@/lib/data/dashboard'

type DashboardTemplateProps = {
  data: DashboardData
  actions: DashboardActions
  notice?: ReactNode
}

type SummaryKey = 'income' | 'expenses' | 'savings'

const BAR_HEIGHT = 56

export function DashboardTemplate({ data, actions, notice }: DashboardTemplateProps) {
  const t = useTranslations('dashboard')
  const tResumen = useTranslations('resumen')
  const tMenu = useTranslations('menuCuenta')
  const format = useFormatter()
  const [openIds, setOpenIds] = useState<Set<string>>(new Set())
  const [openSummary, setOpenSummary] = useState<SummaryKey | null>(null)
  const [accountMenuOpen, setAccountMenuOpen] = useState(false)
  const [titleInView, setTitleInView] = useState(true)
  const titleRef = useRef<HTMLDivElement>(null)
  const expensesRef = useRef<HTMLDivElement>(null)
  const currency = data.user.currency

  useEffect(() => {
    const el = titleRef.current
    if (!el) return
    const observer = new IntersectionObserver(([entry]) => setTitleInView(entry.isIntersecting), {
      rootMargin: `-${BAR_HEIGHT}px 0px 0px 0px`,
      threshold: 0,
    })
    observer.observe(el)
    return () => observer.disconnect()
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
      <div className="sticky top-0 z-30" style={{ height: BAR_HEIGHT }}>
        <div
          aria-hidden
          className={cn(
            'glass-bar absolute inset-0 transition-opacity duration-500 ease-spring motion-reduce:transition-none',
            titleInView ? 'opacity-0' : 'opacity-100',
          )}
        />
        <div className="relative mx-auto flex h-full w-full max-w-[640px] items-center gap-3 px-4 sm:px-5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/mango-logo.svg" alt="" aria-hidden className="size-7 shrink-0 object-contain" />
          <div className="relative min-w-0 flex-1">
            <span
              aria-hidden={!titleInView}
              inert={!titleInView}
              className={cn(
                'absolute inset-0 flex items-center font-display text-headline-sm text-foreground transition-[opacity,translate] duration-500 ease-spring motion-reduce:transition-none',
                titleInView ? 'translate-y-0 opacity-100' : 'pointer-events-none -translate-y-2 opacity-0',
              )}
            >
              {t('appName')}
            </span>
            <div
              aria-hidden={titleInView}
              inert={titleInView}
              className={cn(
                'transition-[opacity,translate] duration-500 ease-spring motion-reduce:transition-none',
                titleInView ? 'pointer-events-none translate-y-2 opacity-0' : 'translate-y-0 opacity-100',
              )}
            >
              <MonthSelector
                variant="compact"
                month={data.cycle.month}
                start={data.cycle.start}
                end={data.cycle.end}
                inProgress={data.cycle.inProgress}
                onPrevious={actions.previousCycle}
                onNext={actions.nextCycle}
                onSelect={actions.selectCycle}
              />
            </div>
          </div>
          <button
            type="button"
            onClick={() => setAccountMenuOpen(true)}
            aria-label={tMenu('abrirMenuDeCuenta')}
            aria-haspopup="dialog"
            aria-expanded={accountMenuOpen}
            aria-controls="account-menu"
            className="pressable grid size-target shrink-0 place-items-center rounded-full [--press-scale:0.9]"
          >
            <Avatar name={data.user.name} photoUrl={data.user.photoUrl} />
          </button>
        </div>
      </div>
      <div className="mx-auto w-full max-w-[640px] px-4 sm:px-5">
      <div ref={titleRef}>
        <AnimatedContent className="pb-3 pt-5" distance={20} delay={0.12}>
          <MonthSelector
            variant="title"
            month={data.cycle.month}
            start={data.cycle.start}
            end={data.cycle.end}
            inProgress={data.cycle.inProgress}
            onPrevious={actions.previousCycle}
            onNext={actions.nextCycle}
            onSelect={actions.selectCycle}
          />
        </AnimatedContent>
      </div>
      {notice ? (
        <AnimatedContent distance={12} delay={0.06} duration={0.6}>
          {notice}
        </AnimatedContent>
      ) : null}
      <AnimatedContent className="mt-4" distance={32} scale={0.97} duration={1} delay={0.2}>
        <FreeMarginCard amount={data.freeMargin} currency={currency} />
      </AnimatedContent>
      <AnimatedContent className="mt-4" distance={24} delay={0.32}>
        <SummaryGroup
          currency={currency}
          openKey={openSummary}
          onToggle={(key) => toggleSummary(key as SummaryKey)}
          items={[
            {
              key: 'income',
              label: tResumen('ingresos'),
              total: data.income.total,
              panel: (
                <>
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
                </>
              ),
            },
            {
              key: 'expenses',
              label: tResumen('gastos'),
              total: data.expenses.total,
              panel: (
                <>
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
                </>
              ),
            },
            {
              key: 'savings',
              label: tResumen('ahorro'),
              total: data.savings.cycle,
              panel: (
                <>
                  <div className="flex flex-col">
                    <SummaryRow name={tResumen('acumulado')} amount={data.savings.accumulated} currency={currency} />
                    {data.savings.movements.map((movement) => (
                      <SummaryRow
                        key={movement.id}
                        name={movement.name}
                        amount={movement.amount}
                        currency={currency}
                        detail={<ShortDate date={movement.date} timeZone={data.user.timezone} />}
                        signed
                      />
                    ))}
                  </div>
                  <div className="px-4 pb-3">
                    <AddRow label={t('anadirMovimientoAhorro')} onClick={actions.addSavingsMovement} />
                  </div>
                </>
              ),
            },
          ]}
        />
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
          <MonthlyBarsChart history={data.history} currentMonth={data.cycle.month} currency={currency} />
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
