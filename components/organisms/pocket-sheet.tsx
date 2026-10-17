'use client'

import { useRef, type RefObject } from 'react'
import { Drawer } from '@base-ui/react/drawer'
import { ChevronLeft } from 'lucide-react'
import { useFormatter, useTranslations } from 'next-intl'
import { useAmountFormatter } from '@/components/atoms/amount-format'
import { MovementRow } from '@/components/molecules/movement-row'
import { SwipeToDelete } from '@/components/molecules/swipe-to-delete'
import { SheetShell } from '@/components/organisms/sheet-shell'
import { AnimatedAmount } from '@/components/ui/counter/animated-amount'
import type { Expense, ExpenseGroup } from '@/lib/data/dashboard'
import type { IncomeEntry } from '@/lib/data/income'
import type { PaymentMethod, Pocket, PocketRow, Transfer } from '@/lib/data/payment-method'
import { cn } from '@/lib/utils'

type PocketSheetProps = {
  open: boolean
  onClose: () => void
  /** The pocket shown; kept while the sheet is leaving. */
  method: PaymentMethod
  pocket: Pocket
  rows: PocketRow[]
  currency: string
  timeZone: string
  opener?: RefObject<HTMLElement | null>
  onOpenExpense?: (group: ExpenseGroup, expense: Expense) => void
  onOpenIncome?: (entry: IncomeEntry) => void
  onOpenTransfer?: (transfer: Transfer) => void
  onDeleteExpense?: (expense: Expense) => Promise<void>
  onDeleteIncome?: (entry: IncomeEntry) => Promise<void>
  onDeleteTransfer?: (transfer: Transfer) => Promise<void>
}

/**
 * A pocket's list (`payment-method` → *The pocket list*, design D8): its balance, what came in and
 * went out this cycle, and the cycle's rows that count for it, newest first. Transfers live only here.
 */
export function PocketSheet({
  open,
  onClose,
  method,
  pocket,
  rows,
  currency,
  timeZone,
  opener,
  onOpenExpense,
  onOpenIncome,
  onOpenTransfer,
  onDeleteExpense,
  onDeleteIncome,
  onDeleteTransfer,
}: PocketSheetProps) {
  const t = useTranslations('medioPago')
  const format = useFormatter()
  const { money } = useAmountFormatter()
  const backRef = useRef<HTMLButtonElement>(null)
  const day = (date: string) => format.dateTime(new Date(date), { day: 'numeric', month: 'short', timeZone })

  return (
    <SheetShell
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose()
      }}
      busy={false}
      isDirty={false}
      initialFocus={backRef}
      opener={opener}
      leading={
        <button
          ref={backRef}
          type="button"
          onClick={onClose}
          aria-label={t('volver')}
          className="pressable -ml-3 grid size-11 place-items-center rounded-full text-muted-foreground [--press-scale:0.96]"
        >
          <ChevronLeft aria-hidden className="size-5" />
        </button>
      }
      title={t(method)}
      trailing={null}
    >
      <Drawer.Content className="flex flex-1 flex-col overflow-y-auto overscroll-contain pb-4" data-pocket-sheet={method}>
        <div className="px-inset pb-3 pt-1 text-center" data-pocket-header>
          <AnimatedAmount
            amount={pocket.balance}
            currency={currency}
            className={cn('block font-display text-headline-lg tabular-nums', pocket.balance < 0 ? 'text-destructive-ink' : 'text-foreground')}
          />
          <p className="mt-1 text-body-sm text-muted-foreground">
            {t('entroSalio', { entro: money(pocket.cameIn, currency), salio: money(pocket.wentOut, currency) })}
          </p>
        </div>
        {rows.length === 0 ? (
          <p className="px-inset py-6 text-center text-body-md text-muted-foreground">{t('vacio')}</p>
        ) : (
          <div className="flex flex-col border-t border-border" data-pocket-rows>
            {rows.map((row, index) => {
              const first = index === 0
              if (row.kind === 'transfer') {
                const { transfer } = row
                const name = t(transfer.into === 'efectivo' ? 'tarjetaAEfectivo' : 'efectivoATarjeta')
                const element = (
                  <MovementRow
                    kind="transfer"
                    name={name}
                    kindLabel={day(transfer.date)}
                    amount={transfer.amount}
                    currency={currency}
                    label={t('fila', { nombre: name, dia: day(transfer.date), monto: money(transfer.amount, currency) })}
                    onActivate={onOpenTransfer ? () => onOpenTransfer(transfer) : undefined}
                    first={first}
                  />
                )
                return onDeleteTransfer ? (
                  <SwipeToDelete key={row.key} rowId={transfer.id} onDelete={() => onDeleteTransfer(transfer)}>
                    {element}
                  </SwipeToDelete>
                ) : (
                  <div key={row.key}>{element}</div>
                )
              }
              if (row.kind === 'expense') {
                const { group, expense } = row
                const name = expense.name || group.name
                const element = (
                  <MovementRow
                    kind="expense"
                    signedExpense
                    name={name}
                    kindLabel={day(expense.date)}
                    amount={expense.amount}
                    currency={currency}
                    color={group.color}
                    label={t('fila', { nombre: name, dia: day(expense.date), monto: `−${money(expense.amount, currency)}` })}
                    onActivate={onOpenExpense ? () => onOpenExpense(group, expense) : undefined}
                    first={first}
                  />
                )
                return onDeleteExpense ? (
                  <SwipeToDelete key={row.key} rowId={expense.id} onDelete={() => onDeleteExpense(expense)}>
                    {element}
                  </SwipeToDelete>
                ) : (
                  <div key={row.key}>{element}</div>
                )
              }
              const { entry } = row
              const element = (
                <MovementRow
                  kind="income"
                  name={entry.name}
                  kindLabel={day(entry.date)}
                  amount={entry.amount}
                  currency={currency}
                  label={t('fila', { nombre: entry.name, dia: day(entry.date), monto: `+${money(entry.amount, currency)}` })}
                  onActivate={onOpenIncome ? () => onOpenIncome(entry) : undefined}
                  first={first}
                />
              )
              return onDeleteIncome ? (
                <SwipeToDelete key={row.key} rowId={entry.id} onDelete={() => onDeleteIncome(entry)}>
                  {element}
                </SwipeToDelete>
              ) : (
                <div key={row.key}>{element}</div>
              )
            })}
          </div>
        )}
      </Drawer.Content>
    </SheetShell>
  )
}
