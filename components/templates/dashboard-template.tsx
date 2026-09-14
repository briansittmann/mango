'use client'

import { useState, type ReactNode } from 'react'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import { CategoryCard } from '@/components/organisms/category-card'
import type { DashboardActions, DashboardData } from '@/lib/data/dashboard'

type DashboardTemplateProps = {
  data: DashboardData
  actions: DashboardActions
  notice?: ReactNode
}

export function DashboardTemplate({ data, actions, notice }: DashboardTemplateProps) {
  const t = useTranslations('dashboard')
  const [openIds, setOpenIds] = useState<Set<string>>(new Set())

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

  return (
    <div className="min-h-full bg-background text-foreground">
      <header className="sticky top-0 z-10 flex items-center px-4 py-3" />
      {notice}
      <main className="mx-auto flex max-w-lg flex-col gap-4 px-4 py-4">
        <div className="flex items-center justify-end">
          <Button variant="ghost" size="sm" onClick={() => setOpenIds(new Set())}>
            {t('colapsarTodo')}
          </Button>
        </div>
        <div className="flex flex-col gap-3">
          {data.expenses.groups.map((group) => (
            <CategoryCard
              key={group.id}
              group={group}
              currency={data.user.currency}
              timeZone={data.user.timezone}
              open={openIds.has(group.id)}
              onToggle={() => toggleCard(group.id)}
              onAddExpense={actions.addExpense ? () => actions.addExpense!(group.id) : undefined}
            />
          ))}
        </div>
      </main>
    </div>
  )
}
