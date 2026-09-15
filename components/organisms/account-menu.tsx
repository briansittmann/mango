import { useRouter } from 'next/navigation'
import { useLocale, useTranslations } from 'next-intl'
import { useEffect, useLayoutEffect, useRef, useState, type MouseEvent } from 'react'
import { flushSync } from 'react-dom'
import { LogOut, Moon, Sun, SunMoon, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Avatar } from '@/components/atoms/avatar'
import type { DashboardActions } from '@/lib/data/dashboard'

type AccountMenuProps = {
  user: { name: string; phone: string; photoUrl: string | null }
  actions: DashboardActions
  open: boolean
  onClose: () => void
}

type ThemeChoice = 'light' | 'dark' | null

const THEME_OPTIONS = [
  { value: 'light', label: 'claro', Icon: Sun, pop: '[--pop-rotate:-120deg]' },
  { value: 'dark', label: 'oscuro', Icon: Moon, pop: '[--pop-rotate:60deg]' },
  { value: null, label: 'automatico', Icon: SunMoon, pop: '[--pop-rotate:-180deg]' },
] as const

const LANGUAGE_OPTIONS = [
  { value: 'es', label: 'espanol' },
  { value: 'en', label: 'ingles' },
] as const

const enterClassName =
  'transition-[opacity,translate] duration-700 ease-spring starting:translate-y-3 starting:opacity-0 motion-reduce:transition-none'

const trackClassName = 'segment-track group relative grid rounded-[22px] p-1 text-label-ui'

const thumbClassName =
  'segment-thumb absolute inset-y-1 left-1 rounded-[18px] transition-[translate,scale] duration-500 ease-spring group-active:scale-[0.96] motion-reduce:transition-none'

const segmentClassName =
  'relative flex items-center justify-center rounded-[18px] transition-[color,scale] duration-200 active:scale-95 focus-visible:outline-2 focus-visible:-outline-offset-2 disabled:pointer-events-none'

export function AccountMenu({ user, actions, open, onClose }: AccountMenuProps) {
  const t = useTranslations('menuCuenta')
  const locale = useLocale()
  const router = useRouter()
  const dialogRef = useRef<HTMLDivElement>(null)
  const [mounted, setMounted] = useState(open)
  const [pendingLocale, setPendingLocale] = useState<string | null>(null)
  const [theme, setTheme] = useState<ThemeChoice>(() => {
    try {
      const stored = localStorage.getItem('theme')
      return stored === 'light' || stored === 'dark' ? stored : null
    } catch {
      return null
    }
  })

  if (open && !mounted) setMounted(true)

  useEffect(() => {
    if (open) return
    const timeout = setTimeout(() => setMounted(false), 250)
    return () => clearTimeout(timeout)
  }, [open])

  useEffect(() => {
    if (!open) return
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [open, onClose])

  useLayoutEffect(() => {
    const dialog = dialogRef.current
    if (!open || !dialog) return
    const anchor = document.querySelector('[aria-controls="account-menu"]')?.getBoundingClientRect()
    if (anchor) {
      dialog.style.setProperty('--anchor-top', `${anchor.bottom + 8}px`)
      dialog.style.setProperty('--anchor-right', `${document.documentElement.clientWidth - anchor.right}px`)
    }
    dialog.focus({ preventScroll: true })
  }, [open])

  function commitTheme(next: ThemeChoice) {
    flushSync(() => setTheme(next))
    try {
      if (next) {
        localStorage.setItem('theme', next)
        document.documentElement.setAttribute('data-theme', next)
      } else {
        localStorage.removeItem('theme')
        document.documentElement.removeAttribute('data-theme')
      }
    } catch {}
  }

  function applyTheme(next: ThemeChoice, event: MouseEvent<HTMLButtonElement>) {
    if (next === theme) return
    if (!document.startViewTransition || matchMedia('(prefers-reduced-motion: reduce)').matches) {
      commitTheme(next)
      return
    }
    const root = document.documentElement
    const { left, top, width, height } = event.currentTarget.getBoundingClientRect()
    const x = left + width / 2
    const y = top + height / 2
    const radius = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y))
    root.classList.add('theme-switching')
    const transition = document.startViewTransition(() => commitTheme(next))
    transition.ready.then(() => {
      root.animate(
        { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${radius}px at ${x}px ${y}px)`] },
        { duration: 700, easing: 'cubic-bezier(0.32, 0.72, 0, 1)', pseudoElement: '::view-transition-new(root)' },
      )
    })
    transition.finished.finally(() => root.classList.remove('theme-switching'))
  }

  const activeLocale = pendingLocale ?? locale

  async function applyLanguage(next: 'es' | 'en') {
    if (next === activeLocale) return
    setPendingLocale(next)
    await actions.changeLanguage?.(next)
    router.refresh()
  }

  if (!mounted) return null

  const themeIndex = THEME_OPTIONS.findIndex((option) => option.value === theme)
  const localeIndex = LANGUAGE_OPTIONS.findIndex((option) => option.value === activeLocale)

  return (
    <>
      <button
        type="button"
        tabIndex={-1}
        onClick={onClose}
        aria-label={t('cerrarMenu')}
        className={cn(
          'fixed inset-0 z-40 bg-scrim backdrop-blur-[8px] transition-opacity starting:opacity-0 motion-reduce:transition-none sm:bg-transparent sm:backdrop-blur-none',
          open ? 'duration-300' : 'pointer-events-none opacity-0 duration-200',
        )}
      />
      <div
        ref={dialogRef}
        id="account-menu"
        role="dialog"
        aria-modal="true"
        aria-labelledby="account-menu-title"
        tabIndex={-1}
        className={cn(
          'liquid-glass fixed inset-x-3 bottom-[max(0.75rem,env(safe-area-inset-bottom))] z-50 mx-auto max-h-[calc(100dvh-1.5rem)] max-w-[440px] overflow-y-auto overscroll-contain rounded-[32px] px-5 pb-5 pt-2.5 outline-none transition-[translate,scale,opacity] motion-reduce:transition-none',
          'starting:translate-y-[calc(100%+1.5rem)] starting:opacity-0',
          'sm:inset-x-auto sm:bottom-auto sm:right-(--anchor-right) sm:top-(--anchor-top) sm:w-[344px] sm:origin-top-right sm:rounded-[28px] sm:p-4 sm:starting:-translate-y-3 sm:starting:scale-90',
          open
            ? 'duration-500 ease-spring'
            : 'pointer-events-none translate-y-[calc(100%+1.5rem)] opacity-0 duration-200 ease-in sm:-translate-y-2 sm:scale-95',
        )}
      >
        <div aria-hidden className="mx-auto mb-3 h-1 w-9 rounded-full bg-handle sm:hidden" />
        <h2 id="account-menu-title" className="sr-only">
          {t('menuDeCuenta')}
        </h2>

        <div className={`flex items-center gap-3.5 ${enterClassName}`}>
          <Avatar
            name={user.name}
            photoUrl={user.photoUrl}
            className="size-12 text-headline-sm shadow-[0_0_0_4px_color-mix(in_oklab,var(--brand)_14%,transparent)] transition-[scale,rotate,box-shadow] duration-500 ease-bounce hover:-rotate-6 hover:scale-110 hover:shadow-[0_0_0_6px_color-mix(in_oklab,var(--brand)_28%,transparent),0_8px_24px_-6px_color-mix(in_oklab,var(--brand)_45%,transparent)]"
          />
          <div className="min-w-0 flex-1">
            <p className="truncate font-display text-headline-sm text-foreground">{user.name}</p>
            <p className="truncate text-body-sm text-muted-foreground">{user.phone}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t('cerrarMenu')}
            className="group -mr-2 grid size-11 shrink-0 place-items-center rounded-full outline-none"
          >
            <span className="grid size-8 place-items-center rounded-full bg-foreground/[0.06] text-muted-foreground transition-[background-color,color,scale] duration-200 group-hover:bg-foreground/10 group-hover:text-foreground group-focus-visible:outline-2 group-active:scale-90">
              <X aria-hidden className="size-4" />
            </span>
          </button>
        </div>

        <div className={`mt-6 ${enterClassName}`} style={{ transitionDelay: '50ms' }}>
          <p id="account-menu-theme" className="mb-2 px-1 text-body-sm text-muted-foreground">
            {t('tema')}
          </p>
          <div role="radiogroup" aria-labelledby="account-menu-theme" className={`${trackClassName} grid-cols-3`}>
            <span
              aria-hidden
              className={`${thumbClassName} w-[calc((100%-0.5rem)/3)]`}
              style={{ translate: `${themeIndex * 100}%` }}
            />
            {THEME_OPTIONS.map(({ value, label, Icon, pop }) => {
              const selected = theme === value
              return (
                <button
                  key={label}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={(event) => applyTheme(value, event)}
                  className={cn(
                    segmentClassName,
                    'h-[68px] flex-col gap-1.5',
                    selected ? 'text-foreground' : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  <Icon
                    key={String(selected)}
                    aria-hidden
                    className={cn('size-5', selected && `animate-segment-pop text-brand-ink motion-reduce:animate-none ${pop}`)}
                  />
                  {t(label)}
                </button>
              )
            })}
          </div>
        </div>

        <div className={`mt-4 ${enterClassName}`} style={{ transitionDelay: '100ms' }}>
          <p id="account-menu-language" className="mb-2 px-1 text-body-sm text-muted-foreground">
            {t('idioma')}
          </p>
          <div
            role="radiogroup"
            aria-labelledby="account-menu-language"
            className={cn(trackClassName, 'grid-cols-2', !actions.changeLanguage && 'opacity-40')}
          >
            <span
              aria-hidden
              className={`${thumbClassName} w-[calc((100%-0.5rem)/2)]`}
              style={{ translate: `${localeIndex * 100}%` }}
            />
            {LANGUAGE_OPTIONS.map(({ value, label }) => {
              const selected = activeLocale === value
              return (
                <button
                  key={value}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  disabled={!actions.changeLanguage}
                  onClick={() => applyLanguage(value)}
                  className={cn(
                    segmentClassName,
                    'h-11',
                    selected ? 'font-semibold text-foreground' : 'text-muted-foreground hover:text-foreground',
                  )}
                >
                  {t(label)}
                </button>
              )
            })}
          </div>
        </div>

        <div className={`mt-6 ${enterClassName}`} style={{ transitionDelay: '150ms' }}>
          <button
            type="button"
            onClick={actions.signOut}
            disabled={!actions.signOut}
            className="group flex h-12 w-full items-center justify-center gap-2 rounded-[18px] bg-destructive/[0.08] text-body-md font-semibold text-destructive transition-[background-color,box-shadow,scale] duration-200 hover:bg-destructive/[0.16] hover:shadow-[inset_0_0_0_1px_color-mix(in_oklab,var(--destructive)_40%,transparent)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-destructive active:scale-[0.98]"
          >
            <LogOut aria-hidden className="size-4 transition-[translate] duration-500 ease-bounce group-hover:translate-x-1" />
            {t('cerrarSesion')}
          </button>
        </div>
      </div>
    </>
  )
}
