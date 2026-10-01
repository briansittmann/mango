import { useId, useState, type FormEvent } from 'react'
import { Toast } from '@base-ui/react/toast'
import { useTranslations } from 'next-intl'
import { CategoryDot } from '@/components/atoms/category-dot'
import { Money } from '@/components/atoms/money'
import { AmountField, parseAmount } from '@/components/molecules/amount-field'
import { IntegerField, parseInteger } from '@/components/molecules/integer-field'
import { cn } from '@/lib/utils'
import type { OnboardingActions, OnboardingData } from '@/lib/data/onboarding'
import type { RecurringDefinition } from '@/lib/data/recurring'

type FixedStepProps = {
  categories: OnboardingData['categories']
  definitions: RecurringDefinition[]
  currency: string
  actions: OnboardingActions['recurring']
  onOpenDefinition: (definition: RecurringDefinition) => void
  onCategoriesStep: () => void
  onStatus: (message: string) => void
}

type ComposerProps = {
  tipo: 'gasto' | 'ingreso'
  categories: OnboardingData['categories']
  currency: string
  actions: OnboardingActions['recurring']
  onStatus: (message: string) => void
}

/** The last row of each list: name, amount, day and, for an expense, the category (D9). */
function Composer({ tipo, categories, currency, actions, onStatus }: ComposerProps) {
  const t = useTranslations('onboarding')
  const tAmount = useTranslations('hojaGasto')
  const tDay = useTranslations('gastoRecurrente')
  const toasts = Toast.useToastManager()
  const id = useId()
  const [name, setName] = useState('')
  const [amount, setAmount] = useState('')
  const [day, setDay] = useState('1')
  const [categoryId, setCategoryId] = useState<string | null>(categories[0]?.id ?? null)
  const [touched, setTouched] = useState({ amount: false, day: false })
  const [busy, setBusy] = useState(false)

  const amountValue = parseAmount(amount)
  const dayValue = parseInteger(day, { min: 1, max: 31 })
  const category = categories.find((c) => c.id === categoryId) ?? categories[0] ?? null
  const valid = name.trim() !== '' && amountValue != null && dayValue != null && (tipo === 'ingreso' || category != null)

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (!valid || busy || amountValue == null || dayValue == null) return
    setBusy(true)
    try {
      await actions.create(
        tipo === 'gasto' && category ? { tipo: 'gasto', categoryId: category.id } : { tipo: 'ingreso' },
        { name: name.trim(), expectedAmount: amountValue, day: dayValue, reminder: { active: false, daysBefore: 0 }, repetitions: null },
      )
      onStatus(t('fijos.anadido'))
      setName('')
      setAmount('')
      setTouched({ amount: false, day: false })
    } catch {
      toasts.add({ title: t('fijos.errorAnadir'), priority: 'high' })
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} className="border-t border-border pb-2" aria-label={t(tipo === 'gasto' ? 'fijos.pagas' : 'fijos.cobras')}>
      <div className="flex min-h-row items-center gap-3 px-inset py-2">
        <label htmlFor={`${id}-name`} className="flex-1 text-body-lg text-foreground">
          {t('fijos.nombre')}
        </label>
        <input
          id={`${id}-name`}
          type="text"
          autoCapitalize="sentences"
          enterKeyHint="next"
          placeholder={t(tipo === 'gasto' ? 'fijos.nombreGasto' : 'fijos.nombreIngreso')}
          readOnly={busy}
          value={name}
          onChange={(event) => setName(event.target.value)}
          className="field-focus w-44 rounded-lg bg-muted px-2 py-1.5 text-right text-body-lg text-foreground outline-none placeholder:text-muted-foreground/70"
        />
      </div>
      <AmountField
        id={`${id}-amount`}
        label={t('fijos.monto')}
        currency={currency}
        value={amount}
        onChange={setAmount}
        onBlur={() => setTouched((prev) => ({ ...prev, amount: true }))}
        disabled={busy}
        invalid={touched.amount && amount.trim() !== '' && amountValue == null}
        invalidMessage={tAmount('importeInvalido')}
      />
      <IntegerField
        id={`${id}-day`}
        label={t('fijos.dia')}
        value={day}
        onChange={setDay}
        onBlur={() => setTouched((prev) => ({ ...prev, day: true }))}
        disabled={busy}
        maxLength={2}
        invalid={touched.day && dayValue == null}
        invalidMessage={tDay('diaInvalido')}
      />
      {tipo === 'gasto' ? (
        <div className="relative px-inset pt-3 before:absolute before:left-4 before:right-0 before:top-0 before:h-px before:bg-border">
          <p id={`${id}-category-label`} className="text-body-sm text-muted-foreground">
            {t('fijos.categoria')}
          </p>
          <div role="radiogroup" aria-labelledby={`${id}-category-label`} className="mt-2 flex flex-wrap gap-2">
            {categories.map((option) => {
              const selected = category?.id === option.id
              return (
                <button
                  key={option.id}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  disabled={busy}
                  onClick={() => setCategoryId(option.id)}
                  className={cn(
                    'onboarding-chip flex h-9 items-center gap-2 rounded-full px-3 text-body-md font-medium outline-none focus-visible:outline-2',
                    selected ? 'bg-foreground text-background' : 'bg-muted text-foreground',
                  )}
                >
                  <CategoryDot color={option.color} className="size-2" />
                  {option.name}
                </button>
              )
            })}
          </div>
        </div>
      ) : null}
      <div className="flex justify-end px-inset pt-3">
        <button
          type="submit"
          disabled={!valid || busy}
          className="onboarding-button h-10 rounded-full px-3 text-body-lg font-medium text-brand-ink outline-none focus-visible:outline-2 disabled:opacity-50"
        >
          {t('fijos.anadir')}
        </button>
      </div>
    </form>
  )
}

/**
 * Step 4 (`onboarding` → *Income and fixed expenses step*, D9): two lists, income first, each with
 * its rows and a composer; a row opens the definition sheet the template mounts. The pending
 * charges of the cycle in progress are stored by the template on "Continuar".
 */
export function FixedStep({ categories, definitions, currency, actions, onOpenDefinition, onCategoriesStep, onStatus }: FixedStepProps) {
  const t = useTranslations('onboarding')
  const lists = [
    { tipo: 'ingreso', title: t('fijos.cobras') },
    { tipo: 'gasto', title: t('fijos.pagas') },
  ] as const

  return (
    <div className="flex flex-col gap-4">
      <h1 className="font-display text-headline-lg text-foreground">{t('fijos.titulo')}</h1>
      {lists.map(({ tipo, title }) => {
        const rows = definitions.filter((definition) => definition.tipo === tipo && definition.active)
        const canCompose = tipo === 'ingreso' || categories.length > 0
        return (
          <section key={tipo} aria-labelledby={`fixed-${tipo}-title`} className="flex flex-col gap-2">
            <h2 id={`fixed-${tipo}-title`} className="font-display text-headline-sm text-foreground">
              {title}
            </h2>
            <div className="rounded-card border bg-card">
              {rows.length > 0 ? (
                <ul>
                  {rows.map((definition, index) => {
                    const category = categories.find((c) => c.id === definition.categoryId)
                    return (
                      <li key={definition.id} className="onboarding-row">
                        <button
                          type="button"
                          onClick={() => onOpenDefinition(definition)}
                          aria-label={t('fijos.fila', { nombre: definition.name, dia: definition.day })}
                          className={cn(
                            'pressable relative flex min-h-row w-full items-center gap-3 px-inset py-2 text-left',
                            index > 0 && 'before:absolute before:left-4 before:right-0 before:top-0 before:h-px before:bg-border',
                          )}
                        >
                          {category ? <CategoryDot color={category.color} className="size-1.5" /> : null}
                          <span className="flex min-w-0 flex-1 flex-col">
                            <span className="truncate text-body-lg text-foreground">{definition.name}</span>
                            <span className="text-body-sm text-muted-foreground">{t('fijos.diaCorto', { dia: definition.day })}</span>
                          </span>
                          <Money amount={definition.expectedAmount} currency={currency} className="shrink-0 text-tabular-numeric-md text-foreground" />
                        </button>
                      </li>
                    )
                  })}
                </ul>
              ) : null}
              {canCompose ? (
                <Composer tipo={tipo} categories={categories} currency={currency} actions={actions} onStatus={onStatus} />
              ) : (
                <p className="flex min-h-row flex-wrap items-center gap-x-2 px-inset py-3 text-body-md text-muted-foreground">
                  <span>{t('fijos.sinCategorias')}</span>
                  <button type="button" onClick={onCategoriesStep} className="onboarding-button font-medium text-brand-ink outline-none focus-visible:outline-2">
                    {t('fijos.irACategorias')}
                  </button>
                </p>
              )}
            </div>
          </section>
        )
      })}
    </div>
  )
}
