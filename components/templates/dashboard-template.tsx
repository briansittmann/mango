'use client'

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { flushSync } from 'react-dom'
import { Toast } from '@base-ui/react/toast'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { useFormatter, useTranslations } from 'next-intl'
import { currencyFormatOptions } from '@/i18n/formats'
import { cn } from '@/lib/utils'
import { Avatar } from '@/components/atoms/avatar'
import { ShortDate } from '@/components/atoms/short-date'
import { AddRow } from '@/components/molecules/add-row'
import { MonthSelector } from '@/components/molecules/month-selector'
import { SummaryRow } from '@/components/molecules/summary-row'
import { UndoToast } from '@/components/molecules/undo-toast'
import { AccountMenu } from '@/components/organisms/account-menu'
import { CategoryCard } from '@/components/organisms/category-card'
import { CategoryPieChart } from '@/components/organisms/category-pie-chart'
import { CategorySheet } from '@/components/organisms/category-sheet'
import { EntrySheet, expenseEntry } from '@/components/organisms/entry-sheet'
import { FreeMarginCard } from '@/components/organisms/free-margin-card'
import { MonthlyBarsChart } from '@/components/organisms/monthly-bars-chart'
import { SummaryGroup } from '@/components/organisms/summary-group'
import { AnimatedContent } from '@/components/ui/animated-content'
import type { DashboardActions, DashboardData, Expense, ExpenseGroup } from '@/lib/data/dashboard'
import type { CategoryDraft } from '@/lib/data/categories'
import type { ExpenseDraft } from '@/lib/data/expenses'

type DashboardTemplateProps = {
  data: DashboardData
  actions: DashboardActions
  notice?: ReactNode
}

type SummaryKey = 'income' | 'expenses' | 'savings'

type SheetTarget = { mode: 'create'; group: ExpenseGroup } | { mode: 'edit'; group: ExpenseGroup; expense: Expense }

const BAR_HEIGHT = 56

function clampDate(date: string, min: string, max: string): string {
  if (date < min) return min
  if (date > max) return max
  return date
}

function localDateOf(dateIso: string, timeZone: string): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(dateIso))
}

export function DashboardTemplate({ data, actions, notice }: DashboardTemplateProps) {
  const t = useTranslations('dashboard')
  const tResumen = useTranslations('resumen')
  const tMenu = useTranslations('menuCuenta')
  const tHojaGasto = useTranslations('hojaGasto')
  const tHojaCategoria = useTranslations('hojaCategoria')
  const format = useFormatter()
  const [openIds, setOpenIds] = useState<Set<string>>(new Set())
  const [openSummary, setOpenSummary] = useState<SummaryKey | null>(null)
  const [accountMenuOpen, setAccountMenuOpen] = useState(false)
  const [titleInView, setTitleInView] = useState(true)
  const [sheet, setSheet] = useState<{ open: boolean; target: SheetTarget | null }>({ open: false, target: null })
  const [categorySheet, setCategorySheet] = useState<{ open: boolean; target: ExpenseGroup | null }>({ open: false, target: null })
  const [statusMessage, setStatusMessage] = useState('')
  const titleRef = useRef<HTMLDivElement>(null)
  const expensesRef = useRef<HTMLDivElement>(null)
  const initialFocusRef = useRef<HTMLInputElement>(null)
  const toasts = useMemo(() => Toast.createToastManager(), [])
  const currency = data.user.currency

  function openCreateSheet(group: ExpenseGroup) {
    flushSync(() => setSheet({ open: true, target: { mode: 'create', group } }))
    initialFocusRef.current?.focus({ preventScroll: true })
  }

  function openEditSheet(group: ExpenseGroup, expense: Expense) {
    flushSync(() => setSheet({ open: true, target: { mode: 'edit', group, expense } }))
    initialFocusRef.current?.focus({ preventScroll: true })
    initialFocusRef.current?.select()
  }

  function openCategorySheet(group: ExpenseGroup) {
    setCategorySheet({ open: true, target: group })
  }

  async function handleSaveCategory(categoryId: string, draft: CategoryDraft) {
    if (!actions.categories) return
    await actions.categories.update(categoryId, draft)
    setCategorySheet((prev) => ({ ...prev, open: false }))
    setStatusMessage(tHojaCategoria('cambiosGuardados'))
  }

  async function handleDeleteCategory(categoryId: string, reassignTo: string | null) {
    if (!actions.categories) return
    await actions.categories.delete(categoryId, reassignTo)
    setCategorySheet((prev) => ({ ...prev, open: false }))
    setStatusMessage(tHojaCategoria('categoriaEliminada'))
  }

  function showUndo(expense: Expense) {
    toasts.close()
    const id = toasts.add({
      title: tHojaGasto('gastoEliminado'),
      priority: 'low',
      actionProps: { children: tHojaGasto('deshacer'), onClick: () => void undoDelete(id, expense) },
    })
  }

  async function undoDelete(id: string, expense: Expense) {
    if (!actions.expenses) return
    try {
      await actions.expenses.restore(expense.id)
      toasts.close(id)
    } catch {
      toasts.update(id, { title: tHojaGasto('errorDeshacer'), priority: 'high', actionProps: undefined })
    }
  }

  async function handleDeleteExpense(expense: Expense) {
    if (!actions.expenses) return
    try {
      await actions.expenses.softDelete(expense.id)
      showUndo(expense)
    } catch (error) {
      toasts.add({ title: tHojaGasto('errorEliminar'), priority: 'high' })
      throw error
    }
  }

  async function handleSheetDelete() {
    if (!actions.expenses || sheet.target?.mode !== 'edit') return
    const expense = sheet.target.expense
    await actions.expenses.softDelete(expense.id)
    setSheet((prev) => ({ ...prev, open: false }))
    showUndo(expense)
  }

  async function handleSaveExpense(values: ExpenseDraft) {
    if (!actions.expenses || !sheet.target) return
    if (sheet.target.mode === 'create') {
      await actions.expenses.create(sheet.target.group.id, values)
    } else {
      await actions.expenses.update(sheet.target.expense.id, values)
    }
    setSheet((prev) => ({ ...prev, open: false }))
    setStatusMessage(sheet.target.mode === 'create' ? tHojaGasto('gastoAnadido') : tHojaGasto('cambiosGuardados'))
  }

  const sheetGroup = sheet.target?.group ?? data.expenses.groups[0]
  const sheetContext =
    sheetGroup.kind === 'category'
      ? { kind: 'category' as const, name: sheetGroup.name ?? t('gastosFijos'), color: sheetGroup.color }
      : { kind: 'fixedCharge' as const }
  const sheetInitialValues: Partial<ExpenseDraft> =
    sheet.target?.mode === 'edit'
      ? {
          amount: sheet.target.expense.amount,
          description: sheet.target.expense.name,
          date: localDateOf(sheet.target.expense.date, data.user.timezone),
        }
      : { date: clampDate(data.cycle.today, data.cycle.start, data.cycle.end) }

  const categorySheetTarget = categorySheet.target ?? data.expenses.groups.find((group) => group.kind === 'category')!
  const receivingCategories = data.expenses.groups
    .filter((group) => group.kind === 'category' && group.id !== categorySheetTarget.id)
    .map((group) => ({ id: group.id, name: group.name ?? '' }))

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
    <Toast.Provider toastManager={toasts} limit={1} timeout={5000}>
    <div className="pb-12">
      <div className="sticky top-0 z-30" style={{ height: BAR_HEIGHT }}>
        <div
          aria-hidden
          className={cn(
            'glass-bar absolute inset-0 transition-opacity duration-500 ease-spring motion-reduce:transition-none',
            titleInView ? 'opacity-0' : 'opacity-100',
          )}
        />
        <div className="relative mx-auto flex h-full w-full max-w-[640px] items-center gap-3 px-gutter">
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
      <div className="mx-auto w-full max-w-[640px] px-gutter">
      <div ref={titleRef} className="relative z-20">
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
      <AnimatedContent className="mt-stack" distance={24} delay={0.32}>
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
                    <AddRow label={t('anadirMovimientoAhorro')} onClick={actions.addSavingsMovement} />
                  </div>
                </>
              ),
            },
          ]}
        />
      </AnimatedContent>

      <AnimatedContent className="mt-section flex items-center justify-between" distance={16} delay={0.42}>
        <h2 className="font-display text-headline-md text-foreground">{t('expenseBreakdown')}</h2>
        {openIds.size > 0 ? (
          <button
            type="button"
            onClick={() => setOpenIds(new Set())}
            className="pressable inline-flex min-h-target items-center gap-2 text-body-lg font-medium text-brand-ink"
          >
            <ChevronUp className="size-4" aria-hidden />
            {t('colapsarTodo')}
          </button>
        ) : null}
      </AnimatedContent>
      <div ref={expensesRef} className="mt-4 flex scroll-mt-20 flex-col gap-stack">
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
              onAddExpense={actions.expenses ? () => openCreateSheet(group) : undefined}
              onEditExpense={actions.expenses ? (expense) => openEditSheet(group, expense) : undefined}
              onDeleteExpense={actions.expenses ? (expense) => handleDeleteExpense(expense) : undefined}
              onOpenOptions={actions.categories ? () => openCategorySheet(group) : undefined}
            />
          </AnimatedContent>
        ))}
      </div>
      <div className="mt-section flex flex-col gap-stack">
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
      <EntrySheet
        config={expenseEntry}
        open={sheet.open}
        onOpenChange={(open) => setSheet((prev) => ({ ...prev, open }))}
        mode={sheet.target?.mode ?? 'create'}
        context={sheetContext}
        initialValues={sheetInitialValues}
        fieldOptions={{ amount: { currency }, date: { min: data.cycle.start, max: data.cycle.end } }}
        initialFocusRef={initialFocusRef}
        onSave={handleSaveExpense}
        onDelete={sheet.target?.mode === 'edit' ? handleSheetDelete : undefined}
      />
      <CategorySheet
        open={categorySheet.open}
        onOpenChange={(open) => setCategorySheet((prev) => ({ ...prev, open }))}
        target={categorySheetTarget}
        currency={currency}
        receivingCategories={receivingCategories}
        onSave={handleSaveCategory}
        onDelete={handleDeleteCategory}
      />
      <UndoToast />
      <div role="status" className="sr-only">
        {statusMessage}
      </div>
    </div>
    </Toast.Provider>
  )
}
