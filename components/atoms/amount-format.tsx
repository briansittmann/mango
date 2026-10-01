'use client'

import { createContext, useContext, useMemo, type ReactNode } from 'react'
import { useLocale } from 'next-intl'
// The formatter lives with the data contracts so the bot shares it (add-web-onboarding D12); it is
// a pure function over `Intl`, not data access.
// eslint-disable-next-line @typescript-eslint/no-restricted-imports
import { formatAmount, formatAmountFigure, formatAmountParts, type AmountFormat, type AmountParts } from '@/lib/data/amount-format'

/**
 * The amount format in effect for the mounted page (`localization` → *Amount format preference*).
 * Complete by default, so `/demo` and every mount that supplies none need no provider.
 */
const AmountFormatContext = createContext<AmountFormat>('completo')

export function AmountFormatProvider({ format, children }: { format: AmountFormat; children: ReactNode }) {
  return <AmountFormatContext.Provider value={format}>{children}</AmountFormatContext.Provider>
}

export function useAmountFormat(): AmountFormat {
  return useContext(AmountFormatContext)
}

export type AmountFormatter = {
  /** The whole amount: `2.400 €`, `$ 350k`. */
  money(amount: number, currency: string, signDisplay?: Intl.NumberFormatOptions['signDisplay']): string
  parts(amount: number, currency: string, signDisplay?: Intl.NumberFormatOptions['signDisplay']): AmountParts
  /** The number only, unsigned, in the unit of `reference` (a counter's target). */
  figure(value: number, currency: string, reference?: number): string
}

/** A formatter bound to the active locale and the format in effect; its functions are stable. */
export function useAmountFormatter(): AmountFormatter {
  const locale = useLocale()
  const amountFormat = useAmountFormat()
  return useMemo(
    () => ({
      money: (amount, currency, signDisplay) => formatAmount(amount, { locale, currency, amountFormat, signDisplay }),
      parts: (amount, currency, signDisplay) => formatAmountParts(amount, { locale, currency, amountFormat, signDisplay }),
      figure: (value, currency, reference) => formatAmountFigure(value, { locale, currency, amountFormat, reference }),
    }),
    [locale, amountFormat],
  )
}
