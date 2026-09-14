import { useRouter } from 'next/navigation'
import { useLocale, useTranslations } from 'next-intl'
import { useState } from 'react'
import { Globe, LogOut, Moon, Sun, SunMoon, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Avatar } from '@/components/atoms/avatar'
import { MenuRow } from '@/components/molecules/menu-row'
import type { DashboardActions } from '@/lib/data/dashboard'

type AccountMenuProps = {
  user: { name: string; phone: string; photoUrl: string | null }
  actions: DashboardActions
  open: boolean
  onClose: () => void
}

type ThemeChoice = 'light' | 'dark' | null

const segmentClassName =
  'grid min-h-11 min-w-11 place-items-center rounded-full px-3 text-label-ui transition-colors'

export function AccountMenu({ user, actions, open, onClose }: AccountMenuProps) {
  const t = useTranslations('menuCuenta')
  const locale = useLocale()
  const router = useRouter()
  const [theme, setTheme] = useState<ThemeChoice>(() => {
    try {
      const stored = localStorage.getItem('theme')
      return stored === 'light' || stored === 'dark' ? stored : null
    } catch {
      return null
    }
  })

  function applyTheme(next: ThemeChoice) {
    setTheme(next)
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

  async function applyLanguage(next: 'es' | 'en') {
    await actions.changeLanguage?.(next)
    router.refresh()
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center">
      <button type="button" onClick={onClose} aria-label={t('cerrarMenu')} className="fixed inset-0 z-40 bg-scrim backdrop-blur-[12px]" />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="account-menu-title"
        className="fixed inset-x-0 bottom-0 z-50 mx-auto max-h-[85vh] max-w-[640px] overflow-y-auto rounded-t-sheet border border-b-0 border-border bg-card pb-[env(safe-area-inset-bottom)] shadow-[0_-12px_32px_var(--sheet-shadow)]"
      >
        <div aria-hidden className="mx-auto mt-2.5 h-1 w-9 rounded-full bg-handle" />

        <div className="sticky top-0 flex items-center justify-between bg-card px-4 py-2">
          <h2 id="account-menu-title" className="font-display text-headline-sm">
            {t('menuDeCuenta')}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label={t('cerrarMenu')}
            className="grid size-11 place-items-center rounded-full text-muted-foreground hover:bg-muted"
          >
            <X aria-hidden className="size-5" />
          </button>
        </div>

        <div className="flex items-center gap-3 px-4 py-3">
          <Avatar name={user.name} photoUrl={user.photoUrl} size="sm" />
          <div className="min-w-0">
            <p className="truncate text-body-md font-semibold text-foreground">{user.name}</p>
            <p className="truncate text-body-sm text-muted-foreground">{user.phone}</p>
          </div>
        </div>

        <MenuRow icon={<SunMoon aria-hidden className="size-4 text-brand-ink" />} label={t('tema')}>
          <div className="flex rounded-full bg-muted p-0.5">
            <button
              type="button"
              onClick={() => applyTheme('light')}
              aria-label={t('claro')}
              className={cn(segmentClassName, theme === 'light' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground')}
            >
              <Sun aria-hidden className="size-4" />
            </button>
            <button
              type="button"
              onClick={() => applyTheme('dark')}
              aria-label={t('oscuro')}
              className={cn(segmentClassName, theme === 'dark' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground')}
            >
              <Moon aria-hidden className="size-4" />
            </button>
            <button
              type="button"
              onClick={() => applyTheme(null)}
              aria-label={t('automatico')}
              className={cn(segmentClassName, theme === null ? 'bg-primary text-primary-foreground' : 'text-muted-foreground')}
            >
              <SunMoon aria-hidden className="size-4" />
            </button>
          </div>
        </MenuRow>

        <MenuRow icon={<Globe aria-hidden className="size-4 text-brand-ink" />} label={t('idioma')}>
          <div className="flex rounded-full bg-muted p-0.5">
            <button
              type="button"
              onClick={() => applyLanguage('es')}
              disabled={!actions.changeLanguage}
              className={cn(
                segmentClassName,
                'disabled:pointer-events-none disabled:opacity-40',
                locale === 'es' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground',
              )}
            >
              {t('espanol')}
            </button>
            <button
              type="button"
              onClick={() => applyLanguage('en')}
              disabled={!actions.changeLanguage}
              className={cn(
                segmentClassName,
                'disabled:pointer-events-none disabled:opacity-40',
                locale === 'en' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground',
              )}
            >
              {t('ingles')}
            </button>
          </div>
        </MenuRow>

        <button
          type="button"
          onClick={actions.signOut}
          disabled={!actions.signOut}
          className="flex min-h-12 w-full items-center justify-center gap-2 border-t border-border text-body-md font-semibold text-destructive transition-colors hover:bg-destructive/[0.08] disabled:pointer-events-none disabled:opacity-40"
        >
          <LogOut aria-hidden className="size-4" />
          {t('cerrarSesion')}
        </button>
      </div>
    </div>
  )
}
