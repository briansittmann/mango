'use client'

import { useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { DashboardTemplate } from '@/components/templates/dashboard-template'
import { changeLanguage } from '@/app/actions/language'
import { DUPLICATE_CATEGORY_NAME, type CategoryMutations } from '@/lib/data/categories'
import type { DashboardData } from '@/lib/data/dashboard'
import type { RecurringDefinition } from '@/lib/data/recurring'
import { shiftMonth } from '@/lib/data/supabase/cycle'
import { selectUpcomingCharges } from '@/lib/data/upcoming-charges'
import * as actions from './actions'

type SupabaseDashboardProps = {
  data: DashboardData
  definitions: RecurringDefinition[]
}

async function unwrapDuplicateName<T>(result: Promise<{ ok: true; value: T } | { ok: false }>): Promise<T> {
  const settled = await result
  if (!settled.ok) throw new Error(DUPLICATE_CATEGORY_NAME)
  return settled.value
}

const categories: CategoryMutations = {
  create: (draft) => unwrapDuplicateName(actions.createCategory(draft)),
  update: (categoryId, draft) => unwrapDuplicateName(actions.updateCategory(categoryId, draft)),
  delete: actions.deleteCategory,
  reorder: actions.reorderCategories,
}

const mutations = {
  expenses: {
    create: actions.createExpense,
    update: actions.updateExpense,
    softDelete: actions.softDeleteExpense,
    restore: actions.restoreExpense,
  },
  income: {
    create: actions.createIncome,
    update: actions.updateIncome,
    softDelete: actions.softDeleteIncome,
    restore: actions.restoreIncome,
  },
  savings: { addSavingsMovement: actions.addSavingsMovement },
  categories,
  recurring: {
    create: actions.createRecurring,
    update: actions.updateRecurring,
    stop: actions.stopRecurring,
    delete: actions.deleteRecurring,
  },
}

/** `/dashboard`'s mount of the shared template (D14): same shape as `DemoDashboard`, server actions as the data source. */
export function SupabaseDashboard({ data, definitions }: SupabaseDashboardProps) {
  const router = useRouter()
  const charges = useMemo(() => selectUpcomingCharges(data.expenses.groups, definitions), [data, definitions])
  const month = data.cycle.month

  return (
    <DashboardTemplate
      data={data}
      charges={charges}
      definitions={definitions}
      actions={{
        ...mutations,
        changeLanguage,
        // The month selector disables "next" on the cycle in progress; the page clamps any URL past it.
        previousCycle: () => router.push(`/dashboard?mes=${shiftMonth(month, -1)}`),
        nextCycle: () => router.push(`/dashboard?mes=${shiftMonth(month, 1)}`),
        selectCycle: (selected) => router.push(`/dashboard?mes=${selected}`),
        signOut: () => void actions.signOut(),
      }}
    />
  )
}
