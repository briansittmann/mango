import { Fragment, useId, useState, type FormEvent, type RefObject } from 'react'
import { Drawer } from '@base-ui/react/drawer'
import { Loader2, Trash2 } from 'lucide-react'
import { useFormatter, useLocale, useTranslations } from 'next-intl'
import { CategoryDot } from '@/components/atoms/category-dot'
import { AmountField, parseAmount } from '@/components/molecules/amount-field'
import { FieldRow } from '@/components/molecules/field-row'
import { SheetShell } from '@/components/organisms/sheet-shell'
import { cn } from '@/lib/utils'
import type { CategoryColor } from '@/lib/data/dashboard'
import type { ExpenseDraft, LocalDate } from '@/lib/data/expenses'
import type esMessages from '@/messages/es.json'

type FieldKind = 'amount' | 'text' | 'date'
type HojaGastoKey = keyof typeof esMessages.hojaGasto

export type FieldDescriptor<V> = {
  name: keyof V & string
  kind: FieldKind
  labelKey: HojaGastoKey
  placeholderKey?: HojaGastoKey
  optional?: boolean
}

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
  ],
  initialFocus: 'amount',
  titleKeys: { create: 'nuevoGasto', edit: 'editarGasto' },
  submitKeys: { create: 'anadir', edit: 'guardar' },
  deleteKey: 'eliminarGasto',
}

type EntrySheetContext = { kind: 'category'; name: string; color: CategoryColor } | { kind: 'fixedCharge' }

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
    if (field.kind === 'amount') result[field.name] = amount
    else if (field.kind === 'text') result[field.name] = state[field.name].trim()
    else result[field.name] = state[field.name]
  }
  return result as V
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
}: EntrySheetProps<V>) {
  const t = useTranslations('hojaGasto')
  const format = useFormatter()
  const locale = useLocale()

  const formId = useId()

  const [wasOpen, setWasOpen] = useState(open)
  const [fieldState, setFieldState] = useState<FieldState>(() => buildFieldState(config, initialValues, locale))
  const [initialSnapshot, setInitialSnapshot] = useState<FieldState>(fieldState)
  const [touched, setTouched] = useState<Partial<Record<string, boolean>>>({})
  const [status, setStatus] = useState<'idle' | 'saving' | 'deleting'>('idle')
  const [error, setError] = useState<'save' | 'delete' | null>(null)

  if (open !== wasOpen) {
    setWasOpen(open)
    if (open) {
      const next = buildFieldState(config, initialValues, locale)
      setFieldState(next)
      setInitialSnapshot(next)
      setTouched({})
      setStatus('idle')
      setError(null)
    }
  }

  const amountField = config.fields.find((field) => field.kind === 'amount')
  const amountValue = amountField ? parseAmount(fieldState[amountField.name] ?? '') : 0
  const isDirty = config.fields.some((field) => fieldState[field.name] !== initialSnapshot[field.name])
  const disabled = status !== 'idle'
  const primaryDisabled = disabled || (amountField ? amountValue === null : false)

  function updateField(name: string, value: string) {
    setFieldState((prev) => ({ ...prev, [name]: value }))
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (amountField && amountValue === null) {
      setTouched((prev) => ({ ...prev, [amountField.name]: true }))
      return
    }
    const values = buildValues(config, fieldState, amountValue ?? 0)
    setStatus('saving')
    setError(null)
    try {
      await onSave(values)
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

  function renderField(field: FieldDescriptor<V>) {
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
            className="w-40 rounded-lg bg-muted px-2 py-1.5 text-right text-body-lg text-foreground placeholder:text-muted-foreground outline-none"
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
        context.kind === 'category' ? (
          <>
            <CategoryDot color={context.color} className="size-2 shrink-0" />
            <span className="truncate">{context.name}</span>
          </>
        ) : (
          t('soloEsteMes')
        )
      }
    >
      <form id={formId} onSubmit={handleSubmit} aria-busy={disabled} className="flex min-h-0 flex-1 flex-col">
        <Drawer.Content className="flex flex-1 flex-col overflow-y-auto overscroll-contain">
          {error ? (
            <div role="alert" className="mx-inset mt-3 rounded-inner bg-destructive/[0.08] px-4 py-3 text-body-md text-destructive-ink">
              {t(error === 'save' ? 'errorGuardar' : 'errorEliminar')}
            </div>
          ) : null}
          {config.fields.map((field) => (
            <Fragment key={field.name}>{renderField(field)}</Fragment>
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
                {t(context.kind === 'fixedCharge' ? 'eliminarCargoDelMes' : config.deleteKey)}
              </button>
            </>
          ) : null}
        </Drawer.Content>
      </form>
    </SheetShell>
  )
}
