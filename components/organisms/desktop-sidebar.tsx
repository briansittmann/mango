'use client'

import { useEffect, useLayoutEffect, useRef, useState, type RefObject } from 'react'
import { ChevronUp } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { Avatar } from '@/components/atoms/avatar'
import { CategoryDot } from '@/components/atoms/category-dot'
import { Money } from '@/components/atoms/money'
import { useMediaQuery } from '@/components/hooks/use-desktop'
import { CompositionStrip } from '@/components/molecules/composition-strip'
import { AnimatedAmount } from '@/components/ui/counter/animated-amount'
import type { CategoryColor } from '@/lib/data/dashboard'
import { cn } from '@/lib/utils'
// A pure formatter over the stored number, not data access (add-whatsapp-linking D8).
// eslint-disable-next-line @typescript-eslint/no-restricted-imports
import { formatPhone } from '@/lib/data/phone'

export type SidebarEntry = {
  /** The `id` of the section it leads to. */
  id: string
  label: string
  /** A category entry: its dot and its total for the shown cycle. */
  color?: CategoryColor
  total?: number
}

type DesktopSidebarProps = {
  floating: boolean
  /** A side panel or reorder mode is open: the material drops its blur (design-system → *Translucent materials*). */
  pushedBack: boolean
  hidden: boolean
  entries: SidebarEntry[]
  activeId: string | null
  onNavigate: (id: string) => void
  onScrollTop: () => void
  currency: string
  /** The cycle's four figures, shown one at a time in the block under the list. */
  figures: { income: number; expenses: number; savings: number; freeMargin: number }
  user: { name: string; phone: string | null; photoUrl: string | null }
  accountMenuOpen: boolean
  onOpenAccount: () => void
  accountCardRef: RefObject<HTMLButtonElement | null>
}

const ROW_HEIGHT = 40
/** How long each figure stays before the next one. */
const FIGURE_INTERVAL = 5000
const FIGURE_KEYS = ['income', 'expenses', 'savings', 'freeMargin'] as const

/**
 * The desktop shell's sidebar (`desktop-shell` → *Desktop shell at wide viewports*, design D3):
 * logo, the section list with one travelling highlight, the savings block with the composition
 * strip and the account card that opens the account menu. Rendered only from `lg`.
 */
export function DesktopSidebar({
  floating,
  pushedBack,
  hidden,
  entries,
  activeId,
  onNavigate,
  onScrollTop,
  currency,
  figures,
  user,
  accountMenuOpen,
  onOpenAccount,
  accountCardRef,
}: DesktopSidebarProps) {
  const t = useTranslations('escritorio')
  const tDashboard = useTranslations('dashboard')
  const tResumen = useTranslations('resumen')
  const listRef = useRef<HTMLUListElement>(null)
  const [pillTop, setPillTop] = useState<number | null>(null)
  const activeIndex = entries.findIndex((entry) => entry.id === activeId)

  // The figures block rotates on its own (5 s a face) and rests while the pointer or the focus is
  // on it; under reduced motion it never rotates by itself and the dots are the only way through.
  const reducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)')
  const [figureIndex, setFigureIndex] = useState(0)
  const [figuresHeld, setFiguresHeld] = useState(false)
  useEffect(() => {
    if (reducedMotion || figuresHeld) return
    const timer = setInterval(() => setFigureIndex((index) => (index + 1) % FIGURE_KEYS.length), FIGURE_INTERVAL)
    return () => clearInterval(timer)
  }, [reducedMotion, figuresHeld, figureIndex])
  const figureLabels: Record<(typeof FIGURE_KEYS)[number], string> = {
    income: tResumen('ingresos'),
    expenses: tResumen('gastos'),
    savings: tResumen('ahorro'),
    freeMargin: tDashboard('margenLibre'),
  }
  const figureKey = FIGURE_KEYS[figureIndex]

  // The pill is measured from the active link, so a list that scrolls keeps the highlight on it.
  useLayoutEffect(() => {
    const list = listRef.current
    if (!list || activeIndex < 0) {
      setPillTop(null)
      return
    }
    // The list's first child is the pill itself; the entries are its `li`s.
    const item = list.querySelectorAll<HTMLElement>(':scope > li')[activeIndex]
    setPillTop(item ? item.offsetTop : null)
  }, [activeIndex, entries.length])

  return (
    <aside
      data-desktop-sidebar
      data-floating={floating ? '' : undefined}
      data-pushed-back={pushedBack ? '' : undefined}
      aria-hidden={hidden || undefined}
      inert={hidden}
      className="desktop-shell fixed inset-y-0 left-0 z-30 hidden w-[272px] lg:block"
    >
      <div aria-hidden className="shell-rest shell-rest--sidebar" />
      <div aria-hidden className="shell-material shell-material--sidebar" data-shell-material />
      <div className="absolute inset-y-4 left-4 right-0 flex flex-col pb-3 pl-3 pr-3 pt-3">
        <button
          type="button"
          onClick={onScrollTop}
          aria-label={tDashboard('irArriba')}
          className="pressable -ml-1 flex min-h-target items-center gap-1 self-start rounded-full pr-3 [--press-scale:0.96]"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/mango-logo-light.svg" alt="" aria-hidden className="size-11 object-contain dark:hidden" />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/mango-logo-dark.svg" alt="" aria-hidden className="hidden size-11 object-contain dark:block" />
          <span className="font-display text-headline-md text-foreground">{tDashboard('appName')}</span>
        </button>

        <nav aria-label={t('navegacion')} className="mt-5 min-h-0 flex-1 overflow-y-auto overscroll-contain [scrollbar-width:thin]">
          <ul ref={listRef} className="relative flex flex-col">
            <span
              aria-hidden
              data-shell-nav-pill
              className={cn('shell-nav-pill pointer-events-none absolute inset-x-0 top-0 rounded-xl bg-foreground/[0.06]', pillTop == null && 'opacity-0')}
              style={{ height: ROW_HEIGHT, transform: `translateY(${pillTop ?? 0}px)` }}
            />
            {entries.map((entry) => {
              const current = entry.id === activeId
              return (
                <li key={entry.id} className="relative">
                  <a
                    href={`#${entry.id}`}
                    aria-current={current ? 'true' : undefined}
                    data-shell-nav={entry.id}
                    onClick={(event) => {
                      event.preventDefault()
                      onNavigate(entry.id)
                    }}
                    className={cn(
                      'shell-nav-link flex items-center gap-2.5 rounded-xl px-3 text-body-md outline-none focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-ring',
                      current ? 'font-medium text-foreground' : 'text-muted-foreground hover:text-foreground',
                    )}
                    style={{ height: ROW_HEIGHT }}
                  >
                    {entry.color ? <CategoryDot color={entry.color} className="size-2" /> : null}
                    <span className="min-w-0 flex-1 truncate">{entry.label}</span>
                    {entry.total != null ? (
                      <AnimatedAmount amount={entry.total} currency={currency} className="shrink-0 text-label-ui tabular-nums text-muted-foreground" />
                    ) : null}
                  </a>
                </li>
              )
            })}
          </ul>
        </nav>

        <div
          className="mt-4 border-t border-border/70 px-3 pt-4"
          data-sidebar-figures
          data-figure={figureKey}
          onPointerEnter={(event) => {
            if (event.pointerType !== 'touch') setFiguresHeld(true)
          }}
          onPointerLeave={() => setFiguresHeld(false)}
          onFocus={() => setFiguresHeld(true)}
          onBlur={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setFiguresHeld(false)
          }}
        >
          <div className="flex items-start justify-between gap-3">
            {/* A new key remounts the face, so each figure plays its own entrance (`--animate-stat-in`). */}
            <div key={figureKey} className="min-w-0 animate-stat-in motion-reduce:animate-none" aria-live="polite" aria-atomic>
              <span className="block truncate text-label-ui text-muted-foreground">{figureLabels[figureKey]}</span>
              <Money amount={figures[figureKey]} currency={currency} className="mt-1 block text-headline-sm text-foreground" />
            </div>
            <div role="group" aria-label={t('cifrasDelCiclo')} className="mt-1 flex shrink-0 items-center gap-1">
              {FIGURE_KEYS.map((key, index) => {
                const selected = index === figureIndex
                return (
                  <button
                    key={key}
                    type="button"
                    aria-label={t('mostrarCifra', { nombre: figureLabels[key] })}
                    aria-pressed={selected}
                    data-figure-dot={key}
                    onClick={() => setFigureIndex(index)}
                    className="grid size-5 place-items-center rounded-full outline-none focus-visible:outline-2 focus-visible:outline-ring"
                  >
                    <span
                      aria-hidden
                      className={cn(
                        'block h-1.5 rounded-full transition-[width,background-color] duration-200 ease-out motion-reduce:transition-none',
                        selected ? 'w-3.5 bg-brand-ink' : 'w-1.5 bg-foreground/25 hover:bg-foreground/45',
                      )}
                    />
                  </button>
                )
              })}
            </div>
          </div>
          <CompositionStrip amount={figures.freeMargin} income={figures.income} savings={figures.savings} currency={currency} className="mt-4" instant />
        </div>

        <button
          ref={accountCardRef}
          type="button"
          onClick={onOpenAccount}
          aria-haspopup="dialog"
          aria-expanded={accountMenuOpen}
          aria-controls="account-menu"
          aria-label={t('abrirMenuDeCuenta')}
          data-sidebar-account
          className="pressable mt-4 flex min-h-14 w-full items-center gap-3 rounded-2xl border border-border/70 bg-foreground/[0.02] px-3 text-left hover:bg-foreground/[0.05] [--press-scale:0.98]"
        >
          <Avatar name={user.name} photoUrl={user.photoUrl} />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-body-md font-medium text-foreground">{user.name}</span>
            {user.phone ? <span className="block truncate text-body-sm text-muted-foreground">{formatPhone(user.phone)}</span> : null}
          </span>
          <ChevronUp aria-hidden className="size-4 shrink-0 text-muted-foreground" />
        </button>
      </div>
    </aside>
  )
}
