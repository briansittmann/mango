import { useMemo, type ChangeEvent, type FocusEvent, type InputHTMLAttributes, type Ref } from 'react'
import { useLocale } from 'next-intl'
import { useAmountFormatter } from '@/components/atoms/amount-format'
import { FieldRow } from '@/components/molecules/field-row'

const AMOUNT_PATTERN = /^\d{0,10}([.,]\d{0,2})?$/

export function parseAmount(text: string): number | null {
  const trimmed = text.trim()
  if (!AMOUNT_PATTERN.test(trimmed) || !/\d/.test(trimmed)) return null
  const value = Number(trimmed.replace(',', '.'))
  return Number.isFinite(value) && value > 0 ? value : null
}

type Separators = { group: string; decimal: string }

function separatorsOf(locale: string): Separators {
  const parts = new Intl.NumberFormat(locale, { useGrouping: 'always' }).formatToParts(1000.5)
  return {
    group: parts.find((part) => part.type === 'group')?.value ?? '',
    decimal: parts.find((part) => part.type === 'decimal')?.value ?? '.',
  }
}

/** `1000000,5` → `1.000.000,5`: the integer part grouped in threes, from 1 000 up. */
function groupAmount(raw: string, { group, decimal }: Separators): string {
  const match = /^(\d*)(?:[.,](\d*))?$/.exec(raw)
  if (!match) return raw
  const grouped = match[1].replace(/\B(?=(\d{3})+(?!\d))/g, group)
  return match[2] === undefined ? grouped : `${grouped}${decimal}${match[2]}`
}

export type AmountInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'> & {
  ref?: Ref<HTMLInputElement>
  grow?: boolean
  value: string
  onChange: (value: string) => void
}

/**
 * A decimal input that shows its number with thousands separators (`1.000`, `1.000.000`) and hands
 * the parent the ungrouped text (`1000`), which `parseAmount` reads. A separator the person types
 * is the decimal mark, whichever key it came from; the grouping marks are the field's own.
 */
export function AmountInput({ value, onChange, grow, ...props }: AmountInputProps) {
  const locale = useLocale()
  const separators = useMemo(() => separatorsOf(locale), [locale])

  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    const input = event.currentTarget
    const native = event.nativeEvent as InputEvent
    const text = input.value
    const caret = input.selectionStart ?? text.length
    const typedDecimal = (native.data === '.' || native.data === ',') && text[caret - 1] === native.data

    let raw = ''
    let kept = 0
    for (let index = 0; index < text.length; index++) {
      const char = text[index]
      let next = ''
      if (/\d/.test(char)) next = char
      else if ((typedDecimal && index === caret - 1) || char === separators.decimal) next = separators.decimal
      else if (char !== separators.group) next = char
      raw += next
      if (index < caret && next) kept++
    }

    // Deleting a grouping mark deletes the digit beside it instead.
    if (raw === value) {
      if (native.inputType === 'deleteContentBackward' && kept > 0) {
        raw = raw.slice(0, kept - 1) + raw.slice(kept)
        kept--
      } else if (native.inputType === 'deleteContentForward') {
        raw = raw.slice(0, kept) + raw.slice(kept + 1)
      }
    }

    const valid = /^\d*([.,]\d*)?$/.test(raw)
    if (!valid) {
      raw = value
      kept = Math.max(0, kept - 1)
    }

    const display = groupAmount(raw, separators)
    let position = 0
    for (let count = 0; position < display.length && count < kept; position++) {
      if (display[position] !== separators.group) count++
    }
    // Written here, React finds the same value on render and leaves the caret where it is.
    input.value = display
    input.setSelectionRange(position, position)
    if (raw !== value) onChange(raw)
  }

  const display = groupAmount(value, separators)
  // `grow`: as wide as its number, so the field around it widens with the amount.
  const style = grow ? { ...props.style, width: `${display.length + 0.5}ch` } : props.style
  return <input {...props} style={style} inputMode="decimal" value={display} onChange={handleChange} />
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
        {/* As wide as the sheet's text fields (`w-40`) to start, wider when the amount needs it, up
            to `max-w-52` (room for `1.250.000,50 €`); past that the number scrolls inside. */}
        <div className="field-focus flex min-w-40 max-w-52 items-center gap-1 rounded-lg bg-muted px-2 py-1.5">
          {currencyFirst && currencySymbol ? <span className="text-tabular-numeric-lg text-foreground">{currencySymbol}</span> : null}
          <AmountInput
            id={id}
            ref={inputRef}
            data-base-ui-swipe-ignore
            enterKeyHint="done"
            autoComplete="off"
            readOnly={disabled}
            aria-invalid={showInvalid || undefined}
            aria-describedby={showInvalid ? `${id}-error` : undefined}
            value={value}
            onChange={onChange}
            onFocus={onFocus}
            onBlur={onBlur}
            grow
            className="min-w-0 flex-auto bg-transparent text-right text-tabular-numeric-lg text-foreground outline-none"
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
