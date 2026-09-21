'use client'

import { useEffect, useState } from 'react'
import { ColorBends } from '@/components/ui/color-bends'

// The bands take the theme's brand green, so the background reads as the same product in both.
const BEND_COLOR = { light: '#3DBE73', dark: '#84CC16' }

/** The animated layer over the solid shell. Off when the account menu stored `solid`. */
export function DynamicBackground() {
  const [dark, setDark] = useState(false)
  const [enabled, setEnabled] = useState(false)

  useEffect(() => {
    const root = document.documentElement
    const media = matchMedia('(prefers-color-scheme: dark)')
    function read() {
      const theme = root.getAttribute('data-theme')
      setDark(theme === 'dark' || (theme !== 'light' && media.matches))
      setEnabled(root.getAttribute('data-background') !== 'solid')
    }
    read()
    const observer = new MutationObserver(read)
    observer.observe(root, { attributeFilter: ['data-theme', 'data-background'] })
    media.addEventListener('change', read)
    return () => {
      observer.disconnect()
      media.removeEventListener('change', read)
    }
  }, [])

  if (!enabled) return null

  return (
    <div
      aria-hidden
      // The layer is fixed, so scrolled content always sits over the un-faded part of the bands:
      // what reads as a hero backdrop at full strength is too loud behind a whole dashboard.
      className="pointer-events-none fixed inset-0 -z-10 opacity-40 transition-opacity duration-1000 ease-out starting:opacity-0 motion-reduce:transition-none"
    >
      <ColorBends color={dark ? BEND_COLOR.dark : BEND_COLOR.light} className="size-full" />
    </div>
  )
}
