'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { DemoNotice } from '@/components/molecules/demo-notice'
import { DemoToast } from '@/components/molecules/demo-toast'
import { DashboardTemplate } from '@/components/templates/dashboard-template'
import { createDemoExpenseMutations, deriveDemoData, noDemoEdits, shiftDemoMonth } from '@/lib/demo/demo-expenses'
import { createDemoCategoryMutations, noDemoCategoryEdits } from '@/lib/demo/demo-categories'
import { applyDemoCardAssignments, applyDemoCardEdits, createDemoCardMutations, noDemoCardEdits } from '@/lib/demo/demo-cards'
import { createDemoIncomeMutations, noDemoIncomeEdits } from '@/lib/demo/demo-income'
import { createDemoRecurringMutations, noDemoRecurringEdits } from '@/lib/demo/demo-recurring'
import { createDemoSavingsMutations, noDemoSavingsEdits } from '@/lib/demo/demo-savings'
import { selectUpcomingCharges } from '@/lib/data/upcoming-charges'
import type { BudgetRow } from '@/lib/data/budget'
import { DEFAULT_WIDGET_ORDER, type DashboardData, type WidgetId } from '@/lib/data/dashboard'
import type { RecurringDefinition } from '@/lib/data/recurring'
import type { buildDemoPlan } from '@/lib/demo/demo-data'

type DemoDashboardProps = {
  data: DashboardData
  recurringDefinitions: RecurringDefinition[]
  budgetRows: BudgetRow[]
  plan: ReturnType<typeof buildDemoPlan>
  changeLanguage: (l: 'es' | 'en') => Promise<void>
}

export function DemoDashboard({ data, recurringDefinitions, budgetRows: baseBudgetRows, plan, changeLanguage }: DemoDashboardProps) {
  const searchParams = useSearchParams()
  // The landing's phone frames this page with `?embed=1` and tells it, as the visitor scrolls,
  // which of its story's expenses have been sent so far; the list replaces the visitor's edits.
  // Embedded, the projected months also carry what Ana planned ahead (`buildDemoPlan`), so they
  // do not repeat each other; the plain `/demo` and its specs keep the bare projection.
  const embedded = searchParams.get('embed') === '1'
  const [edits, setEdits] = useState(embedded ? { ...noDemoEdits, created: plan.expenses } : noDemoEdits)
  const [categoryEdits, setCategoryEdits] = useState(noDemoCategoryEdits)
  const [recurringEdits, setRecurringEdits] = useState(noDemoRecurringEdits)
  const [cardEdits, setCardEdits] = useState(noDemoCardEdits)
  const [incomeEdits, setIncomeEdits] = useState(embedded ? { ...noDemoIncomeEdits, created: plan.income } : noDemoIncomeEdits)
  const [savingsEdits, setSavingsEdits] = useState(embedded ? { ...noDemoSavingsEdits, created: plan.savings } : noDemoSavingsEdits)
  const budgetRows = useMemo(() => (embedded ? [...baseBudgetRows, ...plan.budgets] : baseBudgetRows), [embedded, baseBudgetRows, plan])
  const router = useRouter()
  const [messageOpen, setMessageOpen] = useState(false)
  // The sample's month or one of its six projections (D9).
  const [month, setMonth] = useState(data.cycle.month)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const { data: derived, definitions: derivedDefinitions } = useMemo(
    () => deriveDemoData(data, recurringDefinitions, budgetRows, edits, categoryEdits, recurringEdits, incomeEdits, savingsEdits, month),
    [data, recurringDefinitions, budgetRows, edits, categoryEdits, recurringEdits, incomeEdits, savingsEdits, month],
  )
  // Cards are not tied to a cycle: they and their assignments lie over every month the same way.
  const cards = useMemo(() => applyDemoCardEdits(data.cards, cardEdits), [data.cards, cardEdits])
  const definitions = useMemo(() => applyDemoCardAssignments(derivedDefinitions, cards, cardEdits), [derivedDefinitions, cards, cardEdits])
  const view = useMemo(() => ({ ...derived, cards }), [derived, cards])
  const charges = useMemo(() => selectUpcomingCharges(view.expenses.groups, definitions, cards), [view, definitions, cards])
  const expenses = useMemo(() => createDemoExpenseMutations(setEdits), [])
  // `?e2e=fail-card-save` makes a card's update and its checklist reject (`card-wallet` → *A failed save changes nothing*).
  const failCardSave = searchParams.get('e2e') === 'fail-card-save'
  const recurring = useMemo(() => createDemoRecurringMutations(setRecurringEdits, setCardEdits), [])
  const cardMutations = useMemo(() => {
    const base = createDemoCardMutations(cards, definitions, setCardEdits)
    if (!failCardSave) return base
    const fail = () => Promise.reject(new Error('e2e-forced-card-save-failure'))
    return { ...base, update: fail, setFixedCharges: fail }
  }, [cards, definitions, failCardSave])
  const income = useMemo(() => createDemoIncomeMutations(setIncomeEdits), [])
  // `?e2e=fail-savings-update` makes a savings edit reject (`savings-editing` → *A failed save*).
  const failSavingsUpdate = searchParams.get('e2e') === 'fail-savings-update'
  const savings = useMemo(() => {
    const base = createDemoSavingsMutations(setSavingsEdits)
    return failSavingsUpdate ? { ...base, update: () => Promise.reject(new Error('e2e-forced-savings-update-failure')) } : base
  }, [failSavingsUpdate])
  // Test-only seam for Playwright coverage of the reorder failure path (11.3): the demo has no
  // network layer to intercept, so `?e2eFailReorder=1` makes `reorder` reject deterministically.
  const [failReorder] = useState(
    () => typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('e2eFailReorder') === '1',
  )
  // Test-only seam for Playwright coverage of *Controls without a handler are disabled*
  // (`dashboard-ui`) on the create tile: the demo always supplies category operations otherwise,
  // so `?e2eNoCategoryActions=1` mounts the dashboard without them. Unlike `failReorder`, this
  // gates a rendered `disabled` attribute, so it reads the query string through `useSearchParams`
  // (resolved from the request on both the server and client render) instead of `window.location`
  // — a lazy `useState` initializer that differs between them would leave that attribute unpatched:
  // React logs the hydration mismatch but does not fix up the DOM for it.
  const noCategoryActions = searchParams.get('e2eNoCategoryActions') === '1'
  const categories = useMemo(() => {
    const base = createDemoCategoryMutations(view.expenses.groups, setCategoryEdits)
    if (!failReorder) return base
    return { ...base, reorder: () => Promise.reject(new Error('e2e-forced-reorder-failure')) }
  }, [view, failReorder])
  // The desktop widget order lives in memory for the demo (`desktop-shell` → *Widget order is the
  // user's*, design D6); `?e2e=fail-widget-order` makes the save reject, like `failReorder` above.
  const [widgetOrder, setWidgetOrderState] = useState<WidgetId[]>(() => [...DEFAULT_WIDGET_ORDER])
  // `?e2e=no-widget-order` mounts without the operation (*No grips without the operation*).
  const e2e = searchParams.get('e2e')
  const setWidgetOrder = useMemo(
    () =>
      e2e === 'no-widget-order'
        ? undefined
        : e2e === 'fail-widget-order'
          ? () => Promise.reject(new Error('e2e-forced-widget-order-failure'))
          : async (order: WidgetId[]) => setWidgetOrderState(order),
    [e2e],
  )
  const viewWithOrder = useMemo(() => ({ ...view, user: { ...view.user, widgetOrder } }), [view, widgetOrder])

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
    }
  }, [])

  useEffect(() => {
    if (!embedded) return
    const today = view.cycle.today
    function onMessage(event: MessageEvent) {
      if (event.origin !== window.location.origin || event.data?.type !== 'mango:story') return
      const entries: { id: string; categoryId: string; description: string; amount: number }[] = event.data.entries
      setEdits({
        ...noDemoEdits,
        created: [
          ...plan.expenses,
          ...entries.map(({ id, categoryId, description, amount }) => ({ id, categoryId, draft: { description, amount, date: today } })),
        ],
      })
    }
    window.addEventListener('message', onMessage)
    window.parent.postMessage({ type: 'mango:ready' }, window.location.origin)
    return () => window.removeEventListener('message', onMessage)
  }, [embedded, view.cycle.today, plan])

  function showUnavailable() {
    setMessageOpen(true)
    if (timeoutRef.current) clearTimeout(timeoutRef.current)
    timeoutRef.current = setTimeout(() => setMessageOpen(false), 2500)
  }

  return (
    <>
      <DashboardTemplate
        data={viewWithOrder}
        charges={charges}
        definitions={definitions}
        actions={{
          changeLanguage,
          setWidgetOrder,
          expenses,
          categories: noCategoryActions ? undefined : categories,
          recurring,
          cards: cardMutations,
          income,
          savings,
          // Before the sample there is nothing to show; after it, the projections.
          previousCycle: () => (month > data.cycle.month ? setMonth(shiftDemoMonth(month, -1)) : showUnavailable()),
          nextCycle: () => {
            if (month < data.cycle.maxMonth) setMonth(shiftDemoMonth(month, 1))
          },
          selectCycle: (selected) => {
            if (selected >= data.cycle.month && selected <= data.cycle.maxMonth) setMonth(selected)
            else showUnavailable()
          },
          openSavingsHistory: showUnavailable,
          // There is no session to end: it only leads to the real login.
          signOut: () => router.push('/login'),
        }}
        notice={embedded ? undefined : <DemoNotice />}
      />
      <DemoToast open={messageOpen} />
    </>
  )
}
