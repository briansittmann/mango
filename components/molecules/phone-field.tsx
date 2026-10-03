import { useMemo } from 'react'
import { useLocale } from 'next-intl'
import { cn } from '@/lib/utils'
// The country table and the phone rules are constants and pure functions, not data access
// (add-whatsapp-linking D8); `basics-fields` takes the same exception for the country table.
// eslint-disable-next-line @typescript-eslint/no-restricted-imports
import { COUNTRIES, flagOf } from '@/lib/data/countries'
// eslint-disable-next-line @typescript-eslint/no-restricted-imports
import { toE164 } from '@/lib/data/phone'

export type PhoneDraft = { country: string | null; local: string }

/** Whether the draft converts to a valid E.164 number for its country: what enables the save. */
export function phoneValid(draft: PhoneDraft): boolean {
  return draft.country != null && toE164(draft.local, draft.country) != null
}

export type PhoneFieldLabels = {
  country: string
  local: string
  invalid: string
  taken: string
}

type PhoneFieldProps = {
  idPrefix: string
  value: PhoneDraft
  onChange: (next: PhoneDraft) => void
  labels: PhoneFieldLabels
  error: 'invalid' | 'taken' | null
  disabled?: boolean
}

/**
 * The phone field (`whatsapp-linking` → *The typed number is optional, converted by the account's
 * country, and never links*, D8): a native country select reading `🇦🇷 +54` (the name as the
 * option's `aria-label`) and the local number beside it. Conversion to E.164 happens on the
 * server; here `phoneValid` only decides whether the save is offered.
 */
export function PhoneField({ idPrefix, value, onChange, labels, error, disabled }: PhoneFieldProps) {
  const locale = useLocale()
  const countries = useMemo(() => {
    const names = new Intl.DisplayNames(locale, { type: 'region' })
    return COUNTRIES.map((country) => ({
      code: country.code,
      // What the option reads: the flag and the prefix; the name goes to assistive technology.
      label: `${flagOf(country.code)} ${country.callingCode}`,
      name: names.of(country.code) ?? country.code,
    })).sort((a, b) => a.name.localeCompare(b.name, locale))
  }, [locale])

  const errorText = error === 'taken' ? labels.taken : error === 'invalid' ? labels.invalid : null
  const errorId = `${idPrefix}-phone-error`

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <select
          id={`${idPrefix}-phone-country`}
          aria-label={labels.country}
          disabled={disabled}
          value={value.country ?? ''}
          onChange={(event) => onChange({ ...value, country: event.target.value || null })}
          className="field-focus h-11 shrink-0 rounded-lg bg-muted pl-2 pr-1 text-body-lg text-foreground outline-none disabled:opacity-50"
        >
          {value.country == null ? <option value="" disabled /> : null}
          {countries.map((country) => (
            <option key={country.code} value={country.code} aria-label={country.name}>
              {country.label}
            </option>
          ))}
        </select>
        <input
          id={`${idPrefix}-phone-local`}
          type="tel"
          aria-label={labels.local}
          autoComplete="tel-national"
          inputMode="tel"
          enterKeyHint="done"
          readOnly={disabled}
          aria-invalid={error != null || undefined}
          aria-describedby={errorText ? errorId : undefined}
          value={value.local}
          onChange={(event) => onChange({ ...value, local: event.target.value })}
          className={cn(
            'field-focus h-11 min-w-0 flex-1 rounded-lg bg-muted px-3 text-body-lg text-foreground outline-none placeholder:text-muted-foreground/70',
            disabled && 'opacity-50',
          )}
        />
      </div>
      {errorText ? (
        <p id={errorId} role="alert" className="text-body-sm text-destructive-ink">
          {errorText}
        </p>
      ) : null}
    </div>
  )
}
