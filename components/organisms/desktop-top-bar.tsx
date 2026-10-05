'use client'

import { Plus } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { MonthSelector } from '@/components/molecules/month-selector'
import { ThemeToggle } from '@/components/molecules/theme-toggle'
import type { DashboardActions, DashboardData } from '@/lib/data/dashboard'

type DesktopTopBarProps = {
  floating: boolean
  pushedBack: boolean
  hidden: boolean
  cycle: DashboardData['cycle']
  actions: Pick<DashboardActions, 'previousCycle' | 'nextCycle' | 'selectCycle'>
  /** Opens the entry sheet in create mode (design D7); absent when the page has no expense operations. */
  onAddExpense?: () => void
}

/**
 * The desktop shell's top bar (`desktop-shell` → *Desktop shell at wide viewports*): the cycle
 * controls with the month picker, the status pill and "Añadir gasto". Rendered only from `lg`;
 * the content sits in the bar's lower 72px, which is the floating pill's own height, so nothing
 * moves when the material changes (design D2).
 */
export function DesktopTopBar({ floating, pushedBack, hidden, cycle, actions, onAddExpense }: DesktopTopBarProps) {
  const t = useTranslations('escritorio')
  const tDashboard = useTranslations('dashboard')

  return (
    <header
      data-desktop-top-bar
      data-floating={floating ? '' : undefined}
      data-pushed-back={pushedBack ? '' : undefined}
      aria-hidden={hidden || undefined}
      inert={hidden}
      className="desktop-shell fixed left-[272px] right-0 top-0 z-30 hidden h-[88px] lg:block"
    >
      <div aria-hidden className="shell-rest shell-rest--bar" />
      <div aria-hidden className="shell-material shell-material--bar" data-shell-material />
      <div className="absolute bottom-0 left-2 right-6 top-4 flex items-center">
        <div className="mx-auto flex w-full max-w-[1120px] items-center justify-between gap-4 px-6">
          <div className="flex min-w-0 items-center gap-3">
            <MonthSelector
              variant="compact"
              month={cycle.month}
              start={cycle.start}
              end={cycle.end}
              inProgress={cycle.inProgress}
              projected={cycle.projected}
              currentMonth={cycle.currentMonth}
              maxMonth={cycle.maxMonth}
              onPrevious={actions.previousCycle}
              onNext={actions.nextCycle}
              onSelect={actions.selectCycle}
            />
            {cycle.inProgress ? (
              <span data-cycle-status="en-curso" className="flex items-center gap-1.5 rounded-full bg-brand/[0.12] px-2.5 py-1 text-label-ui font-medium text-brand-ink">
                <span aria-hidden className="size-1.5 rounded-full bg-brand-ink" />
                {t('enCurso')}
              </span>
            ) : cycle.projected ? (
              <span data-cycle-status="proyeccion" className="flex items-center gap-1.5 rounded-full bg-foreground/[0.06] px-2.5 py-1 text-label-ui font-medium text-muted-foreground">
                <span aria-hidden className="size-1.5 rounded-full border border-current" />
                {tDashboard('proyeccion')}
              </span>
            ) : null}
          </div>
          <div className="flex shrink-0 items-center gap-3">
            <ThemeToggle />
            <button
              type="button"
              onClick={onAddExpense}
              disabled={!onAddExpense}
              data-add-expense
              className="pressable flex h-10 shrink-0 items-center gap-1.5 rounded-full bg-primary pl-3 pr-4 text-body-md font-semibold text-primary-foreground [--press-scale:0.96] disabled:pointer-events-none disabled:opacity-40"
            >
              <Plus aria-hidden className="size-4" />
              {t('anadirGasto')}
            </button>
          </div>
        </div>
      </div>
    </header>
  )
}
