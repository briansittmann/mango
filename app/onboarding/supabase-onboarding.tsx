'use client'

import { useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { OnboardingTemplate } from '@/components/templates/onboarding-template'
import type { OnboardingActions, OnboardingData } from '@/lib/data/onboarding'
import * as actions from './actions'

async function unwrap<T>(result: Promise<{ ok: true; value: T } | { ok: false; error: string }>): Promise<T> {
  const settled = await result
  if (!settled.ok) throw new Error(settled.error)
  return settled.value
}

/** `/onboarding`'s mount of the template (D2): the server actions as the data source, same shape as the sandbox. */
export function SupabaseOnboarding({ data }: { data: OnboardingData }) {
  const router = useRouter()
  const bound = useMemo<OnboardingActions>(
    () => ({
      profile: {
        updateBasics: (basics) => unwrap(actions.updateProfileBasics(basics)),
        setSavingsTarget: (amount) => unwrap(actions.setSavingsTarget(amount)),
        requestWhatsApp: (phone) => unwrap(actions.requestWhatsApp(phone)),
        setStep: (step) => unwrap(actions.setOnboardingStep(step)),
        complete: () => unwrap(actions.finishOnboarding()),
      },
      categories: {
        create: (draft, cycle, scope) => unwrap(actions.createCategory(draft, cycle, scope)),
        update: (categoryId, draft, target) => unwrap(actions.updateCategory(categoryId, draft, target)),
        delete: (categoryId, reassignTo, target) => unwrap(actions.deleteCategory(categoryId, reassignTo, target)),
        reorder: (categoryIds) => unwrap(actions.reorderCategories(categoryIds)),
      },
      recurring: {
        create: (target, draft) => unwrap(actions.createRecurring(target, draft)),
        update: (definitionId, draft) => unwrap(actions.updateRecurring(definitionId, draft)),
        stop: (definitionId) => unwrap(actions.stopRecurring(definitionId)),
        delete: (definitionId) => unwrap(actions.deleteRecurring(definitionId)),
      },
      materializeCurrentCycle: () => unwrap(actions.materializeCurrentCycle()),
      finish: () => unwrap(actions.finishOnboarding()),
    }),
    [],
  )

  return <OnboardingTemplate data={data} actions={bound} onFinished={() => router.replace('/dashboard')} />
}
