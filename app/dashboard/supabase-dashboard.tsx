'use client'

import { useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { DashboardTemplate } from '@/components/templates/dashboard-template'
import { changeLanguage } from '@/app/actions/language'
import { DUPLICATE_CATEGORY_NAME, type CategoryMutations } from '@/lib/data/categories'
import type { DashboardData } from '@/lib/data/dashboard'
import type { ProfileMutations } from '@/lib/data/profile'
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
  create: (draft, cycle, scope) => unwrapDuplicateName(actions.createCategory(draft, cycle, scope)),
  update: (categoryId, draft, target) => unwrapDuplicateName(actions.updateCategory(categoryId, draft, target)),
  delete: actions.deleteCategory,
  setProgressVisible: actions.setCategoryProgressVisible,
  reorder: actions.reorderCategories,
}

/** Only `updateBasics` is reachable from the dashboard (the account sheet); the rest belongs to `/onboarding`. */
async function unsupported(): Promise<never> {
  throw new Error('unsupported')
}

const profile: ProfileMutations = {
  async updateBasics(basics) {
    const result = await actions.updateProfileBasics(basics)
    if (!result.ok) throw new Error(result.error)
  },
  setSavingsTarget: unsupported,
  requestWhatsApp: unsupported,
  setStep: unsupported,
  complete: unsupported,
}

const mutations = {
  profile,
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
  savings: {
    addSavingsMovement: actions.addSavingsMovement,
    softDelete: actions.softDeleteSavingsMovement,
    restore: actions.restoreSavingsMovement,
  },
  categories,
  recurring: {
    create: actions.createRecurring,
    update: actions.updateRecurring,
    stop: actions.stopRecurring,
    delete: actions.deleteRecurring,
    editInCycle: actions.editRecurringInCycle,
    deleteInCycle: actions.deleteRecurringInCycle,
    restoreInCycle: actions.restoreRecurringInCycle,
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
        deleteAccount: actions.deleteAccount,
      }}
    />
  )
}
