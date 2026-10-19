'use client'

import { useMemo, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { DashboardTemplate } from '@/components/templates/dashboard-template'
import { changeLanguage } from '@/app/actions/language'
import { DUPLICATE_CARD_NAME, type CardMutations } from '@/lib/data/cards'
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

async function unwrapDuplicateName<T>(
  result: Promise<{ ok: true; value: T } | { ok: false }>,
  message = DUPLICATE_CATEGORY_NAME,
): Promise<T> {
  const settled = await result
  if (!settled.ok) throw new Error(message)
  return settled.value
}

const categories: CategoryMutations = {
  create: (draft, cycle, scope) => unwrapDuplicateName(actions.createCategory(draft, cycle, scope)),
  update: (categoryId, draft, target) => unwrapDuplicateName(actions.updateCategory(categoryId, draft, target)),
  delete: actions.deleteCategory,
  setProgressVisible: actions.setCategoryProgressVisible,
  reorder: actions.reorderCategories,
}

const cards: CardMutations = {
  create: (draft) => unwrapDuplicateName(actions.createCard(draft), DUPLICATE_CARD_NAME),
  update: (cardId, draft) => unwrapDuplicateName(actions.updateCard(cardId, draft), DUPLICATE_CARD_NAME),
  delete: actions.deleteCard,
  setFixedCharges: actions.setCardFixedCharges,
}

/** The account sheet reaches the basics and the WhatsApp operations; the rest belongs to `/onboarding`. */
async function unsupported(): Promise<never> {
  throw new Error('unsupported')
}

const profile: ProfileMutations = {
  async updateBasics(basics) {
    const result = await actions.updateProfileBasics(basics)
    if (!result.ok) throw new Error(result.error)
  },
  setSavingsTarget: unsupported,
  requestWhatsAppLink: actions.requestWhatsAppLink,
  unlinkWhatsApp: actions.unlinkWhatsApp,
  setStep: unsupported,
  complete: unsupported,
  setWidgetOrder: actions.setWidgetOrder,
  setDefaultPaymentMethod: actions.setDefaultPaymentMethod,
  listConnectedApps: actions.listConnectedApps,
  disconnectApp: actions.disconnectApp,
}

const mutations = {
  profile,
  setWidgetOrder: actions.setWidgetOrder,
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
    update: actions.updateSavingsMovement,
    softDelete: actions.softDeleteSavingsMovement,
    restore: actions.restoreSavingsMovement,
  },
  transfers: {
    create: actions.createTransfer,
    update: actions.updateTransfer,
    softDelete: actions.softDeleteTransfer,
    restore: actions.restoreTransfer,
  },
  categories,
  cards,
  recurring: {
    create: actions.createRecurring,
    update: actions.updateRecurring,
    stop: actions.stopRecurring,
    delete: actions.deleteRecurring,
    setCharged: actions.setRecurringCharged,
    setReminder: actions.setRecurringReminder,
    setCard: actions.setRecurringCard,
    editInCycle: actions.editRecurringInCycle,
    deleteInCycle: actions.deleteRecurringInCycle,
    restoreInCycle: actions.restoreRecurringInCycle,
  },
}

/** `/dashboard`'s mount of the shared template (D14): same shape as `DemoDashboard`, server actions as the data source. */
export function SupabaseDashboard({ data, definitions }: SupabaseDashboardProps) {
  const router = useRouter()
  const charges = useMemo(() => selectUpcomingCharges(data.expenses.groups, definitions, data.cards), [data, definitions])
  const month = data.cycle.month
  // The new month's data comes from the server; the transition's pending flag spins the month name.
  const [cycleLoading, startCycleTransition] = useTransition()
  const goTo = (selected: string) => startCycleTransition(() => router.push(`/dashboard?mes=${selected}`))

  return (
    <DashboardTemplate
      data={data}
      charges={charges}
      definitions={definitions}
      cycleLoading={cycleLoading}
      actions={{
        ...mutations,
        changeLanguage,
        // The month selector disables "next" on the cycle in progress; the page clamps any URL past it.
        previousCycle: () => goTo(shiftMonth(month, -1)),
        nextCycle: () => goTo(shiftMonth(month, 1)),
        selectCycle: goTo,
        signOut: () => void actions.signOut(),
        deleteAccount: actions.deleteAccount,
      }}
    />
  )
}
