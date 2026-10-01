/**
 * One formatter for every amount the web and the bot show (`localization` → *Locale-aware
 * formatting*, *Amount format preference*; `add-web-onboarding` D12). Pure, relative imports only,
 * so Node's test runner loads it (`amount-format.test.mjs`).
 */

import { currencyFormatOptions } from '../../i18n/formats.ts'

/** `usuarios.formato_montos`: `$ 350.000` or `$ 350k`. */
export type AmountFormat = 'completo' | 'abreviado'

export type AmountOptions = {
  /** The app locale: `es` or `en`. */
  locale: string
  currency: string
  /** The format in effect; missing means complete. */
  amountFormat?: AmountFormat
  signDisplay?: Intl.NumberFormatOptions['signDisplay']
}

/** One piece of a formatted amount, in display order. */
export type AmountPart = { type: 'sign' | 'symbol' | 'figure' | 'literal'; value: string }

export type AmountParts = {
  /** The whole amount, as `formatAmount` returns it. */
  text: string
  /** The number alone, abbreviated or full, unsigned. */
  figure: string
  symbol: string
  symbolFirst: boolean
  /** The locale's minus (or plus, with `signDisplay`), or empty. */
  sign: string
  parts: AmountPart[]
}

/**
 * The `Intl` locale an amount is laid out in: Argentine pesos in Spanish read as in Argentina
 * (`$ 350.000`, symbol first), so `es` + `ARS` is `es-AR`; everything else keeps the app locale.
 */
export function amountLocale(locale: string, currency: string): string {
  return locale === 'es' && currency === 'ARS' ? 'es-AR' : locale
}

/**
 * The format in effect for an account: the stored one only for Argentina, complete for any other
 * country whatever the column holds (`localization` → *Amount format preference*).
 */
export function effectiveAmountFormat(usuario: { pais: string | null; formato_montos: AmountFormat }): AmountFormat {
  return usuario.pais === 'AR' ? usuario.formato_montos : 'completo'
}

type Unit = { suffix: '' | 'k' | 'M'; divisor: number }

const FULL: Unit = { suffix: '', divisor: 1 }
const THOUSAND: Unit = { suffix: 'k', divisor: 1_000 }
const MILLION: Unit = { suffix: 'M', divisor: 1_000_000 }

/** The unit an absolute amount reads in: `k` from 1 000, `M` from 999 950 (which rounds to 1M). */
function unitOf(abs: number, amountFormat: AmountFormat | undefined): Unit {
  if (amountFormat !== 'abreviado' || abs < 1_000) return FULL
  return abs < 999_950 ? THOUSAND : MILLION
}

/** `abs` in `unit`, rounded half away from zero to one decimal, the decimal dropped when zero. */
function abbreviatedFigure(abs: number, unit: Unit, locale: string): string {
  const figure = Math.round(abs / (unit.divisor / 10)) / 10
  return new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(figure) + unit.suffix
}

function fullFormatter({ locale, currency, signDisplay }: AmountOptions): Intl.NumberFormat {
  return new Intl.NumberFormat(amountLocale(locale, currency), { ...currencyFormatOptions, currency, signDisplay })
}

const NUMERIC_PARTS = new Set(['integer', 'group', 'decimal', 'fraction'])

/**
 * The amount as the full form lays it out — sign, symbol, spaces — with the figure replaced by its
 * abbreviated form when the format in effect calls for one: `$ 350k`, `-$ 1,5M`, `$350k`, `1,5M €`.
 */
export function formatAmountParts(amount: number, options: AmountOptions): AmountParts {
  const unit = unitOf(Math.abs(amount), options.amountFormat)
  const parts: AmountPart[] = []
  let figure = ''
  let figureIndex = -1
  let symbol = ''
  let sign = ''

  for (const part of fullFormatter(options).formatToParts(amount)) {
    if (NUMERIC_PARTS.has(part.type)) {
      if (figureIndex < 0) {
        figureIndex = parts.length
        parts.push({ type: 'figure', value: '' })
      }
      figure += part.value
    } else if (part.type === 'currency') {
      symbol = part.value
      parts.push({ type: 'symbol', value: part.value })
    } else if (part.type === 'minusSign' || part.type === 'plusSign') {
      sign = part.value
      parts.push({ type: 'sign', value: part.value })
    } else {
      parts.push({ type: 'literal', value: part.value })
    }
  }

  if (unit.suffix) figure = abbreviatedFigure(Math.abs(amount), unit, amountLocale(options.locale, options.currency))
  if (figureIndex >= 0) parts[figureIndex].value = figure

  return {
    text: parts.map((part) => part.value).join(''),
    figure,
    symbol,
    symbolFirst: parts.findIndex((part) => part.type === 'symbol') < figureIndex,
    sign,
    parts,
  }
}

/** The amount as one string: `2.400 €`, `$ 350k`, `€2,400`. */
export function formatAmount(amount: number, options: AmountOptions): string {
  return formatAmountParts(amount, options).text
}

/**
 * The number only, unsigned, for a counter: in the unit and with the decimals `reference` reads in
 * (the counter's target), so a count to `350k` rolls `12,3k … 349,8k … 350k` and a count to `62,40`
 * keeps two decimals. Without `reference`, the value's own unit and decimals.
 */
export function formatAmountFigure(value: number, options: AmountOptions & { reference?: number }): string {
  const reference = Math.abs(options.reference ?? value)
  const locale = amountLocale(options.locale, options.currency)
  const unit = unitOf(reference, options.amountFormat)
  if (unit.suffix) return abbreviatedFigure(Math.abs(value), unit, locale)

  // `stripIfInteger` drops the cents on a round figure, so the counter follows the same rule
  // instead of rolling two zeros the static number never shows.
  const digits = fullFormatter(options)
    .formatToParts(reference)
    .reduce((total, part) => total + (part.type === 'fraction' ? part.value.length : 0), 0)
  return new Intl.NumberFormat(locale, { useGrouping: true, minimumFractionDigits: digits, maximumFractionDigits: digits }).format(
    Math.abs(value),
  )
}
