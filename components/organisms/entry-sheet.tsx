import { Fragment, useEffect, useId, useLayoutEffect, useRef, useState, type FormEvent, type RefObject } from 'react'
import { Drawer } from '@base-ui/react/drawer'
import { Ban, Check, ChevronDown, Loader2, Trash2 } from 'lucide-react'
import { useFormatter, useLocale, useTranslations } from 'next-intl'
import { useAmountFormatter } from '@/components/atoms/amount-format'
import { CategoryDot } from '@/components/atoms/category-dot'
import { Collapsible } from '@/components/atoms/collapsible'
import { Switch } from '@/components/atoms/switch'
import { AmountField, parseAmount } from '@/components/molecules/amount-field'
import { DateCalendar } from '@/components/molecules/date-calendar'
import { FieldRow } from '@/components/molecules/field-row'
import { IntegerField, parseInteger } from '@/components/molecules/integer-field'
import { ScopeChoice, type Reach, type Scope } from '@/components/molecules/scope-choice'
import { SheetShell } from '@/components/organisms/sheet-shell'
import { cn } from '@/lib/utils'
import type { Card } from '@/lib/data/cards'
import type { CategoryColor } from '@/lib/data/dashboard'
import type { ExpenseDraft, LocalDate } from '@/lib/data/expenses'
import type { IncomeDraft } from '@/lib/data/income'
import type { RecurringDefinition, RecurringDraft } from '@/lib/data/recurring'
import type { SavingsMovementDraft } from '@/lib/data/savings'
import type esMessages from '@/messages/es.json'

type FieldKind = 'amount' | 'text' | 'date'
type HojaGastoKey = keyof typeof esMessages.hojaGasto

export type TextFieldDescriptor<V> = {
  name: keyof V & string
  kind: FieldKind
  labelKey: HojaGastoKey
  placeholderKey?: HojaGastoKey
  optional?: boolean
  /** Shown when a required field (no `optional: true`) is empty after trim. */
  invalidMessageKey?: HojaGastoKey
}

/** A pill radiogroup, its value a plain string in `fieldState`. Options carry already-resolved
 * labels — the caller resolves them (they live outside `hojaGasto`), not a `HojaGastoKey`. */
export type ChoiceFieldDescriptor<V> = {
  name: keyof V & string
  kind: 'choice'
  /** The radiogroup's accessible name — read from `hojaGasto`, unlike `options[].label`. */
  labelKey: HojaGastoKey
  options: { value: string; label: string }[]
}

/** A switch with a hint line under it, revealed while another field holds `shownWhen.value`
 * (`add-savings-sheet` D5). It reads and saves a boolean; while hidden it saves `false`. */
export type ToggleFieldDescriptor<V> = {
  name: keyof V & string
  kind: 'toggle'
  labelKey: HojaGastoKey
  hintKey: HojaGastoKey
  shownWhen: { field: keyof V & string; value: string }
}

/** The switch plus its revealed day/ending/count block (D3) — one composite kind, not three
 * descriptors, because the three validate and read from each other as one unit. Renders in
 * create mode only, and only when the sheet is given `onSaveRecurrence`. */
export type RecurrenceFieldDescriptor = { kind: 'recurrence' }

export type FieldDescriptor<V> = TextFieldDescriptor<V> | ChoiceFieldDescriptor<V> | ToggleFieldDescriptor<V> | RecurrenceFieldDescriptor

export type EntryConfig<V> = {
  fields: FieldDescriptor<V>[]
  /** A new entry starts at its name; an edit at the amount, the field that usually changes. */
  initialFocus: { create: keyof V & string; edit: keyof V & string }
  titleKeys: { create: HojaGastoKey; edit: HojaGastoKey }
  submitKeys: { create: HojaGastoKey; edit: HojaGastoKey }
  deleteKey: HojaGastoKey
}

export const expenseEntry: EntryConfig<ExpenseDraft> = {
  fields: [
    { name: 'description', kind: 'text', labelKey: 'descripcion', placeholderKey: 'opcional', optional: true },
    { name: 'amount', kind: 'amount', labelKey: 'importe' },
    { name: 'date', kind: 'date', labelKey: 'fecha' },
    { kind: 'recurrence' },
  ],
  initialFocus: { create: 'description', edit: 'amount' },
  titleKeys: { create: 'nuevoGasto', edit: 'editarGasto' },
  submitKeys: { create: 'anadir', edit: 'guardar' },
  deleteKey: 'eliminarGasto',
}

export const incomeEntry: EntryConfig<IncomeDraft> = {
  fields: [
    { name: 'description', kind: 'text', labelKey: 'descripcion', placeholderKey: 'opcional', optional: true },
    { name: 'amount', kind: 'amount', labelKey: 'importe' },
    { name: 'date', kind: 'date', labelKey: 'fecha' },
    { kind: 'recurrence' },
  ],
  initialFocus: { create: 'description', edit: 'amount' },
  titleKeys: { create: 'nuevoIngreso', edit: 'editarIngreso' },
  submitKeys: { create: 'anadir', edit: 'guardar' },
  deleteKey: 'eliminarIngreso',
}

/** Built by the caller, not exported as a static config like `expenseEntry`/`incomeEntry`: the
 * type labels come from `resumen.deposito` / `resumen.retiro` (D4), outside `hojaGasto`, so the
 * caller resolves them and passes them in. "Ya lo tenía ahorrado" is offered for a deposit only. */
export function savingsEntry(typeOptions: { deposit: string; withdrawal: string }): EntryConfig<SavingsMovementDraft> {
  return {
    fields: [
      {
        name: 'kind',
        kind: 'choice',
        labelKey: 'tipo',
        options: [
          { value: 'deposit', label: typeOptions.deposit },
          { value: 'withdrawal', label: typeOptions.withdrawal },
        ],
      },
      { name: 'name', kind: 'text', labelKey: 'nombre', invalidMessageKey: 'nombreObligatorio' },
      { name: 'amount', kind: 'amount', labelKey: 'importe' },
      { name: 'date', kind: 'date', labelKey: 'fecha' },
      { name: 'alreadySaved', kind: 'toggle', labelKey: 'yaLoTenia', hintKey: 'yaLoTeniaAyuda', shownWhen: { field: 'kind', value: 'deposit' } },
    ],
    initialFocus: { create: 'name', edit: 'amount' },
    titleKeys: { create: 'nuevoMovimientoAhorro', edit: 'editarMovimientoAhorro' },
    submitKeys: { create: 'anadir', edit: 'guardar' },
    deleteKey: 'eliminarMovimiento',
  }
}

type EntrySheetContext =
  | { kind: 'category'; id: string; name: string; color: CategoryColor; recurring: boolean }
  | { kind: 'income'; recurring: boolean }
  | { kind: 'savings' }

type EntrySheetProps<V> = {
  config: EntryConfig<V>
  open: boolean
  onOpenChange: (open: boolean) => void
  mode: 'create' | 'edit'
  context: EntrySheetContext
  initialValues: Partial<V>
  fieldOptions: { amount?: { currency: string }; date?: { min: LocalDate; max: LocalDate } }
  initialFocusRef: RefObject<HTMLInputElement | null>
  finalFocusRef?: RefObject<HTMLElement | null>
  /**
   * `scope` is the answer to "Solo este mes" / "Desde este mes en adelante" on a row that belongs to
   * a definition (`recurring-expenses` → *Every change to a recurring row asks how far it reaches*),
   * `'only'` when nothing changed, null on any other row. `categoryId` is the header's category.
   * `slotChanged` says whether this month's values or category differ from what the sheet opened
   * with; `reminder` is the fixed's new reminder, null when unchanged (`unify-fixed-charge-sheet` D3);
   * `charged` is the "Cobrado este mes" switch, null when unchanged or not shown; `card` is the
   * fixed's new card (`null` = "Sin tarjeta"), undefined when unchanged (`add-card-wallet` D8).
   */
  onSave: (
    values: V,
    extra: {
      scope: Scope | null
      categoryId: string | null
      slotChanged: boolean
      reminder: RecurringDefinition['reminder'] | null
      charged: boolean | null
      card?: string | null
    },
  ) => Promise<void>
  /** A recurring row asks how far first, in a confirmation step (three reaches with `fixed`); any other row passes null. */
  onDelete?: (reach: Reach | null) => Promise<void>
  /** A fixed row's own section below the fields (`unify-fixed-charge-sheet` D1, D2); absent on any other row. */
  fixed?: {
    definition: RecurringDefinition
    /** Whether this cycle's expense charge shows charged; absent hides the switch. Saved with "Guardar". */
    charged?: boolean
    /** The reminder switch, for an expense. */
    reminder: boolean
    /** Present only while the definition is active. */
    onStop?: () => Promise<void>
    /** The user's cards, for a fixed expense's "Tarjeta" row; absent or empty hides it. */
    cards?: Card[]
  }
  /**
   * The categories alive in the displayed cycle. In edit mode, with a category context, the
   * header's category becomes the control that moves the row (`expense-editing` → *Moving an
   * expense to another category*).
   */
  categories?: { id: string; name: string; color: CategoryColor }[]
  /** Create mode opened without a card ("Añadir gasto" in the desktop bar, design D7): the header's category control is enabled too. */
  allowCategoryChange?: boolean
  /**
   * Present only when the page supplies `actions.recurring` and the row may become fixed: any create,
   * or an edit of a row with no definition in the cycle in progress (`unify-fixed-charge-sheet` D7).
   * Its presence is what makes the recurrence field render at all. Called after `onSave` resolves,
   * only when the switch is on; `onSave` still runs the ordinary create or update either way.
   */
  onSaveRecurrence?: (draft: RecurringDraft) => Promise<void>
  /** Opened from a projected cycle: no recurrence switch, whatever `onSaveRecurrence` is (D5). */
  projected?: boolean
}

type FieldState = Record<string, string>

function formatAmountForEdit(amount: number, locale: string): string {
  return new Intl.NumberFormat(locale, {
    minimumFractionDigits: 2,
    trailingZeroDisplay: 'stripIfInteger',
    useGrouping: false,
  }).format(amount)
}

function buildFieldState<V>(config: EntryConfig<V>, values: Partial<V>, locale: string): FieldState {
  const source = values as Record<string, unknown>
  const state: FieldState = {}
  for (const field of config.fields) {
    if (field.kind === 'recurrence') continue
    const raw = source[field.name]
    if (field.kind === 'amount') {
      state[field.name] = typeof raw === 'number' ? formatAmountForEdit(raw, locale) : ''
    } else if (field.kind === 'toggle') {
      state[field.name] = raw === true ? 'true' : ''
    } else {
      state[field.name] = typeof raw === 'string' ? raw : ''
    }
  }
  return state
}

function buildValues<V>(config: EntryConfig<V>, state: FieldState, amount: number): V {
  const result: Record<string, unknown> = {}
  for (const field of config.fields) {
    if (field.kind === 'recurrence') continue
    if (field.kind === 'amount') result[field.name] = amount
    else if (field.kind === 'text') result[field.name] = state[field.name].trim()
    else if (field.kind === 'toggle') result[field.name] = state[field.name] === 'true' && state[field.shownWhen.field] === field.shownWhen.value
    else result[field.name] = state[field.name]
  }
  return result as V
}

const RECURRENCE_ENDINGS = ['none', 'count'] as const
type RecurrenceEnding = (typeof RECURRENCE_ENDINGS)[number]

function isTextField<V>(field: FieldDescriptor<V>): field is TextFieldDescriptor<V> | ChoiceFieldDescriptor<V> | ToggleFieldDescriptor<V> {
  return field.kind !== 'recurrence'
}

export function EntrySheet<V>({
  config,
  open,
  onOpenChange,
  mode,
  context,
  initialValues,
  fieldOptions,
  initialFocusRef,
  finalFocusRef,
  onSave,
  onDelete,
  fixed,
  onSaveRecurrence: onSaveRecurrenceProp,
  projected = false,
  categories,
  allowCategoryChange = false,
}: EntrySheetProps<V>) {
  const onSaveRecurrence = projected ? undefined : onSaveRecurrenceProp
  const t = useTranslations('hojaGasto')
  const tRecurrente = useTranslations('gastoRecurrente')
  const tTarjetas = useTranslations('tarjetas')
  const format = useFormatter()
  const { money } = useAmountFormatter()
  const locale = useLocale()

  const formId = useId()

  const [wasOpen, setWasOpen] = useState(open)
  const [fieldState, setFieldState] = useState<FieldState>(() => buildFieldState(config, initialValues, locale))
  const [initialSnapshot, setInitialSnapshot] = useState<FieldState>(fieldState)
  const [touched, setTouched] = useState<Partial<Record<string, boolean>>>({})
  const [status, setStatus] = useState<'idle' | 'saving' | 'deleting' | 'stopping'>('idle')
  const [error, setError] = useState<'save' | 'delete' | 'stop' | null>(null)
  const [step, setStep] = useState<'form' | 'confirmDelete'>('form')
  const [scope, setScope] = useState<Scope | null>(null)
  const [deleteScope, setDeleteScope] = useState<Reach | null>(null)
  const [reminderActive, setReminderActive] = useState(fixed?.definition.reminder.active ?? false)
  const [reminderDaysBefore, setReminderDaysBefore] = useState(String(fixed?.definition.reminder.daysBefore ?? 1))
  const [reminderTouched, setReminderTouched] = useState(false)
  const [chargedOn, setChargedOn] = useState(fixed?.charged ?? false)
  const [cardChoice, setCardChoice] = useState<string | null>(fixed?.definition.cardId ?? null)
  const [cardPickerOpen, setCardPickerOpen] = useState(false)
  const cardTriggerRef = useRef<HTMLButtonElement>(null)
  const initialCategoryId = context.kind === 'category' ? context.id : null
  const [categoryId, setCategoryId] = useState<string | null>(initialCategoryId)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [dateOpen, setDateOpen] = useState(false)
  const dateTriggerRef = useRef<HTMLButtonElement>(null)
  const chipRef = useRef<HTMLButtonElement>(null)
  const pickerRef = useRef<HTMLDivElement>(null)
  const confirmCancelRef = useRef<HTMLButtonElement>(null)
  const deleteRowRef = useRef<HTMLButtonElement>(null)

  const [recurrenceOn, setRecurrenceOn] = useState(false)
  const [recurrenceDay, setRecurrenceDay] = useState('')
  const [recurrenceEnding, setRecurrenceEnding] = useState<RecurrenceEnding>('none')
  const [recurrenceCount, setRecurrenceCount] = useState('')
  const [recurrenceTouched, setRecurrenceTouched] = useState<{ day?: boolean; count?: boolean }>({})
  const recurrenceCountRef = useRef<HTMLInputElement | null>(null)
  const amountInputRef = useRef<HTMLInputElement | null>(null)

  // Picking "un número de veces" reveals the count field right below it — jump straight into it.
  useEffect(() => {
    if (recurrenceEnding === 'count') {
      recurrenceCountRef.current?.focus()
      recurrenceCountRef.current?.select()
    }
  }, [recurrenceEnding])

  if (open !== wasOpen) {
    setWasOpen(open)
    if (open) {
      const next = buildFieldState(config, initialValues, locale)
      setFieldState(next)
      setInitialSnapshot(next)
      setTouched({})
      setStatus('idle')
      setError(null)
      setRecurrenceOn(false)
      setRecurrenceDay(next.date ? String(Number(next.date.slice(8, 10))) : '')
      setRecurrenceEnding('none')
      setRecurrenceCount('')
      setRecurrenceTouched({})
      setStep('form')
      setScope(null)
      setDeleteScope(null)
      setReminderActive(fixed?.definition.reminder.active ?? false)
      setReminderDaysBefore(String(fixed?.definition.reminder.daysBefore ?? 1))
      setReminderTouched(false)
      setChargedOn(fixed?.charged ?? false)
      setCardChoice(fixed?.definition.cardId ?? null)
      setCardPickerOpen(false)
      setCategoryId(initialCategoryId)
      setPickerOpen(false)
      setDateOpen(false)
    }
  }

  useLayoutEffect(() => {
    if (step === 'confirmDelete') confirmCancelRef.current?.focus()
  }, [step])

  // The picker closes on a pointer down outside it (the chip toggles it itself), and on Escape —
  // caught in the capture phase, ahead of the drawer's own listener, so Escape closes the picker
  // and not the sheet.
  useEffect(() => {
    if (!pickerOpen) return
    function onPointerDown(event: PointerEvent) {
      const target = event.target as Node | null
      if (pickerRef.current?.contains(target) || chipRef.current?.contains(target)) return
      setPickerOpen(false)
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== 'Escape') return
      event.stopPropagation()
      setPickerOpen(false)
      chipRef.current?.focus()
    }
    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown, true)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown, true)
    }
  }, [pickerOpen])

  const amountFieldDescriptor = config.fields.find(
    (field): field is TextFieldDescriptor<V> & { kind: 'amount' } => field.kind === 'amount',
  )
  const amountValue = amountFieldDescriptor ? parseAmount(fieldState[amountFieldDescriptor.name] ?? '') : 0
  const slotDirty =
    config.fields.filter(isTextField).some((field) => fieldState[field.name] !== initialSnapshot[field.name]) ||
    categoryId !== initialCategoryId
  const daysBeforeValue = parseInteger(reminderDaysBefore, { min: 0 })
  const reminderValid = !reminderActive || daysBeforeValue !== null
  const reminderDirty =
    fixed != null &&
    fixed.reminder &&
    (reminderActive !== fixed.definition.reminder.active || (reminderActive && daysBeforeValue !== fixed.definition.reminder.daysBefore))
  const chargedDirty = fixed?.charged != null && chargedOn !== fixed.charged
  const cardDirty = fixed != null && (fixed.cards?.length ?? 0) > 0 && cardChoice !== fixed.definition.cardId
  const isDirty = slotDirty || reminderDirty || chargedDirty || cardDirty
  const disabled = status !== 'idle'
  const asksScope = mode === 'edit' && context.kind !== 'savings' && context.recurring
  const showScope = asksScope && slotDirty
  const movable = (mode === 'edit' || allowCategoryChange) && context.kind === 'category' && categories != null && categories.length > 1
  const shownCategory =
    context.kind === 'category' ? (categories?.find((category) => category.id === categoryId) ?? context) : null

  const requiredTextFields = config.fields.filter(
    (field): field is TextFieldDescriptor<V> & { kind: 'text' } => field.kind === 'text' && !field.optional,
  )
  const emptyRequiredTextFields = requiredTextFields.filter((field) => (fieldState[field.name] ?? '').trim() === '')

  const recurrenceDayValid = parseInteger(recurrenceDay, { min: 1, max: 31 }) !== null
  const recurrenceCountValid = recurrenceEnding !== 'count' || parseInteger(recurrenceCount, { min: 1 }) !== null
  const recurrenceValid = !recurrenceOn || (recurrenceDayValid && recurrenceCountValid)

  const primaryDisabled =
    disabled ||
    (amountFieldDescriptor ? amountValue === null : false) ||
    emptyRequiredTextFields.length > 0 ||
    !recurrenceValid ||
    !reminderValid ||
    (showScope && scope == null)

  function updateField(name: string, value: string) {
    setFieldState((prev) => ({ ...prev, [name]: value }))
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (emptyRequiredTextFields.length > 0) {
      setTouched((prev) => ({ ...prev, ...Object.fromEntries(emptyRequiredTextFields.map((field) => [field.name, true])) }))
      return
    }
    if (amountFieldDescriptor && amountValue === null) {
      setTouched((prev) => ({ ...prev, [amountFieldDescriptor.name]: true }))
      return
    }
    if (recurrenceOn && !recurrenceValid) {
      setRecurrenceTouched({ day: true, count: recurrenceEnding === 'count' })
      return
    }
    if (!reminderValid) {
      setReminderTouched(true)
      return
    }
    const values = buildValues(config, fieldState, amountValue ?? 0)
    const recurrenceDayNumber = parseInteger(recurrenceDay, { min: 1, max: 31 })
    if (recurrenceOn && onSaveRecurrence && recurrenceDayNumber != null) {
      // This cycle's charge and the definition describe the same day, so the date field's
      // day-of-month is overridden to match the recurrence day — the two creates then
      // correlate into one row (see attachCreatedDefinitions in demo-expenses.ts) instead of
      // the date field's own, separately-editable day producing a second, uncorrelated one.
      const dated = values as unknown as { date?: string }
      if (typeof dated.date === 'string') {
        dated.date = `${dated.date.slice(0, 8)}${String(recurrenceDayNumber).padStart(2, '0')}`
      }
    }
    setStatus('saving')
    setError(null)
    try {
      await onSave(values, {
        scope: asksScope ? (scope ?? 'only') : null,
        categoryId,
        slotChanged: slotDirty,
        reminder: reminderDirty ? { active: reminderActive, daysBefore: daysBeforeValue ?? fixed!.definition.reminder.daysBefore } : null,
        charged: chargedDirty ? chargedOn : null,
        card: cardDirty ? cardChoice : undefined,
      })
      if (onSaveRecurrence && recurrenceOn) {
        // The definition's name and expected amount are the same values just typed into the
        // expense's own description and amount fields — see attachCreatedDefinitions in
        // demo-expenses.ts, which relies on this equality (and the day override above) to link
        // the two creates into one row.
        const name = (values as unknown as { description?: string }).description?.trim() ?? ''
        await onSaveRecurrence({
          name,
          expectedAmount: amountValue ?? 0,
          day: recurrenceDayNumber ?? 1,
          reminder: { active: false, daysBefore: 1 },
          repetitions: recurrenceEnding === 'count' ? parseInteger(recurrenceCount, { min: 1 }) : null,
        })
      }
    } catch {
      setStatus('idle')
      setError('save')
    }
  }

  async function runFixedAction(action: () => Promise<void>, running: 'stopping', failure: 'stop') {
    setStatus(running)
    setError(null)
    try {
      await action()
    } catch {
      setStatus('idle')
      setError(failure)
    }
  }

  async function handleDelete(chosen: Reach | null) {
    if (!onDelete) return
    setStatus('deleting')
    setError(null)
    try {
      await onDelete(chosen)
    } catch {
      setStatus('idle')
      setError('delete')
    }
  }

  function closeDate() {
    setDateOpen(false)
    dateTriggerRef.current?.focus()
  }

  function renderRecurrenceField() {
    if (!onSaveRecurrence) return null

    const switchId = `${formId}-recurrence-switch`
    const dayId = `${formId}-recurrence-day`
    const countId = `${formId}-recurrence-count`
    const dayInvalid = Boolean(recurrenceTouched.day) && !recurrenceDayValid
    const countInvalid = recurrenceEnding === 'count' && Boolean(recurrenceTouched.count) && !recurrenceCountValid
    const amountText = money(amountValue ?? 0, fieldOptions.amount?.currency ?? 'EUR')

    return (
      <>
        <div className="border-t border-border" />
        <FieldRow label={tRecurrente('seRepite')} htmlFor={switchId}>
          <Switch id={switchId} checked={recurrenceOn} onCheckedChange={setRecurrenceOn} disabled={disabled} />
        </FieldRow>
        <Collapsible open={recurrenceOn}>
          <IntegerField
            id={dayId}
            label={tRecurrente('diaDelMes')}
            value={recurrenceDay}
            onChange={setRecurrenceDay}
            onBlur={() => setRecurrenceTouched((prev) => ({ ...prev, day: true }))}
            disabled={disabled}
            invalid={dayInvalid}
            invalidMessage={tRecurrente('diaInvalido')}
            maxLength={2}
          />
          <p className="px-inset pb-3 text-body-sm text-muted-foreground">
            {context.kind === 'category'
              ? tRecurrente('explicacion', { dia: recurrenceDay || '—', monto: amountText, categoria: context.name })
              : tRecurrente('explicacionIngreso', { dia: recurrenceDay || '—', monto: amountText })}
          </p>
          <div role="radiogroup" aria-label={tRecurrente('seRepite')} className="flex gap-2 px-inset pb-3">
            {RECURRENCE_ENDINGS.map((option) => {
              const selected = recurrenceEnding === option
              return (
                <button
                  key={option}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  disabled={disabled}
                  onClick={() => setRecurrenceEnding(option)}
                  className={cn(
                    'pressable min-h-target flex-1 rounded-full border px-3 text-body-sm font-medium',
                    selected ? 'border-transparent bg-primary text-primary-foreground' : 'border-border text-foreground',
                  )}
                >
                  {tRecurrente(option === 'none' ? 'sinFinal' : 'unNumeroDeVeces')}
                </button>
              )
            })}
          </div>
          <Collapsible open={recurrenceEnding === 'count'}>
            <IntegerField
              id={countId}
              label={tRecurrente('cantidadDePagos')}
              value={recurrenceCount}
              onChange={setRecurrenceCount}
              onBlur={() => setRecurrenceTouched((prev) => ({ ...prev, count: true }))}
              inputRef={(el) => {
                recurrenceCountRef.current = el
              }}
              disabled={disabled}
              invalid={countInvalid}
              invalidMessage={tRecurrente('cantidadInvalida')}
              maxLength={3}
            />
          </Collapsible>
        </Collapsible>
      </>
    )
  }

  function renderField(field: FieldDescriptor<V>) {
    if (field.kind === 'recurrence') return renderRecurrenceField()

    const id = `${formId}-${field.name}`
    const value = fieldState[field.name] ?? ''

    if (field.kind === 'amount') {
      const invalid = Boolean(touched[field.name]) && parseAmount(value) === null
      return (
        <AmountField
          id={id}
          label={t(field.labelKey)}
          currency={fieldOptions.amount?.currency}
          value={value}
          onChange={(next) => updateField(field.name, next)}
          onFocus={(event) => {
            if (mode === 'edit') event.currentTarget.select()
          }}
          onBlur={() => setTouched((prev) => ({ ...prev, [field.name]: true }))}
          inputRef={(el) => {
            amountInputRef.current = el
            if (field.name === config.initialFocus[mode]) initialFocusRef.current = el
          }}
          disabled={disabled}
          invalid={invalid}
          invalidMessage={t('importeInvalido')}
        />
      )
    }

    if (field.kind === 'text') {
      const invalid = !field.optional && Boolean(touched[field.name]) && value.trim() === ''
      // The name comes before the amount: while the amount is empty, Enter moves on to it.
      const nextIsAmount = amountFieldDescriptor != null && amountValue === null
      return (
        <>
          <FieldRow label={t(field.labelKey)} htmlFor={id}>
            <input
              id={id}
              ref={(el) => {
                if (field.name === config.initialFocus[mode]) initialFocusRef.current = el
              }}
              type="text"
              data-base-ui-swipe-ignore
              enterKeyHint={nextIsAmount ? 'next' : 'done'}
              autoCapitalize="sentences"
              onKeyDown={(event) => {
                if (event.key !== 'Enter' || !nextIsAmount) return
                event.preventDefault()
                amountInputRef.current?.focus()
              }}
              readOnly={disabled}
              aria-invalid={invalid || undefined}
              aria-describedby={invalid ? `${id}-error` : undefined}
              placeholder={field.placeholderKey ? t(field.placeholderKey) : undefined}
              value={value}
              onChange={(event) => updateField(field.name, event.target.value)}
              onBlur={() => setTouched((prev) => ({ ...prev, [field.name]: true }))}
              className="field-focus w-40 rounded-lg bg-muted px-2 py-1.5 text-right text-body-lg text-foreground placeholder:text-muted-foreground outline-none"
            />
          </FieldRow>
          {invalid && field.invalidMessageKey ? (
            <p id={`${id}-error`} className="px-inset pb-2 text-body-sm text-destructive-ink">
              {t(field.invalidMessageKey)}
            </p>
          ) : null}
        </>
      )
    }

    if (field.kind === 'toggle') {
      const hintId = `${id}-hint`
      return (
        <Collapsible open={fieldState[field.shownWhen.field] === field.shownWhen.value}>
          <div className="border-t border-border" />
          <FieldRow label={t(field.labelKey)} htmlFor={id}>
            {/* Keeps the focused field from blurring, as the type buttons do: an empty name's error
                line would grow a top-anchored side sheet and move the switch out from under the press. */}
            <span className="contents" onMouseDown={(event) => event.preventDefault()}>
              <Switch
                id={id}
                checked={value === 'true'}
                onCheckedChange={(on) => updateField(field.name, on ? 'true' : '')}
                disabled={disabled}
                aria-describedby={hintId}
              />
            </span>
          </FieldRow>
          <p id={hintId} className="px-inset pb-3 text-body-sm text-muted-foreground">
            {t(field.hintKey)}
          </p>
        </Collapsible>
      )
    }

    if (field.kind === 'choice') {
      return (
        <div role="radiogroup" aria-label={t(field.labelKey)} className="flex gap-2 px-inset pb-3">
          {field.options.map((option) => {
            const selected = value === option.value
            return (
              <button
                key={option.value}
                type="button"
                role="radio"
                aria-checked={selected}
                disabled={disabled}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => updateField(field.name, option.value)}
                className={cn(
                  'pressable min-h-target flex-1 rounded-full border px-3 text-body-sm font-medium',
                  selected ? 'border-transparent bg-primary text-primary-foreground' : 'border-border text-foreground',
                )}
              >
                {option.label}
              </button>
            )
          })}
        </div>
      )
    }

    return (
      <>
        <FieldRow label={t(field.labelKey)} htmlFor={id}>
          <button
            ref={dateTriggerRef}
            id={id}
            type="button"
            disabled={disabled}
            aria-expanded={dateOpen}
            aria-controls={`${id}-calendar`}
            data-value={value}
            onClick={() => setDateOpen((prev) => !prev)}
            className={cn(
              'pressable block rounded-lg px-2 py-1.5 text-body-lg transition-colors duration-200 [--press-scale:0.96] motion-reduce:transition-none',
              dateOpen ? 'bg-primary/15 text-primary' : 'bg-muted text-foreground',
            )}
          >
            {value ? format.dateTime(new Date(`${value}T00:00:00Z`), { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }) : ''}
          </button>
        </FieldRow>
        <DateCalendar
          id={`${id}-calendar`}
          open={dateOpen}
          value={value}
          min={fieldOptions.date?.min}
          max={fieldOptions.date?.max}
          onSelect={(next) => {
            updateField(field.name, next)
            setDateOpen(false)
            dateTriggerRef.current?.focus()
          }}
          onClose={closeDate}
        />
      </>
    )
  }

  // The fixed expense's card (`add-card-wallet` D8): the current one, and a list of the user's cards
  // and "Sin tarjeta" that unfolds below it, as the header's category control does.
  function renderCardRow(cards: Card[]) {
    const current = cards.find((card) => card.id === cardChoice) ?? null
    const listId = `${formId}-cards`
    const options: { id: string | null; name: string; color: CategoryColor | null }[] = [
      ...cards.map((card) => ({ id: card.id, name: card.name, color: card.color })),
      { id: null, name: tTarjetas('sinTarjeta'), color: null },
    ]
    return (
      <>
        <div data-fixed-card className="relative flex min-h-row items-center gap-3 px-inset before:absolute before:left-4 before:right-0 before:top-0 before:h-px before:bg-border">
          <span id={`${listId}-label`} className="flex-1 text-body-lg text-foreground">
            {tTarjetas('tarjeta')}
          </span>
          <button
            ref={cardTriggerRef}
            type="button"
            aria-expanded={cardPickerOpen}
            aria-controls={listId}
            aria-label={tTarjetas('elegirTarjeta', { tarjeta: current?.name ?? tTarjetas('sinTarjeta') })}
            disabled={disabled}
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => setCardPickerOpen((value) => !value)}
            className="pressable -mr-2 flex min-h-target items-center gap-1.5 rounded-full px-3 text-body-lg text-foreground [--press-scale:0.96] hover:bg-foreground/[0.06] disabled:pointer-events-none disabled:opacity-50"
          >
            {current ? <CategoryDot color={current.color} className="size-2 shrink-0" /> : null}
            <span data-fixed-card-current className="max-w-40 truncate">
              {current?.name ?? tTarjetas('sinTarjeta')}
            </span>
            <ChevronDown
              aria-hidden
              className={cn('size-3.5 shrink-0 text-muted-foreground transition-transform duration-200 motion-reduce:transition-none', cardPickerOpen && 'rotate-180')}
            />
          </button>
        </div>
        <Collapsible open={cardPickerOpen}>
          <div
            id={listId}
            role="radiogroup"
            aria-labelledby={`${listId}-label`}
            className={cn(
              'mx-inset mb-2 grid origin-top grid-cols-2 gap-1.5 rounded-[22px] bg-foreground/[0.04] p-1.5 transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] motion-reduce:transition-none',
              cardPickerOpen ? 'scale-100' : 'scale-95',
            )}
          >
            {options.map((option) => {
              const selected = option.id === cardChoice
              return (
                <button
                  key={option.id ?? 'none'}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  disabled={disabled}
                  onClick={() => {
                    setCardChoice(option.id)
                    setCardPickerOpen(false)
                    cardTriggerRef.current?.focus()
                  }}
                  className={cn(
                    'flex min-h-11 min-w-0 items-center gap-2 rounded-2xl px-3 text-label-ui transition-all duration-200 motion-reduce:transition-none',
                    selected
                      ? 'bg-primary font-semibold text-primary-foreground shadow-[0_6px_18px_-4px_color-mix(in_oklab,var(--primary)_55%,transparent)]'
                      : 'text-foreground hover:bg-foreground/[0.06] active:scale-95',
                  )}
                >
                  {option.color ? <CategoryDot color={option.color} className="size-2 shrink-0" /> : null}
                  <span className="min-w-0 flex-1 truncate text-left">{option.name}</span>
                  {selected ? <Check aria-hidden className="size-3.5 shrink-0" /> : null}
                </button>
              )
            })}
          </div>
        </Collapsible>
      </>
    )
  }

  // The fixed's section (`unify-fixed-charge-sheet` D2): what it repeats, then what can be done to it.
  function renderFixedSection(section: NonNullable<typeof fixed>) {
    const { definition } = section
    const currency = fieldOptions.amount?.currency ?? 'EUR'
    const remaining = definition.repetitions ? definition.repetitions.total - definition.repetitions.done : 0
    // The pending total follows the typed amount once it is meant for every month.
    const perCharge = scope === 'onward' && amountValue != null ? amountValue : definition.expectedAmount
    const reminderId = `${formId}-reminder`
    const daysBeforeId = `${formId}-days-before`
    const rowClass =
      'flex min-h-row items-center gap-3 px-inset text-body-lg font-medium text-foreground hover:bg-muted active:bg-muted disabled:pointer-events-none disabled:opacity-50'
    return (
      <>
        <div className="border-t border-border" />
        <p data-fixed-summary className="px-inset py-3 text-body-sm text-muted-foreground">
          <span className="block">{tRecurrente('resumen', { monto: money(definition.expectedAmount, currency), dia: definition.day })}</span>
          {definition.repetitions && remaining > 0 ? (
            <span className="block">
              {tRecurrente('progreso', { hechas: definition.repetitions.done, total: definition.repetitions.total })}
              {' · '}
              {tRecurrente('quedanPagos', { pagos: remaining, monto: money(remaining * perCharge, currency) })}
            </span>
          ) : null}
        </p>
        {section.charged != null ? (
          // A switch, not an action: it only changes what "Guardar" writes, both ways.
          <button
            type="button"
            role="switch"
            aria-checked={chargedOn}
            data-on={chargedOn || undefined}
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => setChargedOn((value) => !value)}
            disabled={disabled}
            className="charge-toggle pressable relative flex min-h-row w-full items-center gap-3 px-inset text-left text-body-lg font-medium text-foreground disabled:pointer-events-none disabled:opacity-50 before:absolute before:left-4 before:right-0 before:top-0 before:h-px before:bg-border"
          >
            <svg aria-hidden viewBox="0 0 20 20" className="charge-toggle-mark size-5 shrink-0">
              <circle cx="10" cy="10" r="8.5" className="charge-toggle-ring" />
              <path d="M6.2 10.4l2.5 2.5 5.1-5.6" pathLength={1} className="charge-toggle-check" />
            </svg>
            <span className="flex-1">{t('cobradoEsteMes')}</span>
          </button>
        ) : null}
        {section.reminder ? (
          <>
            <FieldRow label={tRecurrente('recordatorio')} htmlFor={reminderId}>
              {/* Keeps a focused field from blurring under the press, as the other switches do. */}
              <span className="contents" onMouseDown={(event) => event.preventDefault()}>
                <Switch id={reminderId} checked={reminderActive} onCheckedChange={setReminderActive} disabled={disabled} />
              </span>
            </FieldRow>
            <Collapsible open={reminderActive}>
              <IntegerField
                id={daysBeforeId}
                label={tRecurrente('diasAntes')}
                value={reminderDaysBefore}
                onChange={setReminderDaysBefore}
                onBlur={() => setReminderTouched(true)}
                disabled={disabled}
                invalid={reminderTouched && !reminderValid}
                invalidMessage={tRecurrente('diasAntesInvalido')}
                maxLength={2}
              />
            </Collapsible>
          </>
        ) : null}
        {section.cards && section.cards.length > 0 ? renderCardRow(section.cards) : null}
        {section.onStop ? (
          <>
            <div className="border-t border-border" />
            <button type="button" onClick={() => void runFixedAction(section.onStop!, 'stopping', 'stop')} disabled={disabled} className={rowClass}>
              {status === 'stopping' ? <Loader2 aria-hidden className="size-5 animate-spin" /> : <Ban aria-hidden className="size-5" />}
              {tRecurrente('dejarDeRepetir')}
            </button>
          </>
        ) : null}
      </>
    )
  }

  const title = t(mode === 'create' ? config.titleKeys.create : config.titleKeys.edit)
  const submitLabel = t(mode === 'create' ? config.submitKeys.create : config.submitKeys.edit)

  return (
    <SheetShell
      open={open}
      onOpenChange={onOpenChange}
      busy={status !== 'idle'}
      isDirty={isDirty}
      initialFocus={initialFocusRef}
      finalFocus={finalFocusRef}
      leading={
        <Drawer.Close
          disabled={disabled}
          // Keeps the focused field from blurring: its error line would grow the sheet and move
          // this button out from under the press before the click lands.
          onMouseDown={(event) => event.preventDefault()}
          className="pressable text-body-md text-muted-foreground disabled:pointer-events-none disabled:opacity-50"
        >
          {t('cancelar')}
        </Drawer.Close>
      }
      title={title}
      trailing={
        // Distinct keys: reusing one <button> would turn it into the submit while its click is
        // still being dispatched, and the browser would then submit the form and close the sheet.
        step === 'confirmDelete' ? (
          <button
            key="confirm-cancel"
            ref={confirmCancelRef}
            type="button"
            disabled={disabled}
            onClick={() => {
              setStep('form')
              deleteRowRef.current?.focus()
            }}
            className="pressable text-body-md text-muted-foreground disabled:pointer-events-none disabled:opacity-50"
          >
            {t('cancelar')}
          </button>
        ) : (
        <button
          key="submit"
          type="submit"
          form={formId}
          disabled={primaryDisabled}
          onMouseDown={(event) => event.preventDefault()}
          className={cn(
            'pressable h-9 rounded-full px-4 font-semibold',
            primaryDisabled ? 'bg-muted text-muted-foreground' : 'bg-primary text-primary-foreground',
          )}
        >
          {status === 'saving' ? (
            <>
              <Loader2 aria-hidden className="size-4 animate-spin" />
              <span className="sr-only">{submitLabel}</span>
            </>
          ) : (
            submitLabel
          )}
        </button>
        )
      }
      caption={
        shownCategory ? (
          movable ? (
            <button
              ref={chipRef}
              type="button"
              aria-expanded={pickerOpen}
              aria-controls={`${formId}-categories`}
              aria-label={t('cambiarCategoria', { categoria: shownCategory.name })}
              disabled={disabled || step !== 'form'}
              onClick={() => setPickerOpen((prev) => !prev)}
              className="pressable -my-2 flex min-h-target min-w-target items-center justify-center gap-1.5 rounded-full px-3 text-foreground [--press-scale:0.96] hover:bg-foreground/[0.06] disabled:pointer-events-none"
            >
              <CategoryDot color={shownCategory.color} className="size-2 shrink-0" />
              <span className="truncate">
                {context.kind === 'category' && context.recurring ? t('seRepite', { categoria: shownCategory.name }) : shownCategory.name}
              </span>
              <ChevronDown
                aria-hidden
                className={cn('size-3.5 shrink-0 text-muted-foreground transition-transform duration-200 motion-reduce:transition-none', pickerOpen && 'rotate-180')}
              />
            </button>
          ) : (
            <>
              <CategoryDot color={shownCategory.color} className="size-2 shrink-0" />
              <span className="truncate">
                {context.kind === 'category' && context.recurring ? t('seRepite', { categoria: shownCategory.name }) : shownCategory.name}
              </span>
            </>
          )
        ) : context.kind === 'income' ? (
          <span className="truncate">{context.recurring ? t('ingresoSeRepite') : t('ingreso')}</span>
        ) : (
          <span className="truncate">{t('ahorro')}</span>
        )
      }
    >
      <form id={formId} onSubmit={handleSubmit} aria-busy={disabled} className="flex min-h-0 flex-1 flex-col">
        {/* `pb-4` keeps the last row off the panel's bottom edge and gives the keyboard-aware
            scroll something to scroll into, so a field focused at the very bottom — the revealed
            "número de pagos" in particular — settles clear of the edge rather than flush against it. */}
        <Drawer.Content className="flex flex-1 flex-col overflow-y-auto overscroll-contain pb-4">
          {error ? (
            <div role="alert" className="mx-inset mt-3 rounded-inner bg-destructive/[0.08] px-4 py-3 text-body-md text-destructive-ink">
              {t(error === 'save' ? 'errorGuardar' : error === 'stop' ? 'errorDejarDeRepetir' : 'errorEliminar')}
            </div>
          ) : null}
          {step === 'confirmDelete' ? (
            <>
              <h3 className="px-inset pb-2 pt-3 text-body-lg text-foreground">
                {t('confirmarEliminarFijo', { nombre: fieldState.description || (shownCategory?.name ?? t('ingreso')) })}
              </h3>
              {fixed ? (
                <ScopeChoice<Reach>
                  value={deleteScope}
                  onChange={setDeleteScope}
                  options={['only', 'onward', 'all']}
                  hints={{ only: t('eliminarSoloAyuda'), onward: t('eliminarDesdeAyuda'), all: t('eliminarTodoAyuda') }}
                  disabled={disabled}
                  legend={t('eliminarAlcance')}
                  destructive
                />
              ) : (
                <ScopeChoice value={deleteScope as Scope | null} onChange={setDeleteScope} disabled={disabled} legend={t('eliminarAlcance')} destructive />
              )}
              <div className="px-inset pb-2 pt-3">
                <button
                  type="button"
                  onClick={() => void handleDelete(deleteScope)}
                  disabled={disabled || deleteScope == null}
                  className="flex min-h-row w-full items-center justify-center gap-2 rounded-full bg-destructive/[0.08] text-body-lg font-semibold text-destructive-ink disabled:pointer-events-none disabled:opacity-50"
                >
                  {status === 'deleting' ? <Loader2 aria-hidden className="size-5 animate-spin" /> : <Trash2 aria-hidden className="size-5" />}
                  {t('eliminar')}
                </button>
              </div>
            </>
          ) : (
            <>
          {movable ? (
            <Collapsible open={pickerOpen}>
              <div
                ref={pickerRef}
                id={`${formId}-categories`}
                role="radiogroup"
                aria-label={t('cambiarCategoria', { categoria: shownCategory?.name ?? '' })}
                className={cn(
                  'mx-inset mb-2 grid origin-top grid-cols-2 gap-1.5 rounded-[22px] bg-foreground/[0.04] p-1.5 transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] motion-reduce:transition-none',
                  pickerOpen ? 'scale-100' : 'scale-95',
                )}
              >
                {categories!.map((category) => {
                  const selected = category.id === categoryId
                  return (
                    <button
                      key={category.id}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      onClick={() => {
                        setCategoryId(category.id)
                        setPickerOpen(false)
                        chipRef.current?.focus()
                      }}
                      className={cn(
                        'flex min-h-11 min-w-0 items-center gap-2 rounded-2xl px-3 text-label-ui transition-all duration-200 motion-reduce:transition-none',
                        selected
                          ? 'bg-primary font-semibold text-primary-foreground shadow-[0_6px_18px_-4px_color-mix(in_oklab,var(--primary)_55%,transparent)]'
                          : 'text-foreground hover:bg-foreground/[0.06] active:scale-95',
                      )}
                    >
                      <CategoryDot color={category.color} className="size-2 shrink-0" />
                      <span className="min-w-0 flex-1 truncate text-left">{category.name}</span>
                      {selected ? <Check aria-hidden className="size-3.5 shrink-0" /> : null}
                    </button>
                  )
                })}
              </div>
            </Collapsible>
          ) : null}
          {config.fields.map((field) => (
            <Fragment key={field.kind === 'recurrence' ? 'recurrence' : field.name}>{renderField(field)}</Fragment>
          ))}
          {asksScope ? (
            <Collapsible open={showScope}>
              <ScopeChoice value={scope} onChange={setScope} disabled={disabled} />
            </Collapsible>
          ) : null}
          {fixed ? renderFixedSection(fixed) : null}
          {onDelete ? (
            <>
              <div className="border-t border-border" />
              <button
                ref={deleteRowRef}
                type="button"
                onClick={() => {
                  if (asksScope) setStep('confirmDelete')
                  else void handleDelete(null)
                }}
                disabled={disabled}
                className="flex min-h-row items-center gap-3 px-inset text-body-lg font-medium text-destructive-ink hover:bg-destructive/[0.08] active:bg-destructive/[0.12] disabled:pointer-events-none disabled:opacity-50"
              >
                {status === 'deleting' ? (
                  <Loader2 aria-hidden className="size-5 animate-spin" />
                ) : (
                  <Trash2 aria-hidden className="size-5" />
                )}
                {t(config.deleteKey)}
              </button>
            </>
          ) : null}
            </>
          )}
        </Drawer.Content>
      </form>
    </SheetShell>
  )
}
