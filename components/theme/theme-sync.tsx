'use client'

import { useLayoutEffect } from 'react'

/** Paths where a browser with no stored choice follows the OS instead of dark (add-web-onboarding D13). */
function followsSystemByDefault(pathname: string): boolean {
  return pathname.startsWith('/onboarding') || pathname.startsWith('/demo/onboarding')
}

export function ThemeSync() {
  useLayoutEffect(() => {
    // The landing's phone (`/demo?embed=1`) is dark like the landing itself; the root layout's
    // inline script already set it, whatever the demo's own theme choice.
    if (location.pathname === '/demo' && new URLSearchParams(location.search).get('embed') === '1') return
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
