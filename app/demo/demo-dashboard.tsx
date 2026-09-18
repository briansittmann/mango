'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { DemoNotice } from '@/components/molecules/demo-notice'
import { DemoToast } from '@/components/molecules/demo-toast'
import { DashboardTemplate } from '@/components/templates/dashboard-template'
import { createDemoExpenseMutations, deriveDemoData, noDemoEdits } from '@/lib/demo/demo-expenses'
import { createDemoCategoryMutations, noDemoCategoryEdits } from '@/lib/demo/demo-categories'
import { selectUpcomingCharges } from '@/lib/data/upcoming-charges'
import type { DashboardData } from '@/lib/data/dashboard'

type DemoDashboardProps = {
  data: DashboardData
  changeLanguage: (l: 'es' | 'en') => Promise<void>
}

export function DemoDashboard({ data, changeLanguage }: DemoDashboardProps) {
  const [messageOpen, setMessageOpen] = useState(false)
  const [edits, setEdits] = useState(noDemoEdits)
  const [categoryEdits, setCategoryEdits] = useState(noDemoCategoryEdits)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const view = useMemo(() => deriveDemoData(data, edits, categoryEdits), [data, edits, categoryEdits])
  const charges = useMemo(() => selectUpcomingCharges(view.expenses.groups), [view])
  const expenses = useMemo(() => createDemoExpenseMutations(setEdits), [])
  // Test-only seam for Playwright coverage of the reorder failure path (11.3): the demo has no
  // network layer to intercept, so `?e2eFailReorder=1` makes `reorder` reject deterministically.
  const [failReorder] = useState(
    () => typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('e2eFailReorder') === '1',
  )
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
        actions={{
          changeLanguage,
          expenses,
          categories,
          addIncome: showUnavailable,
          addSavingsMovement: showUnavailable,
        }}
        notice={<DemoNotice />}
      />
      <DemoToast open={messageOpen} />
    </>
  )
}
