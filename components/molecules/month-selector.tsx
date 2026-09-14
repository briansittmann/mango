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
      <div className="flex h-12 items-center rounded-full border border-border bg-card px-0.5">
        <button
          type="button"
          onClick={onPrevious}
          disabled={!onPrevious}
          aria-label={t('cicloAnterior')}
          className="grid size-11 place-items-center rounded-full text-muted-foreground transition-colors hover:text-foreground disabled:pointer-events-none disabled:opacity-30"
        >
          <ChevronLeft aria-hidden className="size-5" />
        </button>
        <span className="min-w-[158px] text-center font-display text-headline-sm capitalize text-foreground">
          {monthName}
        </span>
        <button
          type="button"
          onClick={onNext}
          disabled={!onNext}
          aria-label={t('cicloSiguiente')}
          className="grid size-11 place-items-center rounded-full text-muted-foreground transition-colors hover:text-foreground disabled:pointer-events-none disabled:opacity-30"
        >
          <ChevronRight aria-hidden className="size-5" />
        </button>
      </div>
      {inProgress ? (
        <span className="rounded-full bg-brand/10 px-2.5 py-1 text-label-caps uppercase text-brand-ink">
          {t('enCurso')}
        </span>
      ) : null}
    </div>
  )
}
