'use client'

import { useEffect, useState } from 'react'
import { ColorBends } from '@/components/ui/color-bends'

// The bands take the theme's brand green, so the background reads as the same product in both.
const BEND_COLOR = { light: '#3DBE73', dark: '#84CC16' }

/** Whether the page is painted dark, following the stored choice or, on automatic, the OS. */
export function useDarkTheme() {
  const [dark, setDark] = useState(true)

  useEffect(() => {
    const root = document.documentElement
    const media = matchMedia('(prefers-color-scheme: dark)')
    function read() {
      const theme = root.getAttribute('data-theme')
      setDark(theme === 'dark' || (theme !== 'light' && media.matches))
    }
    read()
    const observer = new MutationObserver(read)
    observer.observe(root, { attributeFilter: ['data-theme'] })
    media.addEventListener('change', read)
    return () => {
      observer.disconnect()
      media.removeEventListener('change', read)
    }
  }, [])

  return dark
}

/**
 * The animated layer over the solid shell. Off when the account menu stored `solid`, and inside a
 * frame: the landing embeds `/demo` in its phone, over its own background.
 */
export function DynamicBackground() {
  const dark = useDarkTheme()
  const [enabled, setEnabled] = useState(false)

  useEffect(() => {
    const root = document.documentElement
    function read() {
      setEnabled(root.getAttribute('data-background') !== 'solid' && window.self === window.top)
    }
    read()
    const observer = new MutationObserver(read)
    observer.observe(root, { attributeFilter: ['data-background'] })
    return () => observer.disconnect()
  }, [])

  if (!enabled) return null

  return (
    <div
      aria-hidden
      // The layer is fixed, so scrolled content always sits over the un-faded part of the bands:
      // what reads as a hero backdrop at full strength is too loud behind a whole dashboard.
      // `h-lvh` and not `inset-0`: the mobile toolbar collapsing mid-scroll would otherwise resize
      // the canvas, and a resize clears it, which flashed the page black while the finger was down.
      className="pointer-events-none fixed inset-x-0 top-0 -z-10 h-lvh opacity-40 transition-opacity duration-1000 ease-out starting:opacity-0 motion-reduce:transition-none"
    >
      <ColorBends color={dark ? BEND_COLOR.dark : BEND_COLOR.light} className="size-full" />
    </div>
  )
}
