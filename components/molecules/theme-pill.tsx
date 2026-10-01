'use client'

import { ArrowLeft, Moon, Sun, SunMoon } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { cn } from '@/lib/utils'
import { useThemeChoice } from '@/components/theme/use-theme-choice'

const THEME_OPTIONS = [
  { value: 'light', label: 'claro', Icon: Sun, pop: '[--pop-rotate:-120deg]' },
  { value: 'dark', label: 'oscuro', Icon: Moon, pop: '[--pop-rotate:60deg]' },
  { value: null, label: 'automatico', Icon: SunMoon, pop: '[--pop-rotate:-180deg]' },
] as const

/** Where a floating control sits on a phone: just under the safe area. */
const FLOATING_TOP = 'top-[max(0.75rem,env(safe-area-inset-top))]'

/**
 * The onboarding's floating theme control (`onboarding` → *A floating theme control on every
 * step*, D13): light / dark / automatic on a glass pill, fixed top-right, under sheets and their
 * scrim. Automatic is what a browser with no stored choice shows.
 */
export function ThemePill({ className }: { className?: string }) {
  const t = useTranslations('menuCuenta')
  const { theme, applyTheme } = useThemeChoice(null)
  const index = THEME_OPTIONS.findIndex((option) => option.value === theme)

  return (
    <div
      role="radiogroup"
      aria-label={t('tema')}
      data-theme-pill
      className={cn('liquid-glass glass-control fixed right-4 z-30 rounded-full p-1', FLOATING_TOP, className)}
    >
      <div className="segment-track relative grid grid-cols-3 rounded-full">
        <span
          aria-hidden
          className="segment-thumb absolute inset-y-0 left-0 w-10 rounded-full transition-[translate] duration-500 ease-spring motion-reduce:transition-none"
          style={{ translate: `${index * 100}%` }}
        />
        {THEME_OPTIONS.map(({ value, label, Icon, pop }) => {
          const selected = theme === value
          return (
            <button
              key={label}
              type="button"
              role="radio"
              aria-checked={selected}
              aria-label={t(label)}
              onClick={(event) => applyTheme(value, event)}
              className={cn(
                'onboarding-button relative grid size-10 place-items-center rounded-full outline-none focus-visible:outline-2 focus-visible:-outline-offset-2',
                selected ? 'text-brand-ink' : 'text-muted-foreground hover-fine:hover:text-foreground',
              )}
            >
              <Icon key={String(selected)} aria-hidden className={cn('size-5', selected && `animate-segment-pop motion-reduce:animate-none ${pop}`)} />
            </button>
          )
        })}
      </div>
    </div>
  )
}

/** The onboarding's back control: the same glass, 40 px round, top-left (D13). */
export function GlassBackButton({ label, onClick, className }: { label: string; onClick: () => void; className?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className={cn(
        'liquid-glass glass-control onboarding-button fixed left-4 z-30 grid size-10 place-items-center rounded-full text-foreground outline-none focus-visible:outline-2 focus-visible:outline-offset-2',
        FLOATING_TOP,
        className,
      )}
    >
      <ArrowLeft aria-hidden className="size-5" />
    </button>
  )
}
