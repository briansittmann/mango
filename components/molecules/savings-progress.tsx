import { Check } from 'lucide-react'
import { useFormatter, useTranslations } from 'next-intl'
import { currencyFormatOptions } from '@/i18n/formats'
import { ProgressBar } from '@/components/atoms/progress-bar'
import type { SavingsProgress } from '@/lib/data/savings'

type SavingsProgressBarProps = {
  progress: SavingsProgress
  currency: string
}

export function SavingsProgressBar({ progress, currency }: SavingsProgressBarProps) {
  const t = useTranslations('resumen')
  const format = useFormatter()

  const caption = t('progresoAhorro', {
    ahorrado: format.number(progress.net),
    meta: format.number(progress.target),
  })
  const valueText = t('progresoAhorroDetalle', {
    ahorrado: format.number(progress.net, { ...currencyFormatOptions, currency }),
    meta: format.number(progress.target, { ...currencyFormatOptions, currency }),
  })

  return (
    <div className="mt-2 w-full">
      <div className="relative">
        <ProgressBar usage={progress.netRatio} level="ok" hatchedTo={progress.depositedRatio} valueText={valueText} />
        {progress.reached ? (
          <Check
            role="img"
            aria-label={t('metaAlcanzada')}
            className="pointer-events-none absolute right-0 top-1/2 size-3.5 -translate-y-1/2 text-brand-ink"
          />
        ) : null}
      </div>
      <p className="mt-1 truncate text-body-sm text-muted-foreground">{caption}</p>
    </div>
  )
}
