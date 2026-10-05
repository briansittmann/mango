import { useRouter } from 'next/navigation'
import { useLocale, useTranslations } from 'next-intl'
import { useEffect, useLayoutEffect, useRef, useState, type RefObject } from 'react'
import { Check, ChevronRight, Download, Loader2, LogOut, Moon, Sun, SunMoon, UserRound, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Avatar } from '@/components/atoms/avatar'
import { useThemeChoice } from '@/components/theme/use-theme-choice'
import type { DashboardActions } from '@/lib/data/dashboard'
import { placeAnchored, type AnchorPlacement } from '@/lib/ui/anchor'
// A pure formatter over the stored number, not data access (add-whatsapp-linking D8).
// eslint-disable-next-line @typescript-eslint/no-restricted-imports
import { formatPhone } from '@/lib/data/phone'

type AccountMenuProps = {
  user: { name: string; phone: string | null; photoUrl: string | null }
  actions: DashboardActions
  open: boolean
  onClose: () => void
  /** Opens the account sheet (D16); absent when the page supplies no profile operations, so the row is disabled. */
  onOpenAccount?: () => void
  /** Downloads the displayed cycle as CSV; absent when the page has nothing to export. */
  onDownloadCsv?: () => void
  /**
   * The control the popover is placed from at `sm` and wider (`desktop-shell` → *Anchored popovers
   * stay on screen*): the avatar below `lg`, the sidebar's account card at `lg`. Without it the
   * first `[aria-controls="account-menu"]` in the document is used.
   */
  opener?: RefObject<HTMLElement | null>
  placement?: AnchorPlacement
}

type BackgroundChoice = 'dynamic' | 'solid'

const THEME_OPTIONS = [
  { value: 'light', label: 'claro', Icon: Sun, pop: '[--pop-rotate:-120deg]' },
  { value: 'dark', label: 'oscuro', Icon: Moon, pop: '[--pop-rotate:60deg]' },
  { value: null, label: 'automatico', Icon: SunMoon, pop: '[--pop-rotate:-180deg]' },
] as const

const BACKGROUND_OPTIONS = [
  { value: 'dynamic', label: 'dinamico' },
  { value: 'solid', label: 'solido' },
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

export function AccountMenu({ user, actions, open, onClose, onOpenAccount, onDownloadCsv, opener, placement = 'below-end' }: AccountMenuProps) {
  const t = useTranslations('menuCuenta')
  const locale = useLocale()
  const router = useRouter()
  const dialogRef = useRef<HTMLDivElement>(null)
  const [mounted, setMounted] = useState(open)
  const [pendingLocale, setPendingLocale] = useState<string | null>(null)
  const [signingOut, setSigningOut] = useState(false)
  const [downloaded, setDownloaded] = useState(false)

  useEffect(() => {
    if (!downloaded) return
    const timeout = setTimeout(() => setDownloaded(false), 1800)
    return () => clearTimeout(timeout)
  }, [downloaded])

  function handleDownload() {
    if (downloaded || !onDownloadCsv) return
    onDownloadCsv()
    setDownloaded(true)
  }
  // One implementation with the onboarding's floating pill (add-web-onboarding D13); dark when nothing is stored.
  const { theme, applyTheme } = useThemeChoice('dark')
  const [background, setBackground] = useState<BackgroundChoice>(() => {
    try {
      return localStorage.getItem('background') === 'solid' ? 'solid' : 'dynamic'
    } catch {
      return 'dynamic'
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
    const anchorElement = opener?.current ?? document.querySelector('[aria-controls="account-menu"]')
    const anchor = anchorElement?.getBoundingClientRect()
    if (anchor) {
      // Clamped to the viewport from the opener's rect, scaling from the opener's side (D5).
      const placed = placeAnchored(
        anchor,
        { width: dialog.offsetWidth, height: dialog.offsetHeight },
        { width: document.documentElement.clientWidth, height: window.innerHeight },
        placement,
      )
      dialog.style.setProperty('--anchor-top', `${placed.top}px`)
      dialog.style.setProperty('--anchor-left', `${placed.left}px`)
      dialog.style.setProperty('--anchor-origin', placed.origin)
    }
    dialog.focus({ preventScroll: true })
  }, [open, opener, placement])

  function applyBackground(next: BackgroundChoice) {
    if (next === background) return
    setBackground(next)
    try {
      if (next === 'solid') {
        localStorage.setItem('background', 'solid')
        document.documentElement.setAttribute('data-background', 'solid')
      } else {
        localStorage.removeItem('background')
        document.documentElement.removeAttribute('data-background')
      }
    } catch {}
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
  const backgroundIndex = BACKGROUND_OPTIONS.findIndex((option) => option.value === background)

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
          'sm:inset-x-auto sm:bottom-auto sm:left-(--anchor-left) sm:top-(--anchor-top) sm:w-[344px] sm:origin-(--anchor-origin) sm:rounded-[28px] sm:p-4 sm:starting:translate-y-0 sm:starting:scale-90',
          open
            ? 'duration-500 ease-spring'
            : 'pointer-events-none translate-y-[calc(100%+1.5rem)] opacity-0 duration-200 ease-out sm:translate-y-0 sm:scale-95',
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
            {user.phone && <p className="truncate text-body-sm text-muted-foreground">{formatPhone(user.phone)}</p>}
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

        <div className={`mt-4 ${enterClassName}`} style={{ transitionDelay: '25ms' }}>
          {/* The account sheet's row (D16): disabled when the page supplies no profile operations. */}
          <button
            type="button"
            disabled={!onOpenAccount}
            onClick={onOpenAccount}
            className="pressable flex min-h-row w-full items-center gap-3 rounded-[18px] bg-foreground/[0.04] px-4 text-left text-body-lg text-foreground disabled:opacity-40"
          >
            <UserRound aria-hidden className="size-5 text-muted-foreground" />
            <span className="flex-1">{t('cuenta')}</span>
            <ChevronRight aria-hidden className="size-4 text-muted-foreground" />
          </button>
          {/* The displayed cycle as CSV: the row tints brand and the arrow drops into a check once the file is out. */}
          <button
            type="button"
            disabled={!onDownloadCsv}
            aria-live="polite"
            onClick={handleDownload}
            className={cn(
              'pressable group mt-2 flex min-h-row w-full items-center gap-3 overflow-hidden rounded-[18px] px-4 text-left text-body-lg transition-[background-color,color,box-shadow] duration-300 ease-out disabled:opacity-40 motion-reduce:transition-none',
              downloaded
                ? 'bg-brand/[0.14] text-brand-ink shadow-[inset_0_0_0_1px_color-mix(in_oklab,var(--brand)_35%,transparent)]'
                : 'bg-foreground/[0.04] text-foreground hover:bg-foreground/[0.07]',
            )}
          >
            <span className="relative grid size-5 shrink-0 place-items-center">
              <Download
                aria-hidden
                className={cn(
                  'absolute size-5 text-muted-foreground transition-[translate,opacity,scale] duration-300 ease-spring group-hover:translate-y-0.5 motion-reduce:transition-none',
                  downloaded && 'translate-y-3 scale-50 opacity-0',
                )}
              />
              <Check
                aria-hidden
                className={cn(
                  'absolute size-5 text-brand-ink transition-[translate,opacity,scale] duration-500 ease-bounce motion-reduce:transition-none',
                  downloaded ? 'translate-y-0 scale-100 opacity-100 delay-100' : '-translate-y-3 scale-50 opacity-0',
                )}
              />
            </span>
            <span className="relative flex-1">
              <span className={cn('block transition-[translate,opacity] duration-300 ease-out motion-reduce:transition-none', downloaded && '-translate-y-2 opacity-0')}>
                {t('descargarCsv')}
              </span>
              <span
                className={cn(
                  'absolute inset-0 block font-semibold transition-[translate,opacity] duration-300 ease-out motion-reduce:transition-none',
                  downloaded ? 'translate-y-0 opacity-100 delay-75' : 'translate-y-2 opacity-0',
                )}
              >
                {t('csvListo')}
              </span>
            </span>
            <span
              className={cn(
                'rounded-full px-2 py-0.5 text-label-ui font-semibold uppercase tracking-wide transition-colors duration-300 motion-reduce:transition-none',
                downloaded ? 'bg-brand/[0.18] text-brand-ink' : 'bg-foreground/[0.06] text-muted-foreground',
              )}
            >
              {t('csvSigla')}
            </span>
          </button>
        </div>

        <div className={`mt-4 ${enterClassName}`} style={{ transitionDelay: '50ms' }}>
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

        <div className={`mt-4 ${enterClassName}`} style={{ transitionDelay: '75ms' }}>
          <p id="account-menu-background" className="mb-2 px-1 text-body-sm text-muted-foreground">
            {t('fondo')}
          </p>
          <div role="radiogroup" aria-labelledby="account-menu-background" className={`${trackClassName} grid-cols-2`}>
            <span
              aria-hidden
              className={`${thumbClassName} w-[calc((100%-0.5rem)/2)]`}
              style={{ translate: `${backgroundIndex * 100}%` }}
            />
            {BACKGROUND_OPTIONS.map(({ value, label }) => {
              const selected = background === value
              return (
                <button
                  key={value}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => applyBackground(value)}
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
          {/* On tap the button folds into a round spinner that stays until the redirect replaces the page. */}
          <button
            type="button"
            onClick={() => {
              if (signingOut || !actions.signOut) return
              setSigningOut(true)
              actions.signOut()
            }}
            disabled={!actions.signOut}
            aria-disabled={signingOut || undefined}
            aria-busy={signingOut || undefined}
            className={cn(
              'group relative mx-auto flex h-12 items-center justify-center overflow-hidden whitespace-nowrap bg-destructive/[0.08] text-body-md font-semibold text-destructive transition-[width,border-radius,background-color,box-shadow,scale] duration-300 ease-out focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-destructive active:scale-[0.98] motion-reduce:transition-none',
              signingOut
                ? 'w-12 rounded-[24px]'
                : 'w-full rounded-[18px] hover:bg-destructive/[0.16] hover:shadow-[inset_0_0_0_1px_color-mix(in_oklab,var(--destructive)_40%,transparent)]',
            )}
          >
            <span className={cn('flex items-center gap-2 transition-opacity duration-150 motion-reduce:transition-none', signingOut && 'opacity-0')}>
              <LogOut aria-hidden className="size-4 transition-[translate] duration-500 ease-bounce group-hover:translate-x-1" />
              {t('cerrarSesion')}
            </span>
            <Loader2
              aria-hidden
              className={cn(
                'absolute inset-0 m-auto size-5 animate-spin transition-opacity duration-200 motion-reduce:transition-none',
                signingOut ? 'opacity-100 delay-150' : 'opacity-0',
              )}
            />
          </button>
        </div>
      </div>
    </>
  )
}
