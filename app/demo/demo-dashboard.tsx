'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { DemoNotice } from '@/components/molecules/demo-notice'
import { DemoToast } from '@/components/molecules/demo-toast'
import { DashboardTemplate } from '@/components/templates/dashboard-template'
import { createDemoExpenseMutations, deriveDemoData, noDemoEdits } from '@/lib/demo/demo-expenses'
import { createDemoCategoryMutations, noDemoCategoryEdits } from '@/lib/demo/demo-categories'
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
  const expenses = useMemo(() => createDemoExpenseMutations(setEdits), [])
  const categories = useMemo(() => createDemoCategoryMutations(view.expenses.groups, setCategoryEdits), [view])

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
