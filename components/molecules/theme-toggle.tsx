'use client'

import { Moon, Sun } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useMediaQuery } from '@/components/hooks/use-desktop'
import { useThemeChoice } from '@/components/theme/use-theme-choice'
import { cn } from '@/lib/utils'

const OPTIONS = [
  { value: 'light', label: 'claro', Icon: Sun, pop: '[--pop-rotate:-120deg]' },
  { value: 'dark', label: 'oscuro', Icon: Moon, pop: '[--pop-rotate:60deg]' },
] as const

/**
 * The desktop bar's theme shortcut: the account menu's segmented pill cut down to sun and moon.
 * A choice spreads from the pressed icon as the menu's does (`useThemeChoice`). "Automatic" has
 * no segment here: the thumb then sits on whatever the OS resolves to, and a press makes the
 * choice explicit.
 */
export function ThemeToggle({ className }: { className?: string }) {
  const t = useTranslations('menuCuenta')
  const tEscritorio = useTranslations('escritorio')
  const { theme, applyTheme } = useThemeChoice('dark')
  const osDark = useMediaQuery('(prefers-color-scheme: dark)')
  const current = theme ?? (osDark ? 'dark' : 'light')
  const index = OPTIONS.findIndex((option) => option.value === current)

  return (
    <div role="radiogroup" aria-label={tEscritorio('tema')} data-theme-toggle className={cn('segment-track group relative grid h-10 grid-cols-2 rounded-full p-1', className)}>
      <span
        aria-hidden
        className="segment-thumb absolute inset-y-1 left-1 w-[calc((100%-0.5rem)/2)] rounded-full transition-[translate,scale] duration-500 ease-spring group-active:scale-[0.96] motion-reduce:transition-none"
        style={{ translate: `${index * 100}%` }}
      />
      {OPTIONS.map(({ value, label, Icon, pop }) => {
        const selected = current === value
        return (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-label={t(label)}
            data-theme-option={value}
            onClick={(event) => applyTheme(value, event)}
            className={cn(
              'relative grid w-10 place-items-center rounded-full transition-[color,scale] duration-200 active:scale-95 focus-visible:outline-2 focus-visible:-outline-offset-2',
              selected ? 'text-foreground' : 'text-muted-foreground hover:text-foreground',
            )}
          >
            <Icon key={String(selected)} aria-hidden className={cn('size-4', selected && `animate-segment-pop text-brand-ink motion-reduce:animate-none ${pop}`)} />
          </button>
        )
      })}
    </div>
  )
}
