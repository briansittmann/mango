import { useId, useLayoutEffect, useRef, useState, type FormEvent } from 'react'
import { Ban, Loader2, Trash2 } from 'lucide-react'
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
import type { RecurringDefinition, RecurringDraft } from '@/lib/data/recurring'

type RecurringSheetProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Values come from the "Próximos cobros" row that opened it. */
  target: RecurringDefinition
  /** "Categoría" is read-only here (D-note carried from task 4.3): `RecurringDraft` has no
   * `categoryId`, and moving a definition's already-produced charge to another category's card
   * is a reconciliation no task exercises — deferred rather than half-built. */
  categoryName: string
  categoryColor: CategoryColor
  currency: string
  /** This cycle's actual charge amount, shown alongside the expected one when they differ (E.3). */
  currentAmount: number
  onSave: (definitionId: string, draft: RecurringDraft) => Promise<void>
  onStop: (definitionId: string) => Promise<void>
  onDelete: (definitionId: string) => Promise<void>
}

type Step = 'form' | 'confirmDelete'
type FieldState = { name: string; expectedAmount: string; day: string; reminderActive: boolean; reminderDaysBefore: string }

function formatAmountForEdit(amount: number, locale: string): string {
  return new Intl.NumberFormat(locale, {
    minimumFractionDigits: 2,
    trailingZeroDisplay: 'stripIfInteger',
    useGrouping: false,
  }).format(amount)
}

function buildFieldState(target: RecurringDefinition, locale: string): FieldState {
  return {
    name: target.name,
    expectedAmount: formatAmountForEdit(target.expectedAmount, locale),
    day: String(target.day),
    reminderActive: target.reminder.active,
    reminderDaysBefore: String(target.reminder.daysBefore),
  }
}

export function RecurringSheet({
  open,
  onOpenChange,
  target,
  categoryName,
  categoryColor,
  currency,
  currentAmount,
  onSave,
  onStop,
  onDelete,
}: RecurringSheetProps) {
  const t = useTranslations('gastoRecurrente')
  const locale = useLocale()
  const format = useFormatter()
  const formId = useId()
  const confirmHeadingRef = useRef<HTMLHeadingElement>(null)
  const deleteRowRef = useRef<HTMLButtonElement>(null)

  const [wasOpen, setWasOpen] = useState(open)
  const [step, setStep] = useState<Step>('form')
  const [fieldState, setFieldState] = useState<FieldState>(() => buildFieldState(target, locale))
  const [initialSnapshot, setInitialSnapshot] = useState(fieldState)
  const [nameTouched, setNameTouched] = useState(false)
  const [amountTouched, setAmountTouched] = useState(false)
  const [dayTouched, setDayTouched] = useState(false)
  const [daysBeforeTouched, setDaysBeforeTouched] = useState(false)
  const [status, setStatus] = useState<'idle' | 'saving' | 'stopping' | 'deleting'>('idle')
  const [error, setError] = useState<'save' | 'stop' | 'delete' | null>(null)

  if (open !== wasOpen) {
    setWasOpen(open)
    if (open) {
      const next = buildFieldState(target, locale)
      setFieldState(next)
      setInitialSnapshot(next)
      setNameTouched(false)
      setAmountTouched(false)
      setDayTouched(false)
      setDaysBeforeTouched(false)
      setStatus('idle')
      setError(null)
      setStep('form')
    }
  }

  useLayoutEffect(() => {
    if (step === 'confirmDelete') confirmHeadingRef.current?.focus()
  }, [step])

  const nameValid = fieldState.name.trim() !== ''
  const amountParsed = parseAmount(fieldState.expectedAmount)
  const amountValid = amountParsed !== null
  const dayParsed = parseInteger(fieldState.day, { min: 1, max: 31 })
  const dayValid = dayParsed !== null
  const daysBeforeParsed = parseInteger(fieldState.reminderDaysBefore, { min: 0 })
  const daysBeforeValid = !fieldState.reminderActive || daysBeforeParsed !== null
  const isDirty =
    fieldState.name !== initialSnapshot.name ||
    fieldState.expectedAmount !== initialSnapshot.expectedAmount ||
    fieldState.day !== initialSnapshot.day ||
    fieldState.reminderActive !== initialSnapshot.reminderActive ||
    fieldState.reminderDaysBefore !== initialSnapshot.reminderDaysBefore
  const busy = status !== 'idle'
  const primaryDisabled = busy || !nameValid || !amountValid || !dayValid || !daysBeforeValid

  function updateField<K extends keyof FieldState>(key: K, value: FieldState[K]) {
    setFieldState((prev) => ({ ...prev, [key]: value }))
  }

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!nameValid) {
      setNameTouched(true)
      return
    }
    if (!amountValid) {
      setAmountTouched(true)
      return
    }
    if (!dayValid) {
      setDayTouched(true)
      return
    }
    if (!daysBeforeValid) {
      setDaysBeforeTouched(true)
      return
    }
    setStatus('saving')
    setError(null)
    try {
      await onSave(target.id, {
        name: fieldState.name.trim(),
        expectedAmount: amountParsed,
        day: dayParsed,
        reminder: {
          active: fieldState.reminderActive,
          daysBefore: fieldState.reminderActive ? (daysBeforeParsed ?? target.reminder.daysBefore) : target.reminder.daysBefore,
        },
        // The sheet never edits repetitions (task 3.1's note) — passed through unchanged.
        repetitions: target.repetitions ? target.repetitions.total : null,
      })
    } catch {
      setStatus('idle')
      setError('save')
    }
  }

  async function handleStop() {
    setStatus('stopping')
    setError(null)
    try {
      await onStop(target.id)
    } catch {
      setStatus('idle')
      setError('stop')
    }
  }

  function openConfirmDelete() {
    setError(null)
    setStep('confirmDelete')
  }

  function cancelConfirmDelete() {
    setStep('form')
    deleteRowRef.current?.focus()
  }

  async function handleConfirmDelete() {
    setStatus('deleting')
    setError(null)
    try {
      await onDelete(target.id)
    } catch {
      setStatus('idle')
      setError('delete')
    }
  }

  const title = fieldState.name.trim() || target.name
  const nameId = `${formId}-name`
  const amountId = `${formId}-amount`
  const dayId = `${formId}-day`
  const reminderSwitchId = `${formId}-reminder-switch`
  const daysBeforeId = `${formId}-days-before`

  const currentAmountDiffers = currentAmount !== target.expectedAmount
  const currentAmountText = format.number(currentAmount, { ...currencyFormatOptions, currency })

  // Pending total (proposal §C): how many charges this instalment plan has left and what they add
  // up to at the amount currently typed — live, before saving. Absent for an open-ended definition.
  const remainingCount = target.repetitions ? target.repetitions.total - target.repetitions.done : null
  const remainingAmountText =
    remainingCount != null
      ? format.number(remainingCount * (amountParsed ?? target.expectedAmount), { ...currencyFormatOptions, currency })
      : null

  return (
    <SheetShell
      open={open}
      onOpenChange={onOpenChange}
      busy={busy}
      isDirty={isDirty}
      initialFocus={false}
      anchored
      leading={
        <button
          type="button"
          disabled={busy}
          onClick={() => onOpenChange(false)}
          className="pressable text-body-md text-muted-foreground disabled:pointer-events-none disabled:opacity-50"
        >
          {t('cancelar')}
        </button>
      }
      title={title}
      trailing={
        step === 'form' ? (
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
                <span className="sr-only">{t('guardar')}</span>
              </>
            ) : (
              t('guardar')
            )}
          </button>
        ) : (
          <button
            type="button"
            disabled={busy}
            onClick={cancelConfirmDelete}
            className="pressable text-body-md text-muted-foreground disabled:pointer-events-none disabled:opacity-50"
          >
            {t('cancelar')}
          </button>
        )
      }
      caption={t('seRepiteDia', { dia: dayParsed ?? target.day })}
    >
      {step === 'form' ? (
        <form
          id={formId}
          onSubmit={handleSave}
          aria-busy={busy}
          className="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain"
        >
          {error ? (
            <div role="alert" className="mx-inset mt-3 rounded-inner bg-destructive/[0.08] px-4 py-3 text-body-md text-destructive-ink">
              {t(error === 'save' ? 'errorGuardar' : 'errorEliminar')}
            </div>
          ) : null}

          <FieldRow label={t('nombre')} htmlFor={nameId}>
            <input
              id={nameId}
              type="text"
              data-base-ui-swipe-ignore
              enterKeyHint="done"
              autoCapitalize="sentences"
              readOnly={busy}
              aria-invalid={(nameTouched && !nameValid) || undefined}
              value={fieldState.name}
              onChange={(event) => updateField('name', event.target.value)}
              onBlur={() => setNameTouched(true)}
              className="w-40 rounded-lg bg-muted px-2 py-1.5 text-right text-body-lg text-foreground outline-none"
            />
          </FieldRow>

          <AmountField
            id={amountId}
            label={t('montoEsperado')}
            currency={currency}
            value={fieldState.expectedAmount}
            onChange={(next) => updateField('expectedAmount', next)}
            onBlur={() => setAmountTouched(true)}
            disabled={busy}
            invalid={amountTouched && !amountValid}
            invalidMessage={t('montoInvalido')}
          />
          <p className="px-inset pb-3 text-body-sm text-muted-foreground">
            {t('montoEsperadoAyuda')}
            {currentAmountDiffers ? ` ${t('montoEsteMes', { monto: currentAmountText })}` : ''}
          </p>
          {remainingCount != null && remainingAmountText != null ? (
            <p className="px-inset pb-3 text-body-sm text-muted-foreground">
              {t('pagosRestantes', { pagos: remainingCount, monto: remainingAmountText })}
            </p>
          ) : null}

          <IntegerField
            id={dayId}
            label={t('diaDelMes')}
            value={fieldState.day}
            onChange={(next) => updateField('day', next)}
            onBlur={() => setDayTouched(true)}
            disabled={busy}
            invalid={dayTouched && !dayValid}
            invalidMessage={t('diaInvalido')}
            maxLength={2}
          />

          <div className="relative flex min-h-row items-center gap-3 px-inset before:absolute before:left-4 before:right-0 before:top-0 before:h-px before:bg-border">
            <span className="flex-1 text-body-lg text-foreground">{t('categoria')}</span>
            <span className="flex items-center gap-2 text-body-lg text-muted-foreground">
              <CategoryDot color={categoryColor} className="size-2 shrink-0" />
              {categoryName}
            </span>
          </div>

          <FieldRow label={t('recordatorio')} htmlFor={reminderSwitchId}>
            <Switch
              id={reminderSwitchId}
              checked={fieldState.reminderActive}
              onCheckedChange={(next) => updateField('reminderActive', next)}
              disabled={busy}
            />
          </FieldRow>
          <Collapsible open={fieldState.reminderActive}>
            <IntegerField
              id={daysBeforeId}
              label={t('diasAntes')}
              value={fieldState.reminderDaysBefore}
              onChange={(next) => updateField('reminderDaysBefore', next)}
              onBlur={() => setDaysBeforeTouched(true)}
              disabled={busy}
              invalid={daysBeforeTouched && !daysBeforeValid}
              invalidMessage={t('diasAntesInvalido')}
              maxLength={2}
            />
          </Collapsible>

          <div className="border-t border-border" />
          <button
            type="button"
            onClick={() => void handleStop()}
            disabled={busy}
            className="flex min-h-row items-center gap-3 px-inset text-body-lg font-medium text-foreground hover:bg-muted active:bg-muted disabled:pointer-events-none disabled:opacity-50"
          >
            {status === 'stopping' ? <Loader2 aria-hidden className="size-5 animate-spin" /> : <Ban aria-hidden className="size-5" />}
            {t('dejarDeRepetir')}
          </button>

          <div className="border-t border-border" />
          <button
            ref={deleteRowRef}
            type="button"
            onClick={openConfirmDelete}
            disabled={busy}
            className="flex min-h-row items-center gap-3 px-inset text-body-lg font-medium text-destructive-ink hover:bg-destructive/[0.08] active:bg-destructive/[0.12] disabled:pointer-events-none disabled:opacity-50"
          >
            <Trash2 aria-hidden className="size-5" />
            {t('eliminarYBorrarHistorial')}
          </button>
        </form>
      ) : (
        <div aria-busy={busy} className="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain">
          {error ? (
            <div role="alert" className="mx-inset mt-3 rounded-inner bg-destructive/[0.08] px-4 py-3 text-body-md text-destructive-ink">
              {t('errorEliminar')}
            </div>
          ) : null}
          <h3 ref={confirmHeadingRef} tabIndex={-1} className="px-inset pb-4 pt-3 text-body-lg text-foreground outline-none">
            {t('confirmarEliminar', { nombre: target.name })}
          </h3>
          <div className="mt-auto px-inset pb-4 pt-3">
            <button
              type="button"
              onClick={() => void handleConfirmDelete()}
              disabled={busy}
              className="flex min-h-row w-full items-center justify-center gap-2 rounded-full bg-destructive/[0.08] text-body-lg font-semibold text-destructive-ink disabled:pointer-events-none disabled:opacity-50"
            >
              {status === 'deleting' ? <Loader2 aria-hidden className="size-5 animate-spin" /> : <Trash2 aria-hidden className="size-5" />}
              {t('eliminar')}
            </button>
          </div>
        </div>
      )}
    </SheetShell>
  )
}
