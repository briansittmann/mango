'use client'

import { useLayoutEffect } from 'react'

/** Paths where a browser with no stored choice follows the OS instead of dark (add-web-onboarding D13). */
function followsSystemByDefault(pathname: string): boolean {
  return pathname.startsWith('/onboarding') || pathname.startsWith('/demo/onboarding')
}

export function ThemeSync() {
  useLayoutEffect(() => {
    try {
      const theme = localStorage.getItem('theme')
      if (theme !== 'system' && !(theme === null && followsSystemByDefault(location.pathname))) {
        document.documentElement.setAttribute('data-theme', theme === 'light' ? 'light' : 'dark')
      }
      if (localStorage.getItem('background') === 'solid') {
        document.documentElement.setAttribute('data-background', 'solid')
      }
    } catch {}
  }, [])

  return null
}
