'use client'

import { useEffect, useEffectEvent, useMemo, useRef, useState } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { useFormatter, useTranslations } from 'next-intl'
import { useAmountFormatter } from '@/components/atoms/amount-format'
import { Collapsible } from '@/components/atoms/collapsible'
import { ExpandChevron } from '@/components/atoms/expand-chevron'
import { MovementRow } from '@/components/molecules/movement-row'
import { SegmentedControl } from '@/components/molecules/segmented-control'
import { useSwipeHint } from '@/components/molecules/swipe-hint'
import { SwipeToDelete } from '@/components/molecules/swipe-to-delete'
import type { DashboardData, Expense, ExpenseGroup } from '@/lib/data/dashboard'
import type { IncomeEntry } from '@/lib/data/income'
// Pure arithmetic over the rows the dashboard already holds, like the calendar's (design D1).
// eslint-disable-next-line @typescript-eslint/no-restricted-imports
import { groupByDay, userMovements, type Movement, type MovementKind, type SavingsMovement } from '@/lib/data/movements'
import { cn } from '@/lib/utils'

type Filter = 'all' | MovementKind

const FILTERS = [
  { value: 'all', label: 'todo' },
  { value: 'expense', label: 'gastos' },
  { value: 'income', label: 'ingresos' },
  { value: 'savings', label: 'ahorro' },
] as const

const EMPTY_FILTER = { expense: 'sinGastos', income: 'sinIngresos', savings: 'sinAhorro' } as const

const PANEL_ID = 'movements-panel'
const TITLE_ID = 'movements-title'
const COUNT_ID = 'movements-count'
const STAGGER_MS = 30
const STAGGER_CAP = 7
/** `Collapsible`'s 200 ms, plus a frame. */
const COLLAPSIBLE_MS = 250

type MovementsCardProps = {
  data: Pick<DashboardData, 'expenses' | 'income' | 'savings' | 'cycle'>
  timeZone: string
  currency: string
  open: boolean
  onToggle: () => void
  /** Rows per page: 10 at every width (`transaction-list` → *Show more*). */
  pageSize: number
  onEditExpense?: (group: ExpenseGroup, expense: Expense) => void
  onEditIncome?: (entry: IncomeEntry) => void
  onDeleteExpense?: (expense: Expense) => Promise<void>
  onDeleteIncome?: (entry: IncomeEntry) => Promise<void>
  onEditSavings?: (movement: SavingsMovement) => void
  onDeleteSavings?: (movementId: string) => Promise<void>
}

/**
 * The "Movimientos" card (`transaction-list`): what the user entered in the shown cycle, by day,
 * newest first, with a filter by kind and paging. It states no amount of its own (design D3).
 */
export function MovementsCard({
  data,
  timeZone,
  currency,
  open,
  onToggle,
  pageSize,
  onEditExpense,
  onEditIncome,
  onDeleteExpense,
  onDeleteIncome,
  onEditSavings,
  onDeleteSavings,
}: MovementsCardProps) {
  const t = useTranslations('movimientos')
  const format = useFormatter()
  const { money } = useAmountFormatter()
  const month = data.cycle.month

  const movements = useMemo(() => userMovements(data, timeZone), [data, timeZone])

  // The filter and the paging start over in another cycle, and the paging with another filter (D8).
  // Stored back during render (the "adjust state on prop change" idiom), so coming back to the same
  // cycle or filter does not bring an old filter or page back.
  const [filterState, setFilterState] = useState<{ month: string; filter: Filter }>({ month, filter: 'all' })
  if (filterState.month !== month) setFilterState({ month, filter: 'all' })
  const filter = filterState.month === month ? filterState.filter : 'all'
  const pagingKey = `${month}|${filter}`
  const [paging, setPaging] = useState<{ key: string; pages: number; revealFrom: number; focusKey: string | null }>({
    key: pagingKey,
    pages: 1,
    revealFrom: Infinity,
    focusKey: null,
  })
  if (paging.key !== pagingKey) setPaging({ key: pagingKey, pages: 1, revealFrom: Infinity, focusKey: null })
  const pages = paging.key === pagingKey ? paging.pages : 1
  const revealFrom = paging.key === pagingKey ? paging.revealFrom : Infinity
  const [announcement, setAnnouncement] = useState('')

  const filtered = filter === 'all' ? movements : movements.filter((movement) => movement.kind === filter)
  const shown = filtered.slice(0, pageSize * pages)
  const days = groupByDay(shown, data.cycle.today)
  const remaining = filtered.length - shown.length

  const sectionRef = useRef<HTMLElement>(null)
  const rowRefs = useRef(new Map<string, HTMLElement>())

  useEffect(() => {
    if (paging.focusKey) rowRefs.current.get(paging.focusKey)?.focus()
  }, [paging.focusKey])

  function deleteFor(movement: Movement) {
    if (movement.kind === 'expense') return onDeleteExpense && (() => onDeleteExpense(movement.expense))
    if (movement.kind === 'income') return onDeleteIncome && (() => onDeleteIncome(movement.entry))
    return onDeleteSavings && (() => onDeleteSavings(movement.id))
  }

  // The swipe-to-delete hint plays once, the first time the first deletable row is on screen,
  // below the top bar, with the card open: the card starts open at `lg`, so nobody opens it by hand
  // there.
  const swipeHint = useSwipeHint('mango:pista-deslizar-movimientos')
  const hintKey = shown.find((movement) => deleteFor(movement))?.key
  const showHint = useEffectEvent(() => swipeHint.show())
  useEffect(() => {
    const node = open && hintKey ? rowRefs.current.get(hintKey) : undefined
    if (!node) return
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return
        observer.disconnect()
        showHint()
      },
      { threshold: 0.9, rootMargin: '-88px 0px 0px 0px' },
    )
    // Observed once the panel has opened: Chromium does not re-check a row the opening clipped.
    const timeout = setTimeout(() => observer.observe(node), COLLAPSIBLE_MS)
    return () => {
      clearTimeout(timeout)
      observer.disconnect()
    }
  }, [open, hintKey])

  function changeFilter(next: Filter) {
    setFilterState({ month, filter: next })
    const count = next === 'all' ? movements.length : movements.filter((movement) => movement.kind === next).length
    setAnnouncement(t('mostrando', { n: Math.min(count, pageSize) }))
  }

  function showMore() {
    const next = shown.length
    setPaging({ key: pagingKey, pages: pages + 1, revealFrom: next, focusKey: filtered[next]?.key ?? null })
    setAnnouncement(t('mostrando', { n: Math.min(filtered.length, pageSize * (pages + 1)) }))
  }

  function showLess() {
    setPaging({ key: pagingKey, pages: 1, revealFrom: Infinity, focusKey: null })
    setAnnouncement(t('mostrando', { n: Math.min(filtered.length, pageSize) }))
    // After the list shortens, bring the card's top back when it went above the viewport.
    requestAnimationFrame(() => {
      const section = sectionRef.current
      if (!section || section.getBoundingClientRect().top >= 0) return
      const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
      section.scrollIntoView({ block: 'start', behavior: reduce ? 'auto' : 'smooth' })
    })
  }

  function dayName(day: string, label: 'today' | 'yesterday' | null) {
    if (label === 'today') return t('hoy')
    if (label === 'yesterday') return t('ayer')
    // ICU versions disagree on the comma ("jue, 10 sept"), and a mismatch breaks hydration (D7).
    return format
      .dateTime(new Date(`${day}T12:00:00Z`), { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' })
      .replace(/,/g, '')
  }

  function renderRow(movement: Movement, index: number, first: boolean, heading: string) {
    const kindLabel =
      movement.kind === 'expense'
        ? movement.group.name
        : movement.kind === 'income'
          ? t('ingreso')
          : movement.amount < 0
            ? t('retiro')
            : movement.movement.alreadySaved
              ? `${t('deposito')} · ${t('yaAhorrado')}`
              : t('deposito')
    const name = movement.name || kindLabel
    const sign = movement.kind === 'expense' ? '' : movement.amount < 0 ? '−' : '+'
    const label = t('fila', { nombre: name, tipo: kindLabel, dia: heading, monto: `${sign}${money(Math.abs(movement.amount), currency)}` })

    const onActivate =
      movement.kind === 'expense' && onEditExpense
        ? () => onEditExpense(movement.group, movement.expense)
        : movement.kind === 'income' && onEditIncome
          ? () => onEditIncome(movement.entry)
          : movement.kind === 'savings' && onEditSavings
            ? () => onEditSavings(movement.movement)
            : undefined
    const onDelete = deleteFor(movement)

    const row = (
      <MovementRow
        kind={movement.kind}
        name={name}
        kindLabel={kindLabel}
        amount={movement.amount}
        currency={currency}
        color={movement.kind === 'expense' ? movement.group.color : undefined}
        label={label}
        onActivate={onActivate}
        first={first}
        rowRef={(node) => {
          if (node) rowRefs.current.set(movement.key, node)
          else rowRefs.current.delete(movement.key)
        }}
      />
    )
    // Rows revealed by "Mostrar más" rise in, in a short stagger that never blocks input (D9).
    const revealed = index >= revealFrom
    return (
      <div
        key={movement.key}
        className={cn(revealed && 'animate-stat-in motion-reduce:animate-none')}
        style={revealed ? { animationDelay: `${Math.min(index - revealFrom, STAGGER_CAP) * STAGGER_MS}ms` } : undefined}
      >
        {onDelete ? (
          <SwipeToDelete
            rowId={movement.id}
            onDelete={onDelete}
            hint={swipeHint.active && movement.key === hintKey}
            onHintDismiss={swipeHint.dismiss}
          >
            {row}
          </SwipeToDelete>
        ) : (
          row
        )}
      </div>
    )
  }

  const indexOf = new Map(shown.map((movement, position) => [movement.key, position]))

  return (
    <section
      ref={sectionRef}
      aria-labelledby={TITLE_ID}
      className="overflow-hidden rounded-card border border-border bg-card"
      data-movements-card
    >
      <div className="relative flex min-h-14 items-center gap-3 px-inset">
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={open}
          aria-controls={PANEL_ID}
          aria-labelledby={`${TITLE_ID} ${COUNT_ID}`}
          className="pressable absolute inset-0 [--press-scale:1]"
        />
        <div className="pointer-events-none relative flex flex-1 items-center gap-3">
          <h2 id={TITLE_ID} className="flex-1 truncate text-left text-body-lg font-medium text-foreground">
            {t('titulo')}
          </h2>
          <span id={COUNT_ID} className="shrink-0 text-label-ui text-muted-foreground tabular-nums" data-movements-count>
            {movements.length}
          </span>
          <ExpandChevron open={open} />
        </div>
      </div>

      <Collapsible open={open} id={PANEL_ID}>
        {movements.length === 0 ? (
          <div className="px-inset pb-5 pt-1" data-movements-empty>
            <p className="text-body-md text-foreground">{t('vacio')}</p>
            <p className="mt-1 text-body-sm text-muted-foreground">{t('vacioDetalle')}</p>
          </div>
        ) : (
          <>
            <div className="px-inset pb-1 pt-1">
              <SegmentedControl
                label={t('filtro')}
                options={FILTERS.map((option) => ({ value: option.value, label: t(option.label) }))}
                value={filter}
                onChange={changeFilter}
              />
            </div>
            {/* Keyed by filter so the new list rises in when the filter changes (D9). */}
            <div key={filter} className="animate-stat-in motion-reduce:animate-none" data-movements-list>
              {filtered.length === 0 ? (
                <p className="px-inset py-6 text-center text-body-md text-muted-foreground" data-movements-empty-filter>
                  {t(EMPTY_FILTER[filter as MovementKind])}
                </p>
              ) : (
                days.map((day) => {
                  const heading = dayName(day.day, day.label)
                  return (
                    <div key={day.day} role="group" aria-labelledby={`movements-day-${day.day}`} data-movements-day={day.day}>
                      <h3 id={`movements-day-${day.day}`} className="px-inset pb-1 pt-4 text-label-ui text-muted-foreground first-letter:uppercase">
                        {heading}
                      </h3>
                      {day.items.map((movement, position) => renderRow(movement, indexOf.get(movement.key)!, position === 0, heading))}
                    </div>
                  )
                })
              )}
            </div>
            {remaining > 0 || pages > 1 ? (
              <button
                type="button"
                onClick={remaining > 0 ? showMore : showLess}
                className="pressable mt-1 flex min-h-12 w-full items-center justify-center gap-2 border-t border-border text-label-ui text-brand-ink"
                data-movements-more
              >
                {remaining > 0 ? t('mostrarMas') : t('mostrarMenos')}
                {remaining > 0 ? <ChevronDown className="size-4" aria-hidden /> : <ChevronUp className="size-4" aria-hidden />}
              </button>
            ) : (
              <div className="h-2" />
            )}
          </>
        )}
      </Collapsible>
      <p className="sr-only" aria-live="polite">
        {announcement}
      </p>
    </section>
  )
}
