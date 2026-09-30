'use client'

import { useLayoutEffect } from 'react'

// Landing and login are dark regardless of the user's theme. The inline script in the root layout
// covers a direct load; this covers client navigation in and out, restoring the stored choice on leave.
export function ForceDarkTheme() {
  useLayoutEffect(() => {
    const root = document.documentElement
    root.setAttribute('data-theme', 'dark')
    return () => {
      try {
        const theme = localStorage.getItem('theme')
        if (theme === 'system') root.removeAttribute('data-theme')
        else root.setAttribute('data-theme', theme === 'light' ? 'light' : 'dark')
      } catch {
        root.removeAttribute('data-theme')
      }
    }
  }, [])

  return null
}
