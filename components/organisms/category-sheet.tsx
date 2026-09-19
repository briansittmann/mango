import { useId, useLayoutEffect, useRef, useState, type FormEvent } from 'react'
import { ArrowUpDown, Loader2, Trash2 } from 'lucide-react'
import { useLocale, useTranslations } from 'next-intl'
import { CategoryDot } from '@/components/atoms/category-dot'
import { AmountField, parseAmount } from '@/components/molecules/amount-field'
import { ColorSwatchPicker } from '@/components/molecules/color-swatch-picker'
import { FieldRow } from '@/components/molecules/field-row'
import { SheetShell } from '@/components/organisms/sheet-shell'
import { cn } from '@/lib/utils'
import type { CategoryDraft, DUPLICATE_CATEGORY_NAME as DuplicateCategoryNameMessage } from '@/lib/data/categories'
import type { CategoryColor, ExpenseGroup } from '@/lib/data/dashboard'

/** Mirrors `DUPLICATE_CATEGORY_NAME` (`lib/data/categories.ts`) without a runtime import across the data-layer boundary. */
const DUPLICATE_CATEGORY_NAME: typeof DuplicateCategoryNameMessage = 'duplicate-category-name'

type CategorySheetProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Values come from the card that opened the sheet, per §"Opening". */
  target: ExpenseGroup
  currency: string
  receivingCategories: { id: string; name: string }[]
  onSave: (categoryId: string, draft: CategoryDraft) => Promise<void>
  onDelete: (categoryId: string, reassignTo: string | null) => Promise<void>
  /** Turns reorder mode on for the whole screen. Absent when the page supplies no reorder operation. */
  onReorder?: () => void
}

type Step = 'form' | 'confirmDelete'
type FieldState = { name: string; color: CategoryColor; budget: string }

function formatBudgetForEdit(amount: number, locale: string): string {
  return new Intl.NumberFormat(locale, {
    minimumFractionDigits: 2,
    trailingZeroDisplay: 'stripIfInteger',
    useGrouping: false,
  }).format(amount)
}

function buildFieldState(target: ExpenseGroup, locale: string): FieldState {
  return {
    name: target.name ?? '',
    color: target.color,
    budget: target.budget ? formatBudgetForEdit(target.budget.amount, locale) : '',
  }
}

export function CategorySheet({
  open,
  onOpenChange,
  target,
  currency,
  receivingCategories,
  onSave,
  onDelete,
  onReorder,
}: CategorySheetProps) {
  const t = useTranslations('hojaCategoria')
  const tReorder = useTranslations('modoReordenar')
  const locale = useLocale()
  const formId = useId()
  const confirmHeadingRef = useRef<HTMLHeadingElement>(null)
  const deleteRowRef = useRef<HTMLButtonElement>(null)

  const [wasOpen, setWasOpen] = useState(open)
  const [step, setStep] = useState<Step>('form')
  const [fieldState, setFieldState] = useState<FieldState>(() => buildFieldState(target, locale))
  const [initialSnapshot, setInitialSnapshot] = useState(fieldState)
  const [nameTouched, setNameTouched] = useState(false)
  const [budgetTouched, setBudgetTouched] = useState(false)
  const [status, setStatus] = useState<'idle' | 'saving' | 'deleting'>('idle')
  const [error, setError] = useState<'save' | 'delete' | null>(null)
  const [nameError, setNameError] = useState(false)
  const [reassignTo, setReassignTo] = useState<string | null>(null)

  if (open !== wasOpen) {
    setWasOpen(open)
    if (open) {
      const next = buildFieldState(target, locale)
      setFieldState(next)
      setInitialSnapshot(next)
      setNameTouched(false)
      setBudgetTouched(false)
      setStatus('idle')
      setError(null)
      setNameError(false)
      setStep('form')
      setReassignTo(null)
    }
  }

  useLayoutEffect(() => {
    if (step === 'confirmDelete') confirmHeadingRef.current?.focus()
  }, [step])

  const expenseCount = target.expenses.length
  const nameValid = fieldState.name.trim() !== ''
  const budgetParsed = fieldState.budget.trim() === '' ? null : parseAmount(fieldState.budget)
  const budgetValid = fieldState.budget.trim() === '' || budgetParsed !== null
  const isDirty =
    fieldState.name !== initialSnapshot.name ||
    fieldState.color !== initialSnapshot.color ||
    fieldState.budget !== initialSnapshot.budget
  const busy = status !== 'idle'
  const primaryDisabled = busy || !nameValid || !budgetValid
  const deleteDisabled = busy || (expenseCount > 0 && !reassignTo)
  // `receivingCategories` is every category but this one, so an empty list means this is the only one.
  const reorderDisabled = busy || !onReorder || receivingCategories.length === 0

  function updateField<K extends keyof FieldState>(key: K, value: FieldState[K]) {
    setFieldState((prev) => ({ ...prev, [key]: value }))
  }

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!nameValid) {
      setNameTouched(true)
      return
    }
    if (!budgetValid) {
      setBudgetTouched(true)
      return
    }
    setStatus('saving')
    setError(null)
    setNameError(false)
    try {
      await onSave(target.id, { name: fieldState.name.trim(), color: fieldState.color, budget: budgetParsed })
    } catch (err) {
      setStatus('idle')
      if (err instanceof Error && err.message === DUPLICATE_CATEGORY_NAME) setNameError(true)
      else setError('save')
    }
  }

  function openConfirmDelete() {
    const otros = receivingCategories.find((category) => category.name === 'Otros')
    setReassignTo(expenseCount > 0 ? (otros?.id ?? null) : null)
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
      await onDelete(target.id, expenseCount > 0 ? reassignTo : null)
    } catch {
      setStatus('idle')
      setError('delete')
    }
  }

  const title = fieldState.name.trim() || (target.name ?? '')
  const nameId = `${formId}-name`
  const budgetId = `${formId}-budget`
  const colorsLabelId = `${formId}-colors-label`
  const reassignId = `${formId}-reassign`

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
      caption={
        <>
          <CategoryDot color={fieldState.color} className="size-2 shrink-0" />
          <span className="truncate">{title}</span>
        </>
      }
    >
      {step === 'form' ? (
        <form
          id={formId}
          onSubmit={handleSave}
          aria-busy={busy}
          className="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain pb-4"
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
              aria-invalid={nameError || (nameTouched && !nameValid) || undefined}
              aria-describedby={nameError ? `${nameId}-error` : undefined}
              value={fieldState.name}
              onChange={(event) => {
                updateField('name', event.target.value)
                setNameError(false)
              }}
              onBlur={() => setNameTouched(true)}
              className="w-40 rounded-lg bg-muted px-2 py-1.5 text-right text-body-lg text-foreground outline-none"
            />
          </FieldRow>
          {nameError ? (
            <p id={`${nameId}-error`} role="alert" className="px-inset pb-2 text-body-sm text-destructive-ink">
              {t('nombreDuplicado')}
            </p>
          ) : null}

          <AmountField
            id={budgetId}
            label={t('presupuesto')}
            currency={currency}
            value={fieldState.budget}
            onChange={(next) => updateField('budget', next)}
            onBlur={() => setBudgetTouched(true)}
            disabled={busy}
            optional
            invalid={budgetTouched && !budgetValid}
            invalidMessage={t('presupuestoInvalido')}
          />

          <div className="flex min-h-row items-center px-inset">
            <span id={colorsLabelId} className="text-body-lg text-foreground">
              {t('color')}
            </span>
          </div>
          <div className="pb-2">
            <ColorSwatchPicker
              value={fieldState.color}
              onChange={(color) => updateField('color', color)}
              disabled={busy}
              labelledBy={colorsLabelId}
            />
          </div>

          <div className="border-t border-border" />
          <button
            type="button"
            aria-label={tReorder('titulo')}
            onClick={() => {
              onOpenChange(false)
              onReorder?.()
            }}
            disabled={reorderDisabled}
            className="flex min-h-row items-center gap-3 px-inset text-body-lg font-medium text-foreground hover:bg-muted active:bg-muted disabled:pointer-events-none disabled:opacity-50"
          >
            <ArrowUpDown aria-hidden className="size-5" />
            {t('reordenar')}
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
            {t('eliminarCategoria')}
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
            {t('confirmarEliminar', { categoria: target.name ?? '', count: expenseCount })}
          </h3>
          {expenseCount > 0 ? (
            <FieldRow label={t('categoriaDestino')} htmlFor={reassignId}>
              <select
                id={reassignId}
                value={reassignTo ?? ''}
                disabled={busy}
                onChange={(event) => setReassignTo(event.target.value || null)}
                className="min-h-11 rounded-lg bg-muted px-3 text-right text-body-lg text-foreground outline-none"
              >
                {reassignTo === null ? <option value="" disabled hidden /> : null}
                {receivingCategories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </FieldRow>
          ) : null}
          <div className="mt-auto px-inset pb-4 pt-3">
            <button
              type="button"
              onClick={() => void handleConfirmDelete()}
              disabled={deleteDisabled}
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
