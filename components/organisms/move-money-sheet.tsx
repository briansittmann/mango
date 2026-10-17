'use client'

import { useId, useRef, useState, type FormEvent, type RefObject } from 'react'
import { Drawer } from '@base-ui/react/drawer'
import { ArrowLeftRight, Banknote, CreditCard, Loader2, Trash2 } from 'lucide-react'
import { useFormatter, useLocale, useTranslations } from 'next-intl'
import { useAmountFormatter } from '@/components/atoms/amount-format'
import { AmountInput, parseAmount } from '@/components/molecules/amount-field'
import { DateCalendar } from '@/components/molecules/date-calendar'
import { FieldRow } from '@/components/molecules/field-row'
import { SheetShell } from '@/components/organisms/sheet-shell'
import type { LocalDate } from '@/lib/data/expenses'
import type { PaymentMethod, Transfer, TransferDraft } from '@/lib/data/payment-method'
import { cn } from '@/lib/utils'

type MoveMoneySheetProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** The transfer being edited; null creates one. */
  transfer: Transfer | null
  /** The pockets' balances now, for the preview. */
  balances: Record<PaymentMethod, number>
  cycle: { start: LocalDate; end: LocalDate; today: LocalDate }
  /** The transfer's local day, in edit mode. */
  transferDay: LocalDate | null
  currency: string
  opener?: RefObject<HTMLElement | null>
  onSave: (draft: TransferDraft) => Promise<void>
  onDelete?: () => Promise<void>
}

function formatForEdit(amount: number, locale: string): string {
  return new Intl.NumberFormat(locale, { minimumFractionDigits: 2, trailingZeroDisplay: 'stripIfInteger', useGrouping: false }).format(amount)
}

const ICONS = { efectivo: Banknote, tarjeta: CreditCard } as const

const otherPocket = (method: PaymentMethod): PaymentMethod => (method === 'efectivo' ? 'tarjeta' : 'efectivo')

/**
 * "Mover plata" (`payment-method` → *The "Mover plata" sheet*, design D8): an amount, the pocket it
 * leaves and the one it enters, a day of the shown cycle and a preview of both balances. A new
 * transfer starts from card into cash; in edit mode the preview first takes the transfer out.
 */
export function MoveMoneySheet({ open, onOpenChange, transfer, balances, cycle, transferDay, currency, opener, onSave, onDelete }: MoveMoneySheetProps) {
  const t = useTranslations('medioPago')
  const tHoja = useTranslations('hojaMovimiento')
  const format = useFormatter()
  const { money, parts } = useAmountFormatter()
  const locale = useLocale()
  const { symbol, symbolFirst } = parts(1, currency)
  const formId = useId()
  const amountRef = useRef<HTMLInputElement>(null)
  const dateTriggerRef = useRef<HTMLButtonElement>(null)

  const initial = () => ({
    amount: transfer ? formatForEdit(transfer.amount, locale) : '',
    into: transfer?.into ?? ('efectivo' as PaymentMethod),
    date: transferDay ?? cycle.today,
  })
  const [wasOpen, setWasOpen] = useState(open)
  const [values, setValues] = useState(initial)
  const [touched, setTouched] = useState(false)
  const [dateOpen, setDateOpen] = useState(false)
  const [status, setStatus] = useState<'idle' | 'saving' | 'deleting'>('idle')
  const [error, setError] = useState<'save' | 'delete' | null>(null)

  if (open !== wasOpen) {
    setWasOpen(open)
    if (open) {
      setValues(initial())
      setTouched(false)
      setDateOpen(false)
      setStatus('idle')
      setError(null)
    }
  }

  const amount = parseAmount(values.amount)
  const from = otherPocket(values.into)
  const disabled = status !== 'idle'
  const isDirty = transfer
    ? amount !== transfer.amount || values.into !== transfer.into || values.date !== transferDay
    : values.amount.trim() !== ''

  // The balances as they would be after saving: the edited transfer comes out first.
  const preview = { ...balances }
  if (transfer) {
    preview[transfer.into] -= transfer.amount
    preview[otherPocket(transfer.into)] += transfer.amount
  }
  if (amount != null) {
    preview[values.into] += amount
    preview[from] -= amount
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (amount == null) {
      setTouched(true)
      return
    }
    setStatus('saving')
    setError(null)
    try {
      await onSave({ amount, into: values.into, date: values.date })
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

  // Mirrored, like the card's blocks, so the swap button between them covers no text.
  function pocketBox(method: PaymentMethod, side: 'from' | 'to') {
    const Icon = ICONS[method]
    return (
      <div
        className={cn(
          'flex min-h-[72px] min-w-0 flex-1 flex-col justify-center gap-1 rounded-inner bg-muted px-3 py-2.5',
          side === 'from' ? 'items-start pr-8' : 'items-end pl-8 text-right',
        )}
        data-move-box={side}
      >
        <span className="text-body-sm text-muted-foreground">{t(side === 'from' ? 'saleDe' : 'entraA')}</span>
        <span className="flex items-center gap-1.5 text-body-lg font-medium text-foreground">
          <Icon aria-hidden className="size-4 shrink-0" />
          {t(method)}
        </span>
      </div>
    )
  }

  const submitLabel = transfer ? tHoja('guardar') : t('mover', { monto: money(amount ?? 0, currency) })
  const invalid = touched && amount == null

  return (
    <SheetShell
      open={open}
      onOpenChange={onOpenChange}
      busy={disabled}
      isDirty={isDirty}
      initialFocus={amountRef}
      opener={opener}
      leading={
        <Drawer.Close
          disabled={disabled}
          onMouseDown={(event) => event.preventDefault()}
          className="pressable text-body-md text-muted-foreground disabled:pointer-events-none disabled:opacity-50"
        >
          {tHoja('cancelar')}
        </Drawer.Close>
      }
      title={transfer ? t('editarMovimiento') : t('moverPlata')}
      trailing={null}
    >
      <form id={formId} onSubmit={handleSubmit} aria-busy={disabled} className="flex min-h-0 flex-1 flex-col">
        <Drawer.Content className="flex flex-1 flex-col overflow-y-auto overscroll-contain pb-4" data-move-money-sheet>
          {error ? (
            <div role="alert" className="mx-inset mt-3 rounded-inner bg-destructive/[0.08] px-4 py-3 text-body-md text-destructive-ink">
              {error === 'save' ? t('errorGuardar') : t('errorEliminar')}
            </div>
          ) : null}
          <label htmlFor={`${formId}-amount`} className="sr-only">
            {tHoja('importe')}
          </label>
          <div className="field-focus mx-inset mt-3 flex items-baseline justify-center gap-1 rounded-inner bg-muted px-3 py-3">
            {symbolFirst ? (
              <span aria-hidden className="font-display text-headline-md text-foreground">
                {symbol}
              </span>
            ) : null}
            <AmountInput
              id={`${formId}-amount`}
              ref={amountRef}
              data-base-ui-swipe-ignore
              enterKeyHint="done"
              autoComplete="off"
              placeholder="0"
              readOnly={disabled}
              aria-invalid={invalid || undefined}
              aria-describedby={invalid ? `${formId}-amount-error` : undefined}
              value={values.amount}
              onChange={(next) => setValues((prev) => ({ ...prev, amount: next }))}
              onBlur={() => setTouched(true)}
              grow
              className="min-w-[2ch] max-w-full bg-transparent text-center font-display text-headline-lg tabular-nums text-foreground outline-none placeholder:text-muted-foreground"
            />
            {symbolFirst ? null : (
              <span aria-hidden className="font-display text-headline-md text-foreground">
                {symbol}
              </span>
            )}
          </div>
          {invalid ? (
            <p id={`${formId}-amount-error`} className="px-inset pt-2 text-body-sm text-destructive-ink">
              {tHoja('importeInvalido')}
            </p>
          ) : null}

          <div className="relative mx-inset mt-3 flex gap-3">
            {pocketBox(from, 'from')}
            {pocketBox(values.into, 'to')}
            <button
              type="button"
              aria-label={t('intercambiar')}
              disabled={disabled}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => setValues((prev) => ({ ...prev, into: otherPocket(prev.into) }))}
              className="pressable absolute left-1/2 top-1/2 grid size-11 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border-2 border-primary bg-card text-foreground [--press-scale:0.96] disabled:opacity-50"
            >
              <ArrowLeftRight aria-hidden className="size-4" />
            </button>
          </div>

          <div className="mt-3">
            <FieldRow label={tHoja('fecha')} htmlFor={`${formId}-date`}>
              <button
                ref={dateTriggerRef}
                id={`${formId}-date`}
                type="button"
                disabled={disabled}
                aria-expanded={dateOpen}
                aria-controls={`${formId}-calendar`}
                data-value={values.date}
                onClick={() => setDateOpen((prev) => !prev)}
                className={cn(
                  'pressable block rounded-lg px-2 py-1.5 text-body-lg transition-colors duration-200 [--press-scale:0.96] motion-reduce:transition-none',
                  dateOpen ? 'bg-primary/15 text-primary' : 'bg-muted text-foreground',
                )}
              >
                {format.dateTime(new Date(`${values.date}T00:00:00Z`), { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })}
              </button>
            </FieldRow>
            <DateCalendar
              id={`${formId}-calendar`}
              open={dateOpen}
              value={values.date}
              min={cycle.start}
              max={cycle.end}
              onSelect={(next) => {
                setValues((prev) => ({ ...prev, date: next }))
                setDateOpen(false)
                dateTriggerRef.current?.focus()
              }}
              onClose={() => {
                setDateOpen(false)
                dateTriggerRef.current?.focus()
              }}
            />
          </div>

          <section aria-labelledby={`${formId}-preview`} className="mx-inset mt-3 rounded-inner border border-border px-3 py-3" data-move-preview>
            <h3 id={`${formId}-preview`} className="text-body-sm text-muted-foreground">
              {t('despues')}
            </h3>
            <dl className="mt-2 grid grid-cols-2 gap-3">
              {(['efectivo', 'tarjeta'] as const).map((method) => (
                <div key={method} data-preview={method}>
                  <dt className="text-body-sm text-muted-foreground">{t(method)}</dt>
                  <dd className={cn('text-tabular-numeric-md', preview[method] < 0 ? 'text-destructive-ink' : 'text-foreground')}>
                    {money(preview[method], currency)}
                  </dd>
                </div>
              ))}
            </dl>
            <p className="mt-2 text-body-sm text-muted-foreground">{t('margenNoCambia')}</p>
          </section>

          <div className="px-inset pt-4">
            <button
              type="submit"
              disabled={disabled || amount == null}
              onMouseDown={(event) => event.preventDefault()}
              className={cn(
                'pressable flex min-h-row w-full items-center justify-center gap-2 rounded-full font-semibold',
                disabled || amount == null ? 'bg-muted text-muted-foreground' : 'bg-primary text-primary-foreground',
              )}
            >
              {status === 'saving' ? (
                <>
                  <Loader2 aria-hidden className="size-5 animate-spin" />
                  <span className="sr-only">{submitLabel}</span>
                </>
              ) : (
                submitLabel
              )}
            </button>
          </div>

          {transfer && onDelete ? (
            <>
              <div className="mt-4 border-t border-border" />
              <button
                type="button"
                onClick={() => void handleDelete()}
                disabled={disabled}
                className="flex min-h-row items-center gap-3 px-inset text-body-lg font-medium text-destructive-ink hover:bg-destructive/[0.08] active:bg-destructive/[0.12] disabled:pointer-events-none disabled:opacity-50"
              >
                {status === 'deleting' ? <Loader2 aria-hidden className="size-5 animate-spin" /> : <Trash2 aria-hidden className="size-5" />}
                {t('eliminarMovimiento')}
              </button>
            </>
          ) : null}
        </Drawer.Content>
      </form>
    </SheetShell>
  )
}
