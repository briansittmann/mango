import { ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react'
import { useFormatter, useTranslations } from 'next-intl'
import { cn } from '@/lib/utils'

type TrendDeltaProps = {
  current: number
  previous: number
  /** Whether a rise is good news (income, savings) or bad (spending). */
  upIsGood: boolean
  /** Read after the figure by assistive technology ("vs ciclo anterior"); hidden from sight. */
  label?: string
  className?: string
}

/** A change under this share of the previous figure is flat: no arrow, muted colour. */
const FLAT_BELOW = 0.01

/**
 * Arrow + signed whole-number percentage against a previous figure (design D6). Good and bad take
 * `--positive` and `--destructive-ink`; flat is the muted text colour; nothing is rendered when
 * the previous figure is zero, because there is no base to compare against.
 */
export function TrendDelta({ current, previous, upIsGood, label, className }: TrendDeltaProps) {
  const format = useFormatter()
  const t = useTranslations('graficos')
  if (previous === 0) return null
  const delta = (current - previous) / Math.abs(previous)
  const flat = Math.abs(delta) < FLAT_BELOW
  const good = flat ? null : delta > 0 === upIsGood
  const text = flat
    ? t('sinCambios')
    : format.number(delta, { style: 'percent', maximumFractionDigits: 0, signDisplay: 'exceptZero' }).replace('-', '−')
  const Icon = flat ? Minus : delta > 0 ? ArrowUpRight : ArrowDownRight

  return (
    <span
      data-trend={flat ? 'flat' : good ? 'good' : 'bad'}
      className={cn(
        'inline-flex items-center gap-0.5 whitespace-nowrap text-label-ui tabular-nums',
        flat ? 'text-muted-foreground' : good ? 'text-positive' : 'text-destructive-ink',
        className,
      )}
    >
      <Icon aria-hidden className="size-3.5 shrink-0" strokeWidth={2.25} />
      <span>{text}</span>
      {label ? <span className="sr-only"> {label}</span> : null}
    </span>
  )
}
