import { Fragment, useEffect, useId, useRef, useState, type FormEvent, type RefObject } from 'react'
import { Drawer } from '@base-ui/react/drawer'
import { Loader2, Trash2 } from 'lucide-react'
import { useFormatter, useLocale, useTranslations } from 'next-intl'
import { currencyFormatOptions } from '@/i18n/formats'
import { CategoryDot } from '@/components/atoms/category-dot'
import { Collapsible } from '@/components/atoms/collapsible'
import { Switch } from '@/components/atoms/switch'
import { AmountField, parseAmount } from '@/components/molecules/amount-field'
import { FieldRow } from '@/components/molecules/field-row'
import { IntegerField, parseInteger } from '@/components/molecules/integer-field'
import { SheetShell } from '@/components/organisms/sheet-shell'
import { cn } from '@/lib/utils'
import type { CategoryColor } from '@/lib/data/dashboard'
import type { ExpenseDraft, LocalDate } from '@/lib/data/expenses'
import type { RecurringDraft } from '@/lib/data/recurring'
import type esMessages from '@/messages/es.json'

type FieldKind = 'amount' | 'text' | 'date'
type HojaGastoKey = keyof typeof esMessages.hojaGasto

export type TextFieldDescriptor<V> = {
  name: keyof V & string
  kind: FieldKind
  labelKey: HojaGastoKey
  placeholderKey?: HojaGastoKey
  optional?: boolean
}

/** The switch plus its revealed day/ending/count block (D3) — one composite kind, not three
 * descriptors, because the three validate and read from each other as one unit. Renders in
 * create mode only, and only when the sheet is given `onSaveRecurrence`. */
export type RecurrenceFieldDescriptor = { kind: 'recurrence' }

export type FieldDescriptor<V> = TextFieldDescriptor<V> | RecurrenceFieldDescriptor

export type EntryConfig<V> = {
  fields: FieldDescriptor<V>[]
  initialFocus: keyof V & string
  titleKeys: { create: HojaGastoKey; edit: HojaGastoKey }
  submitKeys: { create: HojaGastoKey; edit: HojaGastoKey }
  deleteKey: HojaGastoKey
}

export const expenseEntry: EntryConfig<ExpenseDraft> = {
  fields: [
    { name: 'amount', kind: 'amount', labelKey: 'importe' },
    { name: 'description', kind: 'text', labelKey: 'descripcion', placeholderKey: 'opcional', optional: true },
    { name: 'date', kind: 'date', labelKey: 'fecha' },
    { kind: 'recurrence' },
  ],
  initialFocus: 'amount',
  titleKeys: { create: 'nuevoGasto', edit: 'editarGasto' },
  submitKeys: { create: 'anadir', edit: 'guardar' },
  deleteKey: 'eliminarGasto',
}

type EntrySheetContext = { kind: 'category'; name: string; color: CategoryColor; recurring: boolean }

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
  onSave: (values: V) => Promise<void>
  onDelete?: () => Promise<void>
  /**
   * Present only when the page supplies `actions.recurring` — its presence, together with
   * `mode === 'create'`, is what makes the recurrence field render at all. Called after `onSave`
   * resolves, only when the switch is on; `onSave` still runs the ordinary create either way.
   */
  onSaveRecurrence?: (draft: RecurringDraft) => Promise<void>
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
    else result[field.name] = state[field.name]
  }
  return result as V
}

const RECURRENCE_ENDINGS = ['none', 'count'] as const
type RecurrenceEnding = (typeof RECURRENCE_ENDINGS)[number]

function isTextField<V>(field: FieldDescriptor<V>): field is TextFieldDescriptor<V> {
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
  onSaveRecurrence,
}: EntrySheetProps<V>) {
  const t = useTranslations('hojaGasto')
  const tRecurrente = useTranslations('gastoRecurrente')
  const format = useFormatter()
  const locale = useLocale()

  const formId = useId()

  const [wasOpen, setWasOpen] = useState(open)
  const [fieldState, setFieldState] = useState<FieldState>(() => buildFieldState(config, initialValues, locale))
  const [initialSnapshot, setInitialSnapshot] = useState<FieldState>(fieldState)
  const [touched, setTouched] = useState<Partial<Record<string, boolean>>>({})
  const [status, setStatus] = useState<'idle' | 'saving' | 'deleting'>('idle')
  const [error, setError] = useState<'save' | 'delete' | null>(null)

  const [recurrenceOn, setRecurrenceOn] = useState(false)
  const [recurrenceDay, setRecurrenceDay] = useState('')
  const [recurrenceEnding, setRecurrenceEnding] = useState<RecurrenceEnding>('none')
  const [recurrenceCount, setRecurrenceCount] = useState('')
  const [recurrenceTouched, setRecurrenceTouched] = useState<{ day?: boolean; count?: boolean }>({})
  const recurrenceCountRef = useRef<HTMLInputElement | null>(null)

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
    }
  }

  const amountFieldDescriptor = config.fields.find(
    (field): field is TextFieldDescriptor<V> & { kind: 'amount' } => field.kind === 'amount',
  )
  const amountValue = amountFieldDescriptor ? parseAmount(fieldState[amountFieldDescriptor.name] ?? '') : 0
  const isDirty = config.fields.filter(isTextField).some((field) => fieldState[field.name] !== initialSnapshot[field.name])
  const disabled = status !== 'idle'

  const recurrenceDayValid = parseInteger(recurrenceDay, { min: 1, max: 31 }) !== null
  const recurrenceCountValid = recurrenceEnding !== 'count' || parseInteger(recurrenceCount, { min: 1 }) !== null
  const recurrenceValid = !recurrenceOn || (recurrenceDayValid && recurrenceCountValid)

  const primaryDisabled = disabled || (amountFieldDescriptor ? amountValue === null : false) || !recurrenceValid

  function updateField(name: string, value: string) {
    setFieldState((prev) => ({ ...prev, [name]: value }))
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (amountFieldDescriptor && amountValue === null) {
      setTouched((prev) => ({ ...prev, [amountFieldDescriptor.name]: true }))
      return
    }
    if (recurrenceOn && !recurrenceValid) {
      setRecurrenceTouched({ day: true, count: recurrenceEnding === 'count' })
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
      await onSave(values)
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

  async function handleDelete() {
    if (!onDelete) return
    setStatus('deleting')
    setError(null)
    try {
      await onDelete()
    } catch {
      setStatus('idle')
      setError('delete')
    }
  }

  function handleDateClick(event: React.MouseEvent<HTMLInputElement>) {
    try {
      ;(event.currentTarget as HTMLInputElement & { showPicker?: () => void }).showPicker?.()
    } catch {}
  }

  function renderRecurrenceField() {
    if (mode !== 'create' || !onSaveRecurrence) return null

    const switchId = `${formId}-recurrence-switch`
    const dayId = `${formId}-recurrence-day`
    const countId = `${formId}-recurrence-count`
    const dayInvalid = Boolean(recurrenceTouched.day) && !recurrenceDayValid
    const countInvalid = recurrenceEnding === 'count' && Boolean(recurrenceTouched.count) && !recurrenceCountValid
    const amountText = format.number(amountValue ?? 0, { ...currencyFormatOptions, currency: fieldOptions.amount?.currency ?? 'EUR' })

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
            {tRecurrente('explicacion', { dia: recurrenceDay || '—', monto: amountText, categoria: context.name })}
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
      const invalid = Boolean(touched[field.name]) && value.trim() !== '' && parseAmount(value) === null
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
            if (field.name === config.initialFocus) initialFocusRef.current = el
          }}
          disabled={disabled}
          invalid={invalid}
          invalidMessage={t('importeInvalido')}
        />
      )
    }

    if (field.kind === 'text') {
      return (
        <FieldRow label={t(field.labelKey)} htmlFor={id}>
          <input
            id={id}
            type="text"
            data-base-ui-swipe-ignore
            enterKeyHint="done"
            autoCapitalize="sentences"
            readOnly={disabled}
            placeholder={field.placeholderKey ? t(field.placeholderKey) : undefined}
            value={value}
            onChange={(event) => updateField(field.name, event.target.value)}
            className="field-focus w-40 rounded-lg bg-muted px-2 py-1.5 text-right text-body-lg text-foreground placeholder:text-muted-foreground outline-none"
          />
        </FieldRow>
      )
    }

    return (
      <FieldRow label={t(field.labelKey)} htmlFor={id}>
        <div className="relative">
          <span aria-hidden className="block rounded-lg bg-muted px-2 py-1.5 text-body-lg text-foreground">
            {value ? format.dateTime(new Date(`${value}T00:00:00Z`), { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }) : ''}
          </span>
          <input
            id={id}
            type="date"
            required
            data-base-ui-swipe-ignore
            min={fieldOptions.date?.min}
            max={fieldOptions.date?.max}
            readOnly={disabled}
            value={value}
            onChange={(event) => updateField(field.name, event.target.value)}
            onClick={handleDateClick}
            className={cn('absolute inset-0 cursor-pointer opacity-0', disabled && 'pointer-events-none')}
          />
        </div>
      </FieldRow>
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
          className="pressable text-body-md text-muted-foreground disabled:pointer-events-none disabled:opacity-50"
        >
          {t('cancelar')}
        </Drawer.Close>
      }
      title={title}
      trailing={
        <button
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
      }
      caption={
        <>
          <CategoryDot color={context.color} className="size-2 shrink-0" />
          <span className="truncate">{context.recurring ? t('soloEsteMes', { categoria: context.name }) : context.name}</span>
        </>
      }
    >
      <form id={formId} onSubmit={handleSubmit} aria-busy={disabled} className="flex min-h-0 flex-1 flex-col">
        {/* `pb-4` keeps the last row off the panel's bottom edge and gives the keyboard-aware
            scroll something to scroll into, so a field focused at the very bottom — the revealed
            "número de pagos" in particular — settles clear of the edge rather than flush against it. */}
        <Drawer.Content className="flex flex-1 flex-col overflow-y-auto overscroll-contain pb-4">
          {error ? (
            <div role="alert" className="mx-inset mt-3 rounded-inner bg-destructive/[0.08] px-4 py-3 text-body-md text-destructive-ink">
              {t(error === 'save' ? 'errorGuardar' : 'errorEliminar')}
            </div>
          ) : null}
          {config.fields.map((field) => (
            <Fragment key={field.kind === 'recurrence' ? 'recurrence' : field.name}>{renderField(field)}</Fragment>
          ))}
          {onDelete ? (
            <>
              <div className="border-t border-border" />
              <button
                type="button"
                onClick={() => void handleDelete()}
                disabled={disabled}
                className="flex min-h-row items-center gap-3 px-inset text-body-lg font-medium text-destructive-ink hover:bg-destructive/[0.08] active:bg-destructive/[0.12] disabled:pointer-events-none disabled:opacity-50"
              >
                {status === 'deleting' ? (
                  <Loader2 aria-hidden className="size-5 animate-spin" />
                ) : (
                  <Trash2 aria-hidden className="size-5" />
                )}
                {t(context.recurring ? 'eliminarCargoDelMes' : config.deleteKey)}
              </button>
            </>
          ) : null}
        </Drawer.Content>
      </form>
    </SheetShell>
  )
}
