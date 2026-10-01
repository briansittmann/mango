import { useMemo } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { Collapsible } from '@/components/atoms/collapsible'
import { FieldRow } from '@/components/molecules/field-row'
import { IntegerField, parseInteger } from '@/components/molecules/integer-field'
import { cn } from '@/lib/utils'
// The country table and the figure formatter are constants and pure functions, not data access
// (add-web-onboarding D4, D12); the atoms' amount-format module takes the same exception.
// eslint-disable-next-line @typescript-eslint/no-restricted-imports
import { COUNTRIES, CURRENCIES, countryOf, timezoneForCountry } from '@/lib/data/countries'
// eslint-disable-next-line @typescript-eslint/no-restricted-imports
import { formatAmountFigure, type AmountFormat } from '@/lib/data/amount-format'

/** The basics as typed; `cycleDay` is the field's text, `country` null until one is chosen. */
export type BasicsDraft = {
  name: string
  country: string | null
  currency: string
  timezone: string
  cycleDay: string
  amountFormat: AmountFormat
}

export const MAX_NAME_LENGTH = 80

export function basicsValid(draft: BasicsDraft): boolean {
  const name = draft.name.trim()
  return name.length > 0 && name.length <= MAX_NAME_LENGTH && draft.country != null && parseInteger(draft.cycleDay, { min: 1, max: 28 }) != null
}

/** A stored name that looks like one: letters and spaces, no digit, dot, plus or underscore (D7). */
export function looksLikeName(name: string): boolean {
  return /^[\p{L}\p{M}' -]+$/u.test(name.trim()) && name.trim().length > 0
}

function capitalize(text: string): string {
  return text.charAt(0).toLocaleUpperCase() + text.slice(1)
}

/** The city of an IANA zone: its last segment, underscores as spaces. */
function cityOf(timezone: string): string {
  return timezone.split('/').pop()?.replace(/_/g, ' ') ?? timezone
}

type BasicsFieldsProps = {
  idPrefix: string
  value: BasicsDraft
  onChange: (next: BasicsDraft) => void
  /** The account's stored timezone: kept when it belongs to the chosen country (D4). */
  storedTimezone: string
  /** The stored name, shown as the placeholder when it does not look like a name. */
  namePlaceholder?: string
  /** `'editable'` on a fresh account, `'locked'` once anything is keyed to the cycle, `'hidden'` on the account sheet. */
  cycleDay: 'editable' | 'locked' | 'hidden'
  disabled?: boolean
}

const selectClassName =
  'field-focus h-10 max-w-[11rem] rounded-lg bg-muted px-2 text-right text-body-lg text-foreground outline-none'

/**
 * The fields of the basics step (D4–D7), reused by the "Cuenta" sheet (D16): name, country (names
 * from `Intl.DisplayNames`, sorted), currency, the format control for Argentina and the cycle day.
 * Choosing a country sets the currency and the timezone; the currency stays editable.
 */
export function BasicsFields({ idPrefix, value, onChange, storedTimezone, namePlaceholder, cycleDay, disabled }: BasicsFieldsProps) {
  const t = useTranslations('onboarding')
  const locale = useLocale()

  const countries = useMemo(() => {
    const names = new Intl.DisplayNames(locale, { type: 'region' })
    return COUNTRIES.map((country) => ({ code: country.code, name: names.of(country.code) ?? country.code })).sort((a, b) =>
      a.name.localeCompare(b.name, locale),
    )
  }, [locale])
  const currencies = useMemo(() => {
    const names = new Intl.DisplayNames(locale, { type: 'currency' })
    return CURRENCIES.map((code) => ({ code, name: capitalize(names.of(code) ?? code) }))
  }, [locale])

  const currencyName = currencies.find((currency) => currency.code === value.currency)?.name ?? value.currency
  const derivedLine = value.country ? `${currencyName} · ${t('datos.horaDe', { ciudad: cityOf(value.timezone) })}` : null
  const isArgentina = value.country === 'AR'
  const dayText = value.cycleDay.trim()
  const dayInvalid = dayText !== '' && parseInteger(dayText, { min: 1, max: 28 }) == null

  function chooseCountry(code: string) {
    const country = countryOf(code)
    if (!country) return
    onChange({
      ...value,
      country: code,
      currency: country.currency,
      timezone: timezoneForCountry(code, storedTimezone) ?? country.timezones[0],
    })
  }

  const formatOptions = [
    { value: 'completo', label: 'datos.formatoCompleto', figure: formatAmountFigure(350000, { locale, currency: 'ARS', amountFormat: 'completo' }) },
    { value: 'abreviado', label: 'datos.formatoAbreviado', figure: formatAmountFigure(350000, { locale, currency: 'ARS', amountFormat: 'abreviado' }) },
  ] as const
  const formatIndex = formatOptions.findIndex((option) => option.value === value.amountFormat)

  return (
    <>
      <FieldRow label={t('datos.nombre')} htmlFor={`${idPrefix}-name`}>
        <input
          id={`${idPrefix}-name`}
          type="text"
          autoComplete="name"
          autoCapitalize="words"
          enterKeyHint="next"
          maxLength={MAX_NAME_LENGTH}
          readOnly={disabled}
          placeholder={namePlaceholder}
          value={value.name}
          onChange={(event) => onChange({ ...value, name: event.target.value })}
          className="field-focus w-44 rounded-lg bg-muted px-2 py-1.5 text-right text-body-lg text-foreground outline-none placeholder:text-muted-foreground/70"
        />
      </FieldRow>

      <FieldRow label={t('datos.pais')} htmlFor={`${idPrefix}-country`}>
        <select
          id={`${idPrefix}-country`}
          disabled={disabled}
          value={value.country ?? ''}
          onChange={(event) => chooseCountry(event.target.value)}
          className={selectClassName}
        >
          <option value="" disabled>
            {t('datos.elegirPais')}
          </option>
          {countries.map((country) => (
            <option key={country.code} value={country.code}>
              {country.name}
            </option>
          ))}
        </select>
      </FieldRow>
      {derivedLine ? (
        <p data-derived-line className="px-inset pb-2 text-body-sm text-muted-foreground">
          {derivedLine}
        </p>
      ) : null}

      <FieldRow label={t('datos.moneda')} htmlFor={`${idPrefix}-currency`}>
        <select
          id={`${idPrefix}-currency`}
          disabled={disabled}
          value={value.currency}
          onChange={(event) => onChange({ ...value, currency: event.target.value })}
          className={selectClassName}
        >
          {currencies.map((currency) => (
            <option key={currency.code} value={currency.code}>
              {currency.name}
            </option>
          ))}
        </select>
      </FieldRow>

      {/* The format control exists only for Argentina (D12): it enters below the currency with the
          collapsible's own 200 ms reveal. */}
      <Collapsible open={isArgentina}>
        <div
          className="relative flex min-h-row items-center gap-3 px-inset before:absolute before:left-4 before:right-0 before:top-0 before:h-px before:bg-border"
          data-format-control
        >
          <span id={`${idPrefix}-format-label`} className="flex-1 text-body-lg text-foreground">
            {t('datos.formato')}
          </span>
          <div role="radiogroup" aria-labelledby={`${idPrefix}-format-label`} className="segment-track relative grid grid-cols-2 rounded-[14px] p-1">
            <span
              aria-hidden
              className="segment-thumb absolute inset-y-1 left-1 w-[calc((100%-0.5rem)/2)] rounded-[10px] transition-[translate] duration-500 ease-spring motion-reduce:transition-none"
              style={{ translate: `${Math.max(0, formatIndex) * 100}%` }}
            />
            {formatOptions.map((option) => {
              const selected = value.amountFormat === option.value
              return (
                <button
                  key={option.value}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  aria-label={t(option.label)}
                  disabled={disabled || !isArgentina}
                  onClick={() => onChange({ ...value, amountFormat: option.value })}
                  className={cn(
                    'onboarding-button relative h-9 min-w-[4.5rem] rounded-[10px] px-3 text-tabular-numeric-md outline-none focus-visible:outline-2 focus-visible:-outline-offset-2',
                    selected ? 'text-foreground' : 'text-muted-foreground',
                  )}
                >
                  {option.figure}
                </button>
              )
            })}
          </div>
        </div>
      </Collapsible>

      {cycleDay === 'hidden' ? null : (
        <>
          <IntegerField
            id={`${idPrefix}-cycle-day`}
            label={t('datos.diaInicio')}
            value={value.cycleDay}
            onChange={(next) => onChange({ ...value, cycleDay: next })}
            disabled={disabled || cycleDay === 'locked'}
            maxLength={2}
            invalid={dayInvalid}
            invalidMessage={t('datos.diaInvalido')}
          />
          <p data-cycle-hint className="px-inset pb-3 text-body-sm text-muted-foreground">
            {t(cycleDay === 'locked' ? 'ciclo.bloqueado' : 'ciclo.ayuda')}
          </p>
        </>
      )}
    </>
  )
}
