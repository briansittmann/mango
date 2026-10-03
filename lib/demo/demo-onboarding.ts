import type { Dispatch, SetStateAction } from 'react'
import { DUPLICATE_CATEGORY_NAME } from '@/lib/data/categories'
import type { CategoryDraft } from '@/lib/data/categories'
import type { CategoryColor } from '@/lib/data/dashboard'
import type { LocalDate } from '@/lib/data/expenses'
import type { OnboardingActions, OnboardingData, OnboardingProfile } from '@/lib/data/onboarding'
import { toE164 } from '@/lib/data/phone'
import type { WhatsAppState } from '@/lib/data/profile'
import type { RecurringDefinition } from '@/lib/data/recurring'

/** The sandbox's linking code and the identifier `?e2eVinculado=1` links on the next refresh. */
export const DEMO_LINK_CODE = 'DEMO42'
export const DEMO_LINKED_NUMBER = '+5491155551234'
export const DEMO_WHATSAPP_NUMBER = '15551234567'

/**
 * The sandbox's state (`onboarding` → *An in-memory sandbox of the onboarding*, D2): plain
 * arrays, ids `demo-…`, every operation resolving on the next tick, nothing on the network.
 */
export type DemoOnboardingState = {
  step: number
  profile: OnboardingProfile
  categories: { id: string; name: string; color: CategoryColor }[]
  definitions: RecurringDefinition[]
  budgets: Record<string, number | null>
  whatsapp: WhatsAppState
  /** `?e2eVinculado=1`: the next `refresh` finds the channel linked, as a chat message would have done. */
  linkOnRefresh: boolean
}

export type DemoOnboardingParams = {
  step: number
  seed: boolean
  country: string | null
  format: 'completo' | 'abreviado'
  name: string
  timezone: string
  /** `?e2eSinNumero=1`: no number to write to, so the step shows the manual line. */
  withoutNumber: boolean
  linkOnRefresh: boolean
}

let counter = 0

function nextId(prefix: string): string {
  counter += 1
  return `demo-${prefix}-${counter}`
}

function foldName(name: string): string {
  return name.trim().toLocaleLowerCase()
}

const COUNTRY_DEFAULTS: Record<string, { currency: string; timezone: string }> = {
  AR: { currency: 'ARS', timezone: 'America/Argentina/Buenos_Aires' },
  IE: { currency: 'EUR', timezone: 'Europe/Dublin' },
  ES: { currency: 'EUR', timezone: 'Europe/Madrid' },
  UY: { currency: 'UYU', timezone: 'America/Montevideo' },
}

/** `?e2eSeed=1`: Vivienda and Comida, Sueldo 2 000 on day 1, Alquiler 820 on day 1 in Vivienda. */
export function initialDemoOnboardingState({ step, seed, country, format, name, timezone, withoutNumber, linkOnRefresh }: DemoOnboardingParams): DemoOnboardingState {
  const defaults = country ? COUNTRY_DEFAULTS[country] : undefined
  const whatsapp: WhatsAppState = { number: withoutNumber ? null : DEMO_WHATSAPP_NUMBER, code: null, linked: null }
  const profile: OnboardingProfile = {
    name,
    country: country && defaults ? country : null,
    currency: defaults?.currency ?? 'EUR',
    timezone: defaults?.timezone ?? timezone,
    cycleDay: 1,
    amountFormat: format,
    savingsTarget: null,
    phone: null,
  }
  if (!seed) return { step, profile, categories: [], definitions: [], budgets: {}, whatsapp, linkOnRefresh }

  const vivienda = nextId('category')
  const comida = nextId('category')
  return {
    step,
    profile,
    categories: [
      { id: vivienda, name: 'Vivienda', color: 'granate' },
      { id: comida, name: 'Comida', color: 'rojo' },
    ],
    definitions: [
      { id: nextId('recurring'), name: 'Sueldo', expectedAmount: 2000, tipo: 'ingreso', categoryId: null, day: 1, active: true, reminder: { active: false, daysBefore: 0 }, repetitions: null },
      { id: nextId('recurring'), name: 'Alquiler', expectedAmount: 820, tipo: 'gasto', categoryId: vivienda, day: 1, active: true, reminder: { active: false, daysBefore: 0 }, repetitions: null },
    ],
    budgets: {},
    whatsapp,
    linkOnRefresh,
  }
}

/** The cycle in progress for `cycleDay`: the latest `cycleDay` on or before today, and today. */
export function demoCycle(cycleDay: number, now = new Date()): { start: LocalDate; today: LocalDate } {
  const today = now.toISOString().slice(0, 10)
  const year = now.getUTCFullYear()
  const month = now.getUTCMonth()
  const day = now.getUTCDate()
  const start = day >= cycleDay ? new Date(Date.UTC(year, month, cycleDay)) : new Date(Date.UTC(year, month - 1, cycleDay))
  return { start: start.toISOString().slice(0, 10), today }
}

export function deriveDemoOnboardingData(state: DemoOnboardingState): OnboardingData {
  return {
    step: state.step,
    profile: state.profile,
    cycle: demoCycle(state.profile.cycleDay),
    categories: state.categories,
    definitions: state.definitions,
    budgets: state.budgets,
    hasData: state.categories.length > 0 || state.definitions.length > 0 || Object.keys(state.budgets).length > 0,
    whatsapp: state.whatsapp,
  }
}

/** Resolves on the next tick, after the state update landed. */
function settle<T>(value: T): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(value), 0))
}

/** The sandbox's state outside React: the actions read it synchronously and the page subscribes. */
export type DemoOnboardingStore = {
  get(): DemoOnboardingState
  set(update: (state: DemoOnboardingState) => DemoOnboardingState): void
  subscribe(listener: () => void): () => void
}

export function createDemoOnboardingStore(initial: DemoOnboardingState): DemoOnboardingStore {
  let state = initial
  const listeners = new Set<() => void>()
  return {
    get: () => state,
    set(update) {
      state = update(state)
      for (const listener of listeners) listener()
    },
    subscribe(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
  }
}

/**
 * The contracts reject on the current state (a duplicate name, a category holding a definition,
 * a locked cycle day) before writing; each write resolves on the next tick.
 */
export function createDemoOnboardingActions(store: DemoOnboardingStore): OnboardingActions {
  const setState: Dispatch<SetStateAction<DemoOnboardingState>> = (update) =>
    store.set((state) => (typeof update === 'function' ? update(state) : update))
  const read = store.get
  return {
    profile: {
      updateBasics(basics) {
        const state = read()
        if (state && basics.cycleDay !== state.profile.cycleDay && deriveDemoOnboardingData(state).hasData) {
          return Promise.reject(new Error('cycle-locked'))
        }
        setState((s) => ({
          ...s,
          profile: {
            ...s.profile,
            name: basics.name,
            country: basics.country,
            currency: basics.currency,
            timezone: basics.timezone,
            cycleDay: basics.cycleDay,
            amountFormat: basics.country === 'AR' ? basics.amountFormat : 'completo',
          },
        }))
        return settle(undefined)
      },
      setSavingsTarget(amount) {
        setState((s) => ({ ...s, profile: { ...s.profile, savingsTarget: amount } }))
        return settle(undefined)
      },
      requestWhatsAppLink() {
        setState((s) => ({ ...s, whatsapp: { ...s.whatsapp, code: DEMO_LINK_CODE } }))
        return settle({ code: DEMO_LINK_CODE })
      },
      requestWhatsApp(phone, country) {
        const normalized = toE164(phone, country)
        if (!normalized) return Promise.reject(new Error('invalid-phone'))
        setState((s) => ({ ...s, profile: { ...s.profile, phone: normalized } }))
        return settle(undefined)
      },
      setStep(step) {
        setState((s) => ({ ...s, step }))
        return settle(undefined)
      },
      complete() {
        return settle(undefined)
      },
    },
    categories: {
      create(draft: CategoryDraft) {
        const state = read()
        if (state?.categories.some((category) => foldName(category.name) === foldName(draft.name))) {
          return Promise.reject(new Error(DUPLICATE_CATEGORY_NAME))
        }
        const id = nextId('category')
        setState((s) => ({
          ...s,
          categories: [...s.categories, { id, name: draft.name.trim(), color: draft.color }],
          budgets: draft.budget == null ? s.budgets : { ...s.budgets, [id]: draft.budget },
        }))
        return settle(id)
      },
      update(categoryId, draft) {
        const state = read()
        if (state?.categories.some((category) => category.id !== categoryId && foldName(category.name) === foldName(draft.name))) {
          return Promise.reject(new Error(DUPLICATE_CATEGORY_NAME))
        }
        setState((s) => ({
          ...s,
          categories: s.categories.map((category) => (category.id === categoryId ? { ...category, name: draft.name.trim(), color: draft.color } : category)),
          budgets: { ...s.budgets, [categoryId]: draft.budget },
        }))
        return settle(undefined)
      },
      delete(categoryId, reassignTo) {
        const state = read()
        if (reassignTo == null && state?.definitions.some((definition) => definition.categoryId === categoryId)) {
          return Promise.reject(new Error('category-not-empty'))
        }
        setState((s) => {
          const budgets = { ...s.budgets }
          delete budgets[categoryId]
          return {
            ...s,
            categories: s.categories.filter((category) => category.id !== categoryId),
            definitions: s.definitions.map((d) => (d.categoryId === categoryId ? { ...d, categoryId: reassignTo } : d)),
            budgets,
          }
        })
        return settle(undefined)
      },
      reorder(categoryIds) {
        setState((s) => {
          const byId = new Map(s.categories.map((category) => [category.id, category]))
          const ordered = categoryIds.flatMap((id) => byId.get(id) ?? [])
          const missing = s.categories.filter((category) => !categoryIds.includes(category.id))
          return { ...s, categories: [...ordered, ...missing] }
        })
        return settle(undefined)
      },
    },
    recurring: {
      create(target, draft) {
        setState((s) => ({
          ...s,
          definitions: [
            ...s.definitions,
            {
              id: nextId('recurring'),
              name: draft.name,
              expectedAmount: draft.expectedAmount,
              tipo: target.tipo,
              categoryId: target.tipo === 'gasto' ? target.categoryId : null,
              day: draft.day,
              active: true,
              reminder: draft.reminder,
              repetitions: draft.repetitions == null ? null : { total: draft.repetitions, done: 0 },
            },
          ],
        }))
        return settle(undefined)
      },
      update(definitionId, draft) {
        setState((s) => ({
          ...s,
          definitions: s.definitions.map((d) =>
            d.id === definitionId ? { ...d, name: draft.name, expectedAmount: draft.expectedAmount, day: draft.day, reminder: draft.reminder } : d,
          ),
        }))
        return settle(undefined)
      },
      stop(definitionId) {
        setState((s) => ({ ...s, definitions: s.definitions.map((d) => (d.id === definitionId ? { ...d, active: false } : d)) }))
        return settle(undefined)
      },
      delete(definitionId) {
        setState((s) => ({ ...s, definitions: s.definitions.filter((d) => d.id !== definitionId) }))
        return settle(undefined)
      },
    },
    materializeCurrentCycle() {
      return settle(undefined)
    },
    finish() {
      return settle(undefined)
    },
    refresh() {
      // What a re-read finds after the chat linked: only with `?e2eVinculado=1`, and only with a code out.
      setState((s) =>
        s.linkOnRefresh && s.whatsapp.code != null
          ? { ...s, profile: { ...s.profile, phone: DEMO_LINKED_NUMBER }, whatsapp: { ...s.whatsapp, code: null, linked: DEMO_LINKED_NUMBER } }
          : s,
      )
      return settle(undefined)
    },
  }
}
