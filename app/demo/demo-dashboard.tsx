'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { DemoNotice } from '@/components/molecules/demo-notice'
import { DemoToast } from '@/components/molecules/demo-toast'
import { DashboardTemplate } from '@/components/templates/dashboard-template'
import { createDemoExpenseMutations, deriveDemoData, noDemoEdits } from '@/lib/demo/demo-expenses'
import type { DashboardData } from '@/lib/data/dashboard'

type DemoDashboardProps = {
  data: DashboardData
  changeLanguage: (l: 'es' | 'en') => Promise<void>
}

export function DemoDashboard({ data, changeLanguage }: DemoDashboardProps) {
  const [messageOpen, setMessageOpen] = useState(false)
  const [edits, setEdits] = useState(noDemoEdits)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const view = useMemo(() => deriveDemoData(data, edits), [data, edits])
  const expenses = useMemo(() => createDemoExpenseMutations(setEdits), [])

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
          addIncome: showUnavailable,
          addSavingsMovement: showUnavailable,
        }}
        notice={<DemoNotice />}
      />
      <DemoToast open={messageOpen} />
    </>
  )
}
