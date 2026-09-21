'use client'

import { useLayoutEffect } from 'react'

export function ThemeSync() {
  useLayoutEffect(() => {
    try {
      const theme = localStorage.getItem('theme')
      if (theme === 'light' || theme === 'dark') {
        document.documentElement.setAttribute('data-theme', theme)
      }
      if (localStorage.getItem('background') === 'solid') {
        document.documentElement.setAttribute('data-background', 'solid')
      }
    } catch {}
  }, [])

  return null
}
