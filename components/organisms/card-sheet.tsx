import { useId, useLayoutEffect, useRef, useState, type FormEvent, type RefObject } from 'react'
import { Checkbox } from '@base-ui/react/checkbox'
import { Check, Loader2, Trash2 } from 'lucide-react'
import { useLocale, useTranslations } from 'next-intl'
import { useAmountFormatter } from '@/components/atoms/amount-format'
import { CategoryDot } from '@/components/atoms/category-dot'
import { Money } from '@/components/atoms/money'
import { WalletCard } from '@/components/atoms/wallet-card'
import { ColorSwatchPicker } from '@/components/molecules/color-swatch-picker'
import { FieldRow } from '@/components/molecules/field-row'
import { SheetShell } from '@/components/organisms/sheet-shell'
import { cn } from '@/lib/utils'
import type { Card, CardDraft, DUPLICATE_CARD_NAME as DuplicateCardNameMessage } from '@/lib/data/cards'
import type { CategoryColor } from '@/lib/data/dashboard'
import type { RecurringDefinition } from '@/lib/data/recurring'

/** Mirrors `DUPLICATE_CARD_NAME` (`lib/data/cards.ts`) without a runtime import across the data-layer boundary. */
const DUPLICATE_CARD_NAME: typeof DuplicateCardNameMessage = 'duplicate-card-name'

const MAX_NAME = 30

type CardSheetProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** The card or the "Añadir tarjeta" row that opened it: the popover's anchor from `sm` to `lg`. */
  opener?: RefObject<HTMLElement | null>
  /** `null` opens it empty ("Nueva tarjeta"). */
  card: Card | null
  /** Every card of the user, to name the one another fixed charge is on ("En Débito"). */
  cards: Card[]
  /** The user's definitions; the checklist lists the active expenses among them. */
  definitions: RecurringDefinition[]
  currency: string
  /** Preselected colour for a new card: the first one no other card uses. */
  initialColor: CategoryColor
  /** What the card would carry in the shown cycle with exactly these fixed charges: the preview's total. */
  committedFor: (definitionIds: Set<string>) => { total: number; count: number }
  /** Resolves with the new card's id. */
  onCreate: (draft: CardDraft) => Promise<string>
  onUpdate: (cardId: string, draft: CardDraft) => Promise<void>
  onSetFixedCharges: (cardId: string, definitionIds: string[]) => Promise<void>
  onDelete: (cardId: string) => Promise<void>
  /** Called once everything changed is saved; the page closes the sheet and announces it. */
  onSaved: (created: boolean) => void
}

type Step = 'form' | 'confirmDelete'

function carriedBy(definitions: RecurringDefinition[], cardId: string | undefined): Set<string> {
  return new Set(cardId ? definitions.filter((d) => d.cardId === cardId).map((d) => d.id) : [])
}

function sameSet(a: Set<string>, b: Set<string>): boolean {
  return a.size === b.size && [...a].every((id) => b.has(id))
}

/**
 * The card sheet (`card-wallet` → *The card sheet*): a live preview, the name, the colour and the
 * active fixed expenses with a check each. "Guardar" writes the name and colour when they changed,
 * then the checklist when it changed (design D7).
 */
export function CardSheet({
  open,
  onOpenChange,
  opener,
  card,
  cards,
  definitions,
  currency,
  initialColor,
  committedFor,
  onCreate,
  onUpdate,
  onSetFixedCharges,
  onDelete,
  onSaved,
}: CardSheetProps) {
  const t = useTranslations('tarjetas')
  const locale = useLocale()
  const { money } = useAmountFormatter()
  const formId = useId()
  const nameRef = useRef<HTMLInputElement>(null)
  const deleteRowRef = useRef<HTMLButtonElement>(null)
  const confirmHeadingRef = useRef<HTMLHeadingElement>(null)
  // Back from the confirmation, focus returns to "Eliminar tarjeta" once the form is mounted again.
  const backFromConfirm = useRef(false)

  const fixedExpenses = definitions.filter((d) => d.tipo === 'gasto' && d.active).sort((a, b) => a.day - b.day)
  const initialName = card?.name ?? ''
  const initialColorOf = card?.color ?? initialColor

  const [wasOpen, setWasOpen] = useState(open)
  const [step, setStep] = useState<Step>('form')
  const [name, setName] = useState(initialName)
  const [color, setColor] = useState<CategoryColor>(initialColorOf)
  const [checked, setChecked] = useState(() => carriedBy(fixedExpenses, card?.id))
  const [initialChecked, setInitialChecked] = useState(checked)
  // A new card that saved but whose checklist failed: the next "Guardar" edits it instead of creating another.
  const [createdId, setCreatedId] = useState<string | null>(null)
  const [saved, setSaved] = useState<{ name: string; color: CategoryColor }>({ name: initialName, color: initialColorOf })
  const [nameTouched, setNameTouched] = useState(false)
  const [nameError, setNameError] = useState(false)
  const [status, setStatus] = useState<'idle' | 'saving' | 'deleting'>('idle')
  const [error, setError] = useState<'save' | 'delete' | null>(null)

  if (open !== wasOpen) {
    setWasOpen(open)
    if (open) {
      const carried = carriedBy(fixedExpenses, card?.id)
      setStep('form')
      setName(initialName)
      setColor(initialColorOf)
      setChecked(carried)
      setInitialChecked(carried)
      setCreatedId(null)
      setSaved({ name: initialName, color: initialColorOf })
      setNameTouched(false)
      setNameError(false)
      setStatus('idle')
      setError(null)
    }
  }

  useLayoutEffect(() => {
    if (step === 'confirmDelete') confirmHeadingRef.current?.focus()
    else if (backFromConfirm.current) {
      backFromConfirm.current = false
      deleteRowRef.current?.focus()
    }
  }, [step])

  const trimmed = name.trim()
  const nameValid = trimmed.length >= 1 && trimmed.length <= MAX_NAME
  const cardId = card?.id ?? createdId
  const fieldsDirty = cardId == null || trimmed !== saved.name || color !== saved.color
  const checklistDirty = !sameSet(checked, initialChecked)
  const isDirty = name !== initialName || color !== initialColorOf || checklistDirty
  const busy = status !== 'idle'
  const primaryDisabled = busy || !nameValid || !(fieldsDirty || checklistDirty)
  const preview = committedFor(checked)
  const cardName = (id: string | null) => cards.find((c) => c.id === id)?.name

  function toggle(definitionId: string, on: boolean) {
    setChecked((prev) => {
      const next = new Set(prev)
      if (on) next.add(definitionId)
      else next.delete(definitionId)
      return next
    })
  }

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!nameValid) {
      setNameTouched(true)
      return
    }
    setStatus('saving')
    setError(null)
    setNameError(false)
    const draft: CardDraft = { name: trimmed, color }
    let id = cardId
    try {
      if (id == null) {
        id = await onCreate(draft)
        setCreatedId(id)
        setSaved(draft)
      } else if (fieldsDirty) {
        await onUpdate(id, draft)
        setSaved(draft)
      }
      if (checklistDirty) {
        await onSetFixedCharges(id, [...checked])
        setInitialChecked(checked)
      }
      onSaved(card == null)
    } catch (err) {
      setStatus('idle')
      if (err instanceof Error && err.message === DUPLICATE_CARD_NAME) setNameError(true)
      else setError('save')
    }
  }

  async function handleConfirmDelete() {
    if (!card) return
    setStatus('deleting')
    setError(null)
    try {
      await onDelete(card.id)
    } catch {
      setStatus('idle')
      setError('delete')
    }
  }

  // Who the confirmation names (`card-wallet` → *Deleting a card frees its fixed charges*).
  const carried = card ? definitions.filter((d) => d.cardId === card.id) : []
  const freed =
    carried.length === 0
      ? null
      : carried.length <= 2
        ? t('quedanSinTarjeta', {
            nombres: new Intl.ListFormat(locale, { type: 'conjunction' }).format(carried.map((d) => d.name)),
            n: carried.length,
          })
        : t('fijosQuedanSinTarjeta', { n: carried.length })

  const nameId = `${formId}-name`
  const colorsLabelId = `${formId}-colors`
  const checklistLabelId = `${formId}-fixed`
  const title = card == null ? t('nuevaTarjeta') : trimmed || card.name

  return (
    <SheetShell
      open={open}
      onOpenChange={onOpenChange}
      busy={busy}
      isDirty={isDirty}
      initialFocus={card == null ? nameRef : false}
      anchored
      opener={opener}
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
      title={
        <span className="flex min-w-0 items-center justify-center gap-2">
          <CategoryDot color={color} className="size-2.5" />
          <span className="truncate">{title}</span>
        </span>
      }
      trailing={
        // Distinct keys: see the same header in entry-sheet.tsx.
        step === 'form' ? (
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
                <span className="sr-only">{t('guardar')}</span>
              </>
            ) : (
              t('guardar')
            )}
          </button>
        ) : (
          <button
            key="confirm-cancel"
            type="button"
            disabled={busy}
            onClick={() => {
              backFromConfirm.current = true
              setStep('form')
            }}
            className="pressable text-body-md text-muted-foreground disabled:pointer-events-none disabled:opacity-50"
          >
            {t('cancelar')}
          </button>
        )
      }
    >
      {step === 'form' ? (
        <form id={formId} onSubmit={handleSave} aria-busy={busy} className="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain pb-4">
          {error ? (
            <div role="alert" className="mx-inset mt-3 rounded-inner bg-destructive/[0.08] px-4 py-3 text-body-md text-destructive-ink">
              {t(error === 'save' ? 'errorGuardar' : 'errorEliminar')}
            </div>
          ) : null}

          <div data-card-preview aria-hidden className="mx-auto w-full max-w-[300px] px-inset pb-2 pt-3">
            <WalletCard
              name={trimmed || t('nuevaTarjeta')}
              color={color}
              total={money(preview.total, currency)}
              footer={t('gastosFijos', { n: preview.count })}
            />
          </div>

          <FieldRow label={t('nombre')} htmlFor={nameId}>
            <input
              id={nameId}
              ref={nameRef}
              type="text"
              data-base-ui-swipe-ignore
              enterKeyHint="done"
              autoCapitalize="sentences"
              maxLength={MAX_NAME}
              readOnly={busy}
              aria-invalid={nameError || (nameTouched && !nameValid) || undefined}
              aria-describedby={nameError ? `${nameId}-error` : undefined}
              value={name}
              onChange={(event) => {
                setName(event.target.value)
                setNameError(false)
              }}
              onBlur={() => setNameTouched(true)}
              className="field-focus w-40 rounded-lg bg-muted px-2 py-1.5 text-right text-body-lg text-foreground outline-none"
            />
          </FieldRow>
          {nameError ? (
            <p id={`${nameId}-error`} role="alert" className="px-inset pb-2 text-body-sm text-destructive-ink">
              {t('nombreDuplicado')}
            </p>
          ) : null}

          <div className="flex min-h-row items-center px-inset">
            <span id={colorsLabelId} className="text-body-lg text-foreground">
              {t('color')}
            </span>
          </div>
          <div className="pb-2">
            <ColorSwatchPicker value={color} onChange={setColor} disabled={busy} labelledBy={colorsLabelId} />
          </div>

          <div className="border-t border-border" />
          <h3 id={checklistLabelId} className="px-inset pb-1 pt-4 text-label-ui font-semibold uppercase tracking-wide text-muted-foreground">
            {t('gastosFijosTitulo')}
          </h3>
          {fixedExpenses.length === 0 ? (
            <p className="px-inset pb-2 pt-1 text-body-md text-muted-foreground">{t('sinFijos')}</p>
          ) : (
            <div role="group" aria-labelledby={checklistLabelId} data-card-checklist>
              {fixedExpenses.map((definition) => {
                const on = checked.has(definition.id)
                const elsewhere = definition.cardId && definition.cardId !== cardId ? cardName(definition.cardId) : undefined
                const rowId = `${formId}-fixed-${definition.id}`
                return (
                  <label
                    key={definition.id}
                    htmlFor={rowId}
                    data-card-fixed={definition.id}
                    className="flex min-h-row cursor-pointer items-center gap-3 px-inset py-2 hover:bg-muted"
                  >
                    <Checkbox.Root
                      id={rowId}
                      checked={on}
                      onCheckedChange={(next) => toggle(definition.id, next)}
                      disabled={busy}
                      className="pressable grid size-6 shrink-0 place-items-center rounded-md border-2 border-muted-foreground/60 bg-card transition-colors duration-200 ease-spring [--press-scale:0.9] data-checked:border-brand data-checked:bg-brand motion-reduce:transition-none"
                    >
                      <Checkbox.Indicator keepMounted className="text-primary-foreground data-unchecked:invisible">
                        <Check aria-hidden strokeWidth={3} className="size-4" />
                      </Checkbox.Indicator>
                    </Checkbox.Root>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-body-lg text-foreground">{definition.name}</span>
                      {elsewhere && !on ? (
                        <span data-card-elsewhere className="block truncate text-body-sm text-muted-foreground">
                          {t('enTarjeta', { tarjeta: elsewhere })}
                        </span>
                      ) : null}
                    </span>
                    <Money amount={definition.expectedAmount} currency={currency} className="shrink-0 text-body-lg text-foreground" />
                  </label>
                )
              })}
            </div>
          )}

          {card ? (
            <>
              <div className="mt-2 border-t border-border" />
              <button
                ref={deleteRowRef}
                type="button"
                onClick={() => {
                  setError(null)
                  setStep('confirmDelete')
                }}
                disabled={busy}
                className="flex min-h-row items-center gap-3 px-inset text-body-lg font-medium text-destructive-ink hover:bg-destructive/[0.08] active:bg-destructive/[0.12] disabled:pointer-events-none disabled:opacity-50"
              >
                <Trash2 aria-hidden className="size-5" />
                {t('eliminarTarjeta')}
              </button>
            </>
          ) : null}
        </form>
      ) : (
        <div aria-busy={busy} className="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain">
          {error ? (
            <div role="alert" className="mx-inset mt-3 rounded-inner bg-destructive/[0.08] px-4 py-3 text-body-md text-destructive-ink">
              {t('errorEliminar')}
            </div>
          ) : null}
          <h3 ref={confirmHeadingRef} tabIndex={-1} className="px-inset pb-2 pt-3 text-body-lg text-foreground outline-none">
            {t('confirmarEliminar', { tarjeta: card?.name ?? '' })}
          </h3>
          {freed ? <p className="px-inset pb-2 text-body-md text-muted-foreground">{freed}</p> : null}
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

