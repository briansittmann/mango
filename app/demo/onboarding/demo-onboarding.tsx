'use client'

import { useMemo, useState, useSyncExternalStore } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { FlaskConical } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { OnboardingTemplate } from '@/components/templates/onboarding-template'
import {
  createDemoOnboardingActions,
  createDemoOnboardingStore,
  deriveDemoOnboardingData,
  initialDemoOnboardingState,
  type DemoOnboardingStore,
} from '@/lib/demo/demo-onboarding'

function subscribeNever() {
  return () => {}
}

function readNull() {
  return null
}

/**
 * `/demo/onboarding`'s mount of the template (D2): in-memory state that starts empty and is
 * discarded on reload. Test seams: `?paso=N`, `?e2eSeed=1`, `?pais=`, `?formato=`, `?nombre=`,
 * `?e2eSinNumero=1` (no WhatsApp number configured) and `?e2eVinculado=1` (the next re-read finds
 * the chat linked). The state reads the browser's timezone, so the template mounts on the client only.
 */
export function DemoOnboarding() {
  const t = useTranslations('onboarding')
  const router = useRouter()
  const searchParams = useSearchParams()
  const mounted = useSyncExternalStore(subscribeNever, () => true, () => false)
  const [store, setStore] = useState<DemoOnboardingStore | null>(null)
  const state = useSyncExternalStore(store?.subscribe ?? subscribeNever, store?.get ?? readNull, readNull)
  const actions = useMemo(() => (store ? createDemoOnboardingActions(store) : null), [store])

  if (!mounted) return null
  if (!store) {
    setStore(
      createDemoOnboardingStore(
        initialDemoOnboardingState({
          step: Math.min(7, Math.max(1, Number(searchParams.get('paso')) || 1)),
          seed: searchParams.get('e2eSeed') === '1',
          country: searchParams.get('pais'),
          format: searchParams.get('formato') === 'abreviado' ? 'abreviado' : 'completo',
          name: searchParams.get('nombre') ?? '',
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          withoutNumber: searchParams.get('e2eSinNumero') === '1',
          linkOnRefresh: searchParams.get('e2eVinculado') === '1',
        }),
      ),
    )
    return null
  }
  if (!state || !actions) return null

  return (
    <OnboardingTemplate
      data={deriveDemoOnboardingData(state)}
      actions={actions}
      onFinished={() => router.replace('/demo')}
      notice={
        <div role="status" className="flex items-center gap-3 rounded-inner bg-muted py-1.5 pl-1.5 pr-3">
          <span className="grid size-8 shrink-0 place-items-center rounded-full bg-warning/20 text-[color-mix(in_oklab,var(--warning)_70%,var(--foreground))]">
            <FlaskConical aria-hidden className="size-4" />
          </span>
          <p className="min-w-0 flex-1 truncate text-body-sm text-foreground">{t('sandbox')}</p>
        </div>
      }
    />
  )
}
