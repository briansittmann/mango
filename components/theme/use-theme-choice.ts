'use client'

import { useCallback, useSyncExternalStore, type MouseEvent } from 'react'

/** `'light'`, `'dark'`, or `null` for automatic (the OS preference). */
export type ThemeChoice = 'light' | 'dark' | null

const listeners = new Set<() => void>()

function subscribe(listener: () => void) {
  listeners.add(listener)
  window.addEventListener('storage', listener)
  return () => {
    listeners.delete(listener)
    window.removeEventListener('storage', listener)
  }
}

function readStored(): string | null {
  try {
    return localStorage.getItem('theme')
  } catch {
    return null
  }
}

function readServer(): string | null {
  return null
}

/** Writes the choice where the root layout's inline script and `ThemeSync` read it, and tells every hook. */
export function commitTheme(next: ThemeChoice) {
  try {
    if (next) {
      localStorage.setItem('theme', next)
      document.documentElement.setAttribute('data-theme', next)
    } else {
      localStorage.setItem('theme', 'system')
      document.documentElement.removeAttribute('data-theme')
    }
  } catch {}
  // The attribute above is what the view transition captures; the controls re-render from the store.
  for (const listener of listeners) listener()
}

/**
 * A browser with no stored choice gets automatic stored (`theming` → *Theme selection*, the
 * onboarding's case): the page follows the OS from then on, dashboard included. A stored choice
 * is kept.
 */
export function ensureStoredChoice() {
  if (readStored() === null) commitTheme(null)
}

/**
 * The theme control's state and the one way of applying a choice (`add-web-onboarding` D13): the
 * account menu and the onboarding's floating pill share it. `fallback` is what a browser with no
 * stored choice shows — dark in the menu, automatic in the onboarding.
 */
export function useThemeChoice(fallback: ThemeChoice = 'dark') {
  const stored = useSyncExternalStore(subscribe, readStored, readServer)
  const theme: ThemeChoice = stored === 'system' ? null : stored === 'light' || stored === 'dark' ? stored : fallback

  const applyTheme = useCallback(
    (next: ThemeChoice, event: MouseEvent<HTMLButtonElement>) => {
      if (next === theme) return
      if (!document.startViewTransition || matchMedia('(prefers-reduced-motion: reduce)').matches) {
        commitTheme(next)
        return
      }
      // The new theme spreads from the pressed button as a circle: the repo's --ease-drawer, 700 ms.
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
    },
    [theme],
  )

  return { theme, applyTheme, commitTheme, ensureStoredChoice }
}
