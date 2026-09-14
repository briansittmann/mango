import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useLocale, useTranslations } from 'next-intl'
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
    <div className="fixed inset-0 z-20 flex items-end justify-center">
      <button type="button" onClick={onClose} aria-label={t('cerrarMenu')} className="absolute inset-0 bg-foreground/40" />
      <div className="relative z-10 flex w-full max-w-lg flex-col gap-1 rounded-t-2xl border border-border bg-card p-4 pb-6">
        <div className="mb-2 flex items-center justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <Avatar name={user.name} photoUrl={user.photoUrl} />
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-foreground">{user.name}</p>
              <p className="truncate text-xs text-muted-foreground">{user.phone}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t('cerrarMenu')}
            className="rounded-full p-1 text-muted-foreground transition-colors hover:bg-muted"
          >
            <X aria-hidden className="size-5" />
          </button>
        </div>

        <MenuRow icon={<SunMoon aria-hidden className="size-4 text-muted-foreground" />} label={t('tema')}>
          <div className="flex gap-1">
            <button
              type="button"
              onClick={() => applyTheme('light')}
              aria-label={t('claro')}
              className={cn(
                'rounded-md p-1.5 transition-colors',
                theme === 'light' ? 'bg-brand/15 text-brand-ink' : 'text-muted-foreground hover:bg-muted',
              )}
            >
              <Sun aria-hidden className="size-4" />
            </button>
            <button
              type="button"
              onClick={() => applyTheme('dark')}
              aria-label={t('oscuro')}
              className={cn(
                'rounded-md p-1.5 transition-colors',
                theme === 'dark' ? 'bg-brand/15 text-brand-ink' : 'text-muted-foreground hover:bg-muted',
              )}
            >
              <Moon aria-hidden className="size-4" />
            </button>
            <button
              type="button"
              onClick={() => applyTheme(null)}
              aria-label={t('automatico')}
              className={cn(
                'rounded-md p-1.5 transition-colors',
                theme === null ? 'bg-brand/15 text-brand-ink' : 'text-muted-foreground hover:bg-muted',
              )}
            >
              <SunMoon aria-hidden className="size-4" />
            </button>
          </div>
        </MenuRow>

        <MenuRow icon={<Globe aria-hidden className="size-4 text-muted-foreground" />} label={t('idioma')}>
          <div className="flex gap-1">
            <button
              type="button"
              onClick={() => applyLanguage('es')}
              disabled={!actions.changeLanguage}
              className={cn(
                'rounded-md px-2 py-1 text-xs font-medium transition-colors disabled:pointer-events-none disabled:opacity-40',
                locale === 'es' ? 'bg-brand/15 text-brand-ink' : 'text-muted-foreground hover:bg-muted',
              )}
            >
              {t('espanol')}
            </button>
            <button
              type="button"
              onClick={() => applyLanguage('en')}
              disabled={!actions.changeLanguage}
              className={cn(
                'rounded-md px-2 py-1 text-xs font-medium transition-colors disabled:pointer-events-none disabled:opacity-40',
                locale === 'en' ? 'bg-brand/15 text-brand-ink' : 'text-muted-foreground hover:bg-muted',
              )}
            >
              {t('ingles')}
            </button>
          </div>
        </MenuRow>

        <MenuRow
          icon={<LogOut aria-hidden className="size-4 text-muted-foreground" />}
          label={t('cerrarSesion')}
          onClick={actions.signOut}
          disabled={!actions.signOut}
        />
      </div>
    </div>
  )
}
