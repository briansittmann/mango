import type { FocusEvent } from 'react'
import { FieldRow } from '@/components/molecules/field-row'

export function parseInteger(text: string, { min, max }: { min: number; max?: number }): number | null {
  const trimmed = text.trim()
  if (!/^\d+$/.test(trimmed)) return null
  const value = Number(trimmed)
  if (value < min) return null
  if (max != null && value > max) return null
  return value
}

export type IntegerFieldProps = {
  id: string
  label: string
  value: string
  onChange: (value: string) => void
  onBlur?: (event: FocusEvent<HTMLInputElement>) => void
  inputRef?: (el: HTMLInputElement | null) => void
  disabled?: boolean
  invalid?: boolean
  invalidMessage?: string
  maxLength?: number
}

export function IntegerField({
  id,
  label,
  value,
  onChange,
  onBlur,
  inputRef,
  disabled,
  invalid,
  invalidMessage,
  maxLength,
}: IntegerFieldProps) {
  return (
    <>
      <FieldRow label={label} htmlFor={id}>
        <input
          id={id}
          ref={inputRef}
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          maxLength={maxLength}
          data-base-ui-swipe-ignore
          enterKeyHint="done"
          readOnly={disabled}
          aria-invalid={invalid || undefined}
          aria-describedby={invalid ? `${id}-error` : undefined}
          value={value}
          onChange={(event) => onChange(event.target.value.replace(/\D/g, ''))}
          onBlur={onBlur}
          className="w-16 rounded-lg bg-muted px-2 py-1.5 text-right text-tabular-numeric-lg text-foreground outline-none"
        />
      </FieldRow>
      {invalid && invalidMessage ? (
        <p id={`${id}-error`} className="px-inset pb-2 text-body-sm text-destructive-ink">
          {invalidMessage}
        </p>
      ) : null}
    </>
  )
}
