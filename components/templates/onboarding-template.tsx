'use client'

import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Toast } from '@base-ui/react/toast'
import { Loader2 } from 'lucide-react'
import { useLocale, useTranslations } from 'next-intl'
import { useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'
import { AmountFormatProvider, useAmountFormatter } from '@/components/atoms/amount-format'
import { parseAmount } from '@/components/molecules/amount-field'
import { basicsValid, looksLikeName, type BasicsDraft } from '@/components/molecules/basics-fields'
import { parseInteger } from '@/components/molecules/integer-field'
import type { PhoneDraft } from '@/components/molecules/phone-field'
import { SwipeRestoreContext } from '@/components/molecules/swipe-to-delete'
import { GlassBackButton, ThemePill } from '@/components/molecules/theme-pill'
import { UndoToast } from '@/components/molecules/undo-toast'
import { WhatsAppLinkAction } from '@/components/molecules/whatsapp-link'
import { BasicsStep } from '@/components/organisms/onboarding/basics-step'
import { BudgetsStep, type Envelope } from '@/components/organisms/onboarding/budgets-step'
import { CategoriesStep, isNewCategory, type DraftCategory } from '@/components/organisms/onboarding/categories-step'
import { FixedStep } from '@/components/organisms/onboarding/fixed-step'
import { SavingsStep } from '@/components/organisms/onboarding/savings-step'
import { WelcomeStep } from '@/components/organisms/onboarding/welcome-step'
import { WhatsAppStep, type LinkPhase } from '@/components/organisms/onboarding/whatsapp-step'
import { ensureStoredChoice } from '@/components/theme/use-theme-choice'
import { LiveAmount } from '@/components/ui/counter/live-amount'
import type { OnboardingActions, OnboardingData } from '@/lib/data/onboarding'
// Pure functions over the typed values, not data access: the margin formula the dashboard uses
// (D10) and the country table (D4, D11). The atoms' amount-format module takes the same exception.
// eslint-disable-next-line @typescript-eslint/no-restricted-imports
import { getBudgetStatus, getFreeMargin } from '@/lib/data/budget'
// eslint-disable-next-line @typescript-eslint/no-restricted-imports
import { countryForTimezone, countryOf, timezoneForCountry } from '@/lib/data/countries'
import type { AmountFormat } from '@/lib/data/amount-format'

const STEPS = 7
/** How long the outgoing layer stays mounted: its 180 ms exit plus a frame (D14). */
const LEAVE_MS = 220

type Direction = 'forward' | 'back'
type Layer = { key: number; step: number; direction: Direction; leaving: boolean }

export type OnboardingTemplateProps = {
  data: OnboardingData
  actions: OnboardingActions
  /** Called once `finish` resolved: the mount navigates to the dashboard. */
  onFinished: () => void
  /** The sandbox's "nothing is saved" line. */
  notice?: ReactNode
}

/** Mirrors the profile contract's rejection messages (`lib/data/profile.ts`) without a runtime import. */
const CYCLE_LOCKED = 'cycle-locked'
const PHONE_TAKEN = 'phone-taken'
const INVALID_PHONE = 'invalid-phone'

function formatAmountForEdit(amount: number, locale: string): string {
  return new Intl.NumberFormat(locale, { minimumFractionDigits: 2, trailingZeroDisplay: 'stripIfInteger', useGrouping: false }).format(amount)
}

const DAY_MS = 86_400_000

/** Today's day of the cycle and the cycle's length, as `resumenMensual` computes them for a budget's pace. */
function cyclePosition(start: string, today: string): { currentDay: number; cycleDays: number } {
  const [year, month, day] = start.split('-').map(Number)
  const nextStart = Date.UTC(year, month, day)
  const from = Date.parse(start)
  const cycleDays = Math.round((nextStart - from) / DAY_MS)
  const currentDay = Math.min(cycleDays, Math.max(1, Math.round((Date.parse(today) - from) / DAY_MS) + 1))
  return { currentDay, cycleDays }
}

function initialBasics(profile: OnboardingData['profile']): BasicsDraft {
  // No country yet: the one whose zones hold the stored timezone, with its currency (D4).
  const country = profile.country ?? countryForTimezone(profile.timezone)
  const derived = profile.country == null && country ? countryOf(country) : null
  return {
    name: looksLikeName(profile.name) ? profile.name : '',
    country,
    currency: derived?.currency ?? profile.currency,
    timezone: country ? (timezoneForCountry(country, profile.timezone) ?? profile.timezone) : profile.timezone,
    cycleDay: String(profile.cycleDay),
    amountFormat: profile.amountFormat,
  }
}

export function OnboardingTemplate(props: OnboardingTemplateProps) {
  const { profile } = props.data
  const format: AmountFormat = profile.country === 'AR' ? profile.amountFormat : 'completo'
  return (
    <AmountFormatProvider format={format}>
      <Onboarding {...props} />
    </AmountFormatProvider>
  )
}

function Onboarding({ data, actions, onFinished, notice }: OnboardingTemplateProps) {
  const t = useTranslations('onboarding')
  const locale = useLocale()
  const router = useRouter()
  const { money } = useAmountFormatter()
  const toasts = useMemo(() => Toast.createToastManager(), [])

  const [step, setStep] = useState(data.step)
  const keyRef = useRef(1)
  const [layers, setLayers] = useState<Layer[]>(() => [{ key: 0, step: data.step, direction: 'forward', leaving: false }])
  // The welcome plays its entrance once, on the first mount; "Empezar" stays out until the welcome
  // says its last line has landed, and then comes in.
  const [welcomeEntrance, setWelcomeEntrance] = useState(data.step === 1)
  const [welcomeSettled, setWelcomeSettled] = useState(false)
  const [basics, setBasics] = useState<BasicsDraft>(() => initialBasics(data.profile))
  // Step 3 edits a local list and writes it on "Continuar" (D8): null = the stored categories.
  const [categoryDraft, setCategoryDraft] = useState<DraftCategory[] | null>(null)
  const [budgetDrafts, setBudgetDrafts] = useState<Record<string, string>>({})
  const [savingsText, setSavingsText] = useState(() => (data.profile.savingsTarget == null ? '' : String(data.profile.savingsTarget)))
  const [pending, setPending] = useState(false)
  const [basicsError, setBasicsError] = useState<string | null>(null)
  const [statusMessage, setStatusMessage] = useState('')
  // The closing step (D7): the code arrives with the step or is requested on a resume; the phase
  // moves to "waiting" when the link is activated and to "linked" when the account shows a channel.
  const [linkCode, setLinkCode] = useState<string | null>(data.whatsapp.code)
  const [opened, setOpened] = useState(false)
  const [phoneDraft, setPhoneDraft] = useState<PhoneDraft>({ country: data.profile.country, local: '' })
  const [phoneError, setPhoneError] = useState<'taken' | 'invalid' | 'save' | null>(null)
  const [phoneSaved, setPhoneSaved] = useState(false)
  const [savingPhone, setSavingPhone] = useState(false)
  const requestingCode = useRef(false)
  const linked = data.whatsapp.linked
  // Without a configured number there is no link to activate: the step starts waiting (D7).
  const phase: LinkPhase = linked ? 'linked' : opened || !data.whatsapp.number ? 'waiting' : 'idle'

  // A browser with no stored choice follows the OS from the first frame and keeps it (D13).
  useLayoutEffect(() => {
    ensureStoredChoice()
  }, [])

  // The outgoing layer leaves the tree once its exit has played.
  useEffect(() => {
    if (!layers.some((layer) => layer.leaving)) return
    const timeout = setTimeout(() => setLayers((prev) => prev.filter((layer) => !layer.leaving)), LEAVE_MS)
    return () => clearTimeout(timeout)
  }, [layers])

  // A resume at step 7 (or a failed request on the way in) asks for the code once the step shows.
  useEffect(() => {
    if (step !== 7 || linkCode != null || linked || requestingCode.current) return
    requestingCode.current = true
    actions.profile
      .requestWhatsAppLink()
      .then((result) => setLinkCode(result.code))
      .catch(() => {})
      .finally(() => {
        requestingCode.current = false
      })
  }, [step, linkCode, linked, actions.profile])

  // While waiting, a return to the tab re-reads the account: a link made in the chat shows up.
  useEffect(() => {
    if (step !== 7 || phase !== 'waiting') return
    function refresh() {
      if (document.visibilityState === 'hidden') return
      void actions.refresh()
    }
    document.addEventListener('visibilitychange', refresh)
    window.addEventListener('focus', refresh)
    return () => {
      document.removeEventListener('visibilitychange', refresh)
      window.removeEventListener('focus', refresh)
    }
  }, [step, phase, actions])

  function go(next: number) {
    if (next === step || next < 1 || next > STEPS) return
    const direction: Direction = next > step ? 'forward' : 'back'
    if (step === 1) setWelcomeEntrance(false)
    setStep(next)
    setLayers((prev) => [
      ...prev.filter((layer) => !layer.leaving).map((layer) => ({ ...layer, leaving: true, direction })),
      { key: keyRef.current++, step: next, direction, leaving: false },
    ])
    // Optimistic: the step is already shown; a failed write only loses the resume point.
    actions.profile.setStep(next).catch(() => {})
  }

  // ── The envelope model (D10): the same formula and inputs the dashboard will have ───────────
  const cycleStart = data.cycle.start

  /**
   * Writes the step-3 draft through the dashboard's own operations, in an order that never trips
   * the duplicate-name check: removals, then renames and recolours, then the new ones (each one
   * takes its stored id in the draft as soon as it exists, so a retry after a failure resumes),
   * then the order when it differs from what the writes left behind.
   */
  async function syncCategories() {
    const draft = categoryDraft
    if (!draft) return
    const stored = data.categories
    for (const category of stored) {
      if (!draft.some((row) => row.id === category.id)) await actions.categories.delete(category.id, null, { cycle: cycleStart, scope: 'onward' })
    }
    const ids: string[] = []
    for (const row of draft) {
      if (isNewCategory(row)) {
        const id = await actions.categories.create({ name: row.name, color: row.color, budget: null }, cycleStart, 'onward')
        setCategoryDraft((prev) => prev?.map((r) => (r.id === row.id ? { ...r, id } : r)) ?? null)
        ids.push(id)
        continue
      }
      const before = stored.find((category) => category.id === row.id)
      if (before && (before.name !== row.name || before.color !== row.color)) {
        await actions.categories.update(row.id, { name: row.name, color: row.color, budget: data.budgets[row.id] ?? null }, { cycle: cycleStart, scope: null })
      }
      ids.push(row.id)
    }
    const kept = stored.map((category) => category.id).filter((id) => ids.includes(id))
    const written = [...kept, ...ids.filter((id) => !kept.includes(id))]
    if (ids.length > 1 && ids.some((id, index) => id !== written[index])) await actions.categories.reorder(ids)
    setCategoryDraft(null)
  }
  const envelope: Envelope = useMemo(() => {
    const active = data.definitions.filter((definition) => definition.active)
    const income = active.filter((d) => d.tipo === 'ingreso').reduce((sum, d) => sum + d.expectedAmount, 0)
    const position = cyclePosition(data.cycle.start, data.cycle.today)
    const rows = data.categories.map((category) => {
      const stored = data.budgets[category.id]
      const draft = budgetDrafts[category.id]
      // A field never touched reads the stored budget; a typed one, what it holds (invalid = empty).
      const budget = draft == null ? (stored ?? null) : parseAmount(draft)
      const fixed = active.filter((d) => d.tipo === 'gasto' && d.categoryId === category.id).reduce((sum, d) => sum + d.expectedAmount, 0)
      // The dashboard card's own figures: its fixed charges are what the category has spent so far.
      const status = budget != null ? getBudgetStatus({ amount: budget, spent: fixed, ...position }) : null
      return { ...category, fixed, budget, status }
    })
    const margin = getFreeMargin({ income, savings: 0, categories: rows.map((row) => ({ budget: row.budget, spent: row.fixed })) })
    return { income, rows, margin }
  }, [data.definitions, data.categories, data.budgets, data.cycle.start, data.cycle.today, budgetDrafts])

  const drafts = useMemo(() => {
    const result: Record<string, string> = {}
    for (const category of data.categories) {
      const stored = data.budgets[category.id]
      result[category.id] = budgetDrafts[category.id] ?? (stored == null ? '' : formatAmountForEdit(stored, locale))
    }
    return result
  }, [data.categories, data.budgets, budgetDrafts, locale])

  async function commitBudget(categoryId: string, text: string): Promise<'ok' | 'invalid' | 'failed'> {
    const category = data.categories.find((c) => c.id === categoryId)
    if (!category) return 'failed'
    const trimmed = text.trim()
    const budget = trimmed === '' ? null : parseAmount(trimmed)
    if (trimmed !== '' && budget == null) return 'invalid'
    if (budget === (data.budgets[categoryId] ?? null)) return 'ok'
    try {
      await actions.categories.update(categoryId, { name: category.name, color: category.color, budget }, { cycle: cycleStart, scope: null })
      return 'ok'
    } catch {
      // Back to the stored value; the step shows "No se pudo guardar".
      setBudgetDrafts((prev) => {
        const next = { ...prev }
        delete next[categoryId]
        return next
      })
      return 'failed'
    }
  }

  const savingsValue = parseAmount(savingsText)
  const savingsInvalid = savingsText.trim() !== '' && savingsValue == null

  // ── The closing step (D7) ───────────────────────────────────────────────────────────────────
  async function finish() {
    await actions.finish()
    onFinished()
  }

  /** "Guardar número": stores the typed number for its country and stays on the step. */
  async function savePhone() {
    if (savingPhone || !phoneDraft.country) return
    setSavingPhone(true)
    setPhoneError(null)
    setPhoneSaved(false)
    try {
      await actions.profile.requestWhatsApp(phoneDraft.local, phoneDraft.country)
      setPhoneSaved(true)
    } catch (error) {
      const message = error instanceof Error ? error.message : ''
      setPhoneError(message === PHONE_TAKEN ? 'taken' : message === INVALID_PHONE ? 'invalid' : 'save')
    } finally {
      setSavingPhone(false)
    }
  }

  // ── The primary action of each step (D7) ────────────────────────────────────────────────────
  async function runPrimary() {
    if (pending) return
    setPending(true)
    try {
      switch (step) {
        case 1:
          go(2)
          break
        case 2: {
          setBasicsError(null)
          const cycleDay = parseInteger(basics.cycleDay, { min: 1, max: 28 })
          if (!basics.country || cycleDay == null) return
          try {
            await actions.profile.updateBasics({
              name: basics.name.trim(),
              country: basics.country,
              currency: basics.currency,
              timezone: basics.timezone,
              cycleDay,
              amountFormat: basics.amountFormat,
            })
          } catch (error) {
            setBasicsError(error instanceof Error && error.message === CYCLE_LOCKED ? t('datos.cicloBloqueado') : t('errorGuardar'))
            return
          }
          go(3)
          break
        }
        case 3:
          try {
            await syncCategories()
          } catch {
            toasts.add({ title: t('errorGuardar'), priority: 'high' })
            return
          }
          go(4)
          break
        case 4:
          try {
            await actions.materializeCurrentCycle()
          } catch {
            toasts.add({ title: t('errorGuardar'), priority: 'high' })
            return
          }
          go(5)
          break
        case 5:
          go(6)
          break
        case 6:
          if (savingsInvalid) return
          try {
            await actions.profile.setSavingsTarget(savingsValue)
          } catch {
            toasts.add({ title: t('errorGuardar'), priority: 'high' })
            return
          }
          // The code travels with the step, so the bubble shows it from the first frame; a failed
          // request is retried by the step's own effect.
          if (linkCode == null && !linked) {
            try {
              setLinkCode((await actions.profile.requestWhatsAppLink()).code)
            } catch {}
          }
          go(7)
          break
        case 7:
          // "Ir a mi mes": the primary once the link was activated or none is offered.
          await finish()
          break
      }
    } finally {
      setPending(false)
    }
  }

  async function skipWhatsApp() {
    if (pending) return
    setPending(true)
    try {
      await finish()
    } catch {
      toasts.add({ title: t('errorGuardar'), priority: 'high' })
      setPending(false)
    }
  }

  const primaryDisabled = (step === 2 && !basicsValid(basics)) || (step === 6 && savingsInvalid)
  const primaryLabel = step === 1 ? t('empezar') : step === 7 ? t('whatsapp.irAMiMes') : t('continuar')
  // Step 7 in `idle` puts the `wa.me` anchor in the primary's slot instead of the button (D7).
  const primaryIsLink = step === 7 && phase === 'idle'
  const showsHero = step === 5 || step === 6
  const listStep = step === 3 || step === 4 || step === 5
  const currency = basics.country ? basics.currency : data.profile.currency

  function renderStep(current: number) {
    switch (current) {
      case 1:
        return <WelcomeStep onEntranceEnd={() => setWelcomeSettled(true)} />
      case 2:
        return (
          <BasicsStep
            value={basics}
            onChange={(next) => {
              setBasics(next)
              setBasicsError(null)
            }}
            storedTimezone={data.profile.timezone}
            namePlaceholder={looksLikeName(data.profile.name) ? undefined : data.profile.name}
            locked={data.hasData}
            disabled={pending}
            error={basicsError}
          />
        )
      case 3:
        return (
          <CategoriesStep
            categories={categoryDraft ?? data.categories}
            definitions={data.definitions}
            onChange={setCategoryDraft}
            disabled={pending}
            onStatus={setStatusMessage}
          />
        )
      case 4:
        return (
          <FixedStep
            categories={data.categories}
            definitions={data.definitions}
            currency={currency}
            actions={actions.recurring}
            onCategoriesStep={() => go(3)}
            onStatus={setStatusMessage}
          />
        )
      case 5:
        return (
          <BudgetsStep
            envelope={envelope}
            currency={currency}
            drafts={drafts}
            onDraftChange={(categoryId, text) => setBudgetDrafts((prev) => ({ ...prev, [categoryId]: text }))}
            onCommit={commitBudget}
            onIncomeStep={() => go(4)}
          />
        )
      case 6:
        return <SavingsStep value={savingsText} onChange={setSavingsText} currency={currency} invalid={savingsInvalid} disabled={pending} />
      case 7:
        return (
          <WhatsAppStep
            number={data.whatsapp.number}
            code={linkCode}
            linked={linked}
            phase={phase}
            phone={phoneDraft}
            onPhoneChange={(next) => {
              setPhoneDraft(next)
              setPhoneError(null)
              setPhoneSaved(false)
            }}
            onSavePhone={() => void savePhone()}
            savingPhone={savingPhone}
            phoneError={phoneError}
            phoneSaved={phoneSaved}
            disabled={pending}
          />
        )
      default:
        return null
    }
  }

  return (
    <Toast.Provider toastManager={toasts} limit={1} timeout={5000}>
      <SwipeRestoreContext.Provider value={{}}>
        <div className="relative min-h-dvh pb-32 sm:pb-12">
          {/* The progress line: a 2 px line under the safe area, growing with the step (D14). */}
          <div
            role="progressbar"
            aria-label={t('progreso')}
            aria-valuemin={1}
            aria-valuemax={STEPS}
            aria-valuenow={step}
            aria-valuetext={t(`pasos.${step}`)}
            className="fixed inset-x-0 top-[env(safe-area-inset-top,0px)] z-30 h-0.5 bg-foreground/10"
          >
            <span aria-hidden className="onboarding-progress block h-full w-full bg-brand-ink" style={{ transform: `scaleX(${step / STEPS})` }} />
          </div>

          <ThemePill />

          <div className={cn('relative mx-auto w-full px-gutter pt-20', listStep ? 'max-w-[440px] sm:max-w-[520px]' : 'max-w-[440px]')}>
            {/* The welcome's back control leaves for the home; from step 2 on it goes one step back. */}
            {step > 1 ? (
              <GlassBackButton label={t('volver')} onClick={() => go(step - 1)} className="sm:absolute sm:left-0 sm:top-4" />
            ) : (
              <GlassBackButton label={t('volverInicio')} onClick={() => router.push('/')} className="sm:absolute sm:left-0 sm:top-4" />
            )}

            {notice ? <div className="pb-4">{notice}</div> : null}

            {/* The hero persists from budgets to the savings target: outside the layers (D10, D11). */}
            {showsHero ? (
              <div className={cn('onboarding-hero onboarding-row mb-6', envelope.margin < 0 && 'hero-card--negative')} data-hero>
                <h1 key={step} className="onboarding-row font-display text-headline-lg text-foreground">
                  {t(step === 5 ? 'presupuestos.titulo' : 'ahorro.titulo')}
                </h1>
                <p className="mt-4 text-body-lg text-muted-foreground">{t('presupuestos.margenLibre')}</p>
                <LiveAmount
                  amount={envelope.margin}
                  currency={currency}
                  currencyClassName="text-headline-md"
                  className="hero-value mt-1 block font-display text-display-mobile sm:text-display"
                />
                <p className="mt-2 text-body-md text-muted-foreground">{t('presupuestos.explicacion')}</p>
                {step === 6 && savingsValue != null ? (
                  <p data-savings-preview className="mt-2 text-body-md text-muted-foreground">
                    {t('ahorro.preview', { monto: money(envelope.margin - savingsValue, currency) })}
                  </p>
                ) : null}
              </div>
            ) : null}

            <div className="relative">
              {layers.map((layer) => (
                <section
                  key={layer.key}
                  data-step={layer.step}
                  data-direction={layer.direction}
                  data-leaving={layer.leaving || undefined}
                  aria-hidden={layer.leaving || undefined}
                  inert={layer.leaving}
                  className="onboarding-layer"
                >
                  {renderStep(layer.step)}
                </section>
              ))}
            </div>
          </div>

          {/* The primary action's slot: pinned above the safe area on a phone, at the column's bottom
              on desktop. The welcome has nothing to scroll, so its "Empezar" sits under the lines
              on every screen. */}
          <div
            className={cn(
              'z-20',
              step === 1 ? 'static pb-0 pt-8' : 'fixed inset-x-0 bottom-0 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 sm:static sm:pb-0 sm:pt-8',
            )}
          >
            <div
              className={cn(
                'mx-auto flex w-full max-w-[440px] flex-col items-center gap-2 px-gutter',
                step === 1 && welcomeEntrance && (welcomeSettled ? 'onboarding-cta-in' : 'opacity-0'),
                // Step 2: "Continuar" appears once the fields have landed (their 200 ms delay + 300 ms).
                step === 2 && 'onboarding-slot-in',
              )}
              // Inline, as the welcome's lines do: the classes' `animation` shorthand is unlayered CSS
              // and would reset a Tailwind `[animation-delay:…]` utility back to 0.
              style={step === 2 ? { animationDelay: '500ms' } : undefined}
            >
              {primaryIsLink ? (
                <WhatsAppLinkAction
                  number={data.whatsapp.number}
                  code={linkCode}
                  onRequestCode={actions.profile.requestWhatsAppLink}
                  onCodeReady={setLinkCode}
                  onOpened={() => setOpened(true)}
                  label={t('whatsapp.vincular')}
                />
              ) : (
                <button
                  type="button"
                  data-primary
                  onClick={() => void runPrimary()}
                  disabled={primaryDisabled}
                  aria-disabled={pending || undefined}
                  aria-busy={pending || undefined}
                  className={cn(
                    'onboarding-button relative flex h-12 items-center justify-center overflow-hidden whitespace-nowrap bg-primary text-body-lg font-semibold text-primary-foreground outline-none transition-[width,border-radius] duration-300 ease-out focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-50 motion-reduce:transition-none',
                    pending ? 'w-12 rounded-full' : 'w-full rounded-[18px]',
                  )}
                >
                  <span className={cn('transition-opacity duration-150 motion-reduce:transition-none', pending && 'opacity-0')}>{primaryLabel}</span>
                  {/* Mounted only while pending: a hidden spinner would still be an endless animation. */}
                  {pending ? (
                    <Loader2
                      aria-hidden
                      className="absolute inset-0 m-auto size-5 animate-spin transition-opacity delay-150 duration-200 starting:opacity-0 motion-reduce:transition-none"
                    />
                  ) : null}
                </button>
              )}
              {step === 7 && phase !== 'linked' ? (
                <button
                  type="button"
                  onClick={() => void skipWhatsApp()}
                  disabled={pending}
                  className="onboarding-button h-11 rounded-full px-4 text-body-lg font-medium text-brand-ink outline-none focus-visible:outline-2 disabled:opacity-50"
                >
                  {t('whatsapp.seguirSin')}
                </button>
              ) : null}
            </div>
          </div>

          <UndoToast />
          <div role="status" className="sr-only">
            {statusMessage}
          </div>
        </div>
      </SwipeRestoreContext.Provider>
    </Toast.Provider>
  )
}
