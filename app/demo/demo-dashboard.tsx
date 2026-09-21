'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { DemoNotice } from '@/components/molecules/demo-notice'
import { DemoToast } from '@/components/molecules/demo-toast'
import { DashboardTemplate } from '@/components/templates/dashboard-template'
import { createDemoExpenseMutations, deriveDemoData, noDemoEdits } from '@/lib/demo/demo-expenses'
import { createDemoCategoryMutations, noDemoCategoryEdits } from '@/lib/demo/demo-categories'
import { createDemoIncomeMutations, noDemoIncomeEdits } from '@/lib/demo/demo-income'
import { createDemoRecurringMutations, noDemoRecurringEdits } from '@/lib/demo/demo-recurring'
import { selectUpcomingCharges } from '@/lib/data/upcoming-charges'
import type { DashboardData } from '@/lib/data/dashboard'
import type { RecurringDefinition } from '@/lib/data/recurring'

type DemoDashboardProps = {
  data: DashboardData
  recurringDefinitions: RecurringDefinition[]
  changeLanguage: (l: 'es' | 'en') => Promise<void>
}

export function DemoDashboard({ data, recurringDefinitions, changeLanguage }: DemoDashboardProps) {
  const [messageOpen, setMessageOpen] = useState(false)
  const [edits, setEdits] = useState(noDemoEdits)
  const [categoryEdits, setCategoryEdits] = useState(noDemoCategoryEdits)
  const [recurringEdits, setRecurringEdits] = useState(noDemoRecurringEdits)
  const [incomeEdits, setIncomeEdits] = useState(noDemoIncomeEdits)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const { data: view, definitions } = useMemo(
    () => deriveDemoData(data, recurringDefinitions, edits, categoryEdits, recurringEdits, incomeEdits),
    [data, recurringDefinitions, edits, categoryEdits, recurringEdits, incomeEdits],
  )
  const charges = useMemo(() => selectUpcomingCharges(view.expenses.groups, definitions), [view, definitions])
  const expenses = useMemo(() => createDemoExpenseMutations(setEdits), [])
  const recurring = useMemo(() => createDemoRecurringMutations(setRecurringEdits), [])
  const income = useMemo(() => createDemoIncomeMutations(setIncomeEdits), [])
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
  const noCategoryActions = useSearchParams().get('e2eNoCategoryActions') === '1'
  const categories = useMemo(() => {
    const base = createDemoCategoryMutations(view.expenses.groups, setCategoryEdits)
    if (!failReorder) return base
    return { ...base, reorder: () => Promise.reject(new Error('e2e-forced-reorder-failure')) }
  }, [view, failReorder])

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
    }
  }, [])

  function showUnavailable() {
    setMessageOpen(true)
    if (timeoutRef.current) clearTimeout(timeoutRef.current)
    timeoutRef.current = setTimeout(() => setMessageOpen(false), 2500)
  }

  return (
    <>
      <DashboardTemplate
        data={view}
        charges={charges}
        definitions={definitions}
        actions={{
          changeLanguage,
          expenses,
          categories: noCategoryActions ? undefined : categories,
          recurring,
          income,
          addSavingsMovement: showUnavailable,
        }}
        notice={<DemoNotice />}
      />
      <DemoToast open={messageOpen} />
    </>
  )
}
