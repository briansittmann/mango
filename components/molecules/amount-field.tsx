import { useMemo, type FocusEvent } from 'react'
import { useAmountFormatter } from '@/components/atoms/amount-format'
import { FieldRow } from '@/components/molecules/field-row'

const AMOUNT_PATTERN = /^\d{0,10}([.,]\d{0,2})?$/

export function parseAmount(text: string): number | null {
  const trimmed = text.trim()
  if (!AMOUNT_PATTERN.test(trimmed) || !/\d/.test(trimmed)) return null
  const value = Number(trimmed.replace(',', '.'))
  return Number.isFinite(value) && value > 0 ? value : null
}

export type AmountFieldProps = {
  id: string
  label: string
  currency?: string
  value: string
  onChange: (value: string) => void
  onFocus?: (event: FocusEvent<HTMLInputElement>) => void
  onBlur?: () => void
  inputRef?: (el: HTMLInputElement | null) => void
  disabled?: boolean
  invalid?: boolean
  invalidMessage?: string
  /** Empty is never invalid, regardless of `invalid`. */
  optional?: boolean
}

export function AmountField({
  id,
  label,
  currency,
  value,
  onChange,
  onFocus,
  onBlur,
  inputRef,
  disabled,
  invalid,
  invalidMessage,
  optional,
}: AmountFieldProps) {
  const { parts } = useAmountFormatter()

  // Only the symbol and its side come from the formatter: the field always holds the full number
  // (`localization` → *Fields keep the full number*).
  const currencyParts = useMemo(() => {
    if (!currency) return null
    try {
      return parts(1, currency)
    } catch {
      return null
    }
  }, [parts, currency])
  const currencySymbol = currencyParts?.symbol
  const currencyFirst = currencyParts?.symbolFirst ?? false

  const showInvalid = Boolean(invalid) && !(optional && value.trim() === '')

  return (
    <>
      <FieldRow label={label} htmlFor={id} tall>
        <div className="field-focus flex items-center gap-1 rounded-lg bg-muted px-2 py-1.5">
          {currencyFirst && currencySymbol ? <span className="text-tabular-numeric-lg text-foreground">{currencySymbol}</span> : null}
          <input
            id={id}
            ref={inputRef}
            data-base-ui-swipe-ignore
            inputMode="decimal"
            enterKeyHint="done"
            autoComplete="off"
            readOnly={disabled}
            aria-invalid={showInvalid || undefined}
            aria-describedby={showInvalid ? `${id}-error` : undefined}
            value={value}
            onChange={(event) => onChange(event.target.value)}
            onFocus={onFocus}
            onBlur={onBlur}
            className="w-24 bg-transparent text-right text-tabular-numeric-lg text-foreground outline-none"
          />
          {!currencyFirst && currencySymbol ? <span className="text-tabular-numeric-lg text-foreground">{currencySymbol}</span> : null}
        </div>
      </FieldRow>
      {showInvalid && invalidMessage ? (
        <p id={`${id}-error`} className="px-inset pb-2 text-body-sm text-destructive-ink">
          {invalidMessage}
        </p>
      ) : null}
    </>
  )
}
