import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useFormatter, useTranslations } from 'next-intl'

type MonthSelectorProps = {
  month: string
  inProgress: boolean
  onPrevious?: () => void
  onNext?: () => void
}

export function MonthSelector({ month, inProgress, onPrevious, onNext }: MonthSelectorProps) {
  const t = useTranslations('dashboard')
  const format = useFormatter()
  const monthName = format.dateTime(new Date(`${month}-01T00:00:00Z`), { month: 'long', timeZone: 'UTC' })

  return (
    <div className="flex items-center justify-center gap-3">
      <button
        type="button"
        onClick={onPrevious}
        disabled={!onPrevious}
        aria-label={t('cicloAnterior')}
        className="rounded-full p-1 text-muted-foreground transition-colors hover:bg-muted disabled:pointer-events-none disabled:opacity-30"
      >
        <ChevronLeft aria-hidden className="size-5" />
      </button>
      <div className="flex items-baseline gap-2">
        <span className="text-base font-semibold capitalize text-foreground">{monthName}</span>
        {inProgress ? <span className="text-xs text-muted-foreground">{t('enCurso')}</span> : null}
      </div>
      <button
        type="button"
        onClick={onNext}
        disabled={!onNext}
        aria-label={t('cicloSiguiente')}
        className="rounded-full p-1 text-muted-foreground transition-colors hover:bg-muted disabled:pointer-events-none disabled:opacity-30"
      >
        <ChevronRight aria-hidden className="size-5" />
      </button>
    </div>
  )
}
