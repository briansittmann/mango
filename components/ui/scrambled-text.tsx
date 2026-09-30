'use client'

import { useEffect, useRef } from 'react'
import { gsap } from 'gsap'
import { ScrambleTextPlugin } from 'gsap/ScrambleTextPlugin'
import { SplitText } from 'gsap/SplitText'
import { cn } from '@/lib/utils'

gsap.registerPlugin(SplitText, ScrambleTextPlugin)

// Adapted from React Bits' Scrambled Text: the letters near the pointer scramble and settle back,
// faster the closer they are. Each letter keeps its measured width so the line never jitters.
export function ScrambledText({
  text,
  className,
  radius = 60,
  duration = 1.2,
  speed = 0.5,
  scrambleChars = '.:',
}: {
  text: string
  className?: string
  radius?: number
  duration?: number
  speed?: number
  scrambleChars?: string
}) {
  const root = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    const element = root.current
    if (!element || !window.matchMedia('(prefers-reduced-motion: no-preference)').matches) return

    let cancelled = false
    let split: SplitText | undefined
    let chars: HTMLElement[] = []
    // Widths measured before the web font lands would be the fallback's.
    document.fonts.ready.then(() => {
      if (cancelled) return
      split = SplitText.create(element, { type: 'chars', charsClass: 'inline-block text-center' })
      chars = split.chars as HTMLElement[]
      chars.forEach((char) => {
        char.dataset.content = char.textContent ?? ''
        char.style.width = `${char.getBoundingClientRect().width}px`
      })
    })

    function onMove(event: PointerEvent) {
      chars.forEach((char) => {
        const { left, top, width, height } = char.getBoundingClientRect()
        const distance = Math.hypot(event.clientX - (left + width / 2), event.clientY - (top + height / 2))
        if (distance < radius) {
          gsap.to(char, {
            overwrite: true,
            duration: duration * (1 - distance / radius),
            scrambleText: { text: char.dataset.content ?? '', chars: scrambleChars, speed },
            ease: 'none',
          })
        }
      })
    }

    element.addEventListener('pointermove', onMove)
    return () => {
      cancelled = true
      element.removeEventListener('pointermove', onMove)
      gsap.killTweensOf(chars)
      split?.revert()
    }
  }, [text, radius, duration, speed, scrambleChars])

  return (
    <span ref={root} className={cn('inline-block', className)}>
      {text}
    </span>
  )
}
