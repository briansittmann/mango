'use client'

import { useEffect, useRef, useState } from 'react'
import { DemoNotice } from '@/components/molecules/demo-notice'
import { DemoToast } from '@/components/molecules/demo-toast'
import { DashboardTemplate } from '@/components/templates/dashboard-template'
import type { DashboardData } from '@/lib/data/dashboard'

type DemoDashboardProps = {
  data: DashboardData
  changeLanguage: (l: 'es' | 'en') => Promise<void>
}

export function DemoDashboard({ data, changeLanguage }: DemoDashboardProps) {
  const [messageOpen, setMessageOpen] = useState(false)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

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
        data={data}
        actions={{
          changeLanguage,
          addIncome: showUnavailable,
          addExpense: showUnavailable,
          addSavingsMovement: showUnavailable,
        }}
        notice={<DemoNotice />}
      />
      <DemoToast open={messageOpen} />
    </>
  )
}
