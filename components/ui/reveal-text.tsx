'use client'

import { useLayoutEffect, useRef } from 'react'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { SplitText } from 'gsap/SplitText'

gsap.registerPlugin(ScrollTrigger, SplitText)

// Adapted from React Bits' Blur Text: a paragraph comes into focus word by word as it scrolls in.
export function RevealText({ text, delay = 0, className }: { text: string; delay?: number; className?: string }) {
  const root = useRef<HTMLParagraphElement>(null)

  useLayoutEffect(() => {
    const media = gsap.matchMedia()
    media.add('(prefers-reduced-motion: no-preference)', () => {
      const split = SplitText.create(root.current, {
        type: 'words',
        autoSplit: true,
        onSplit: (self) =>
          gsap.from(self.words, {
            opacity: 0,
            y: 10,
            filter: 'blur(10px)',
            duration: 0.9,
            ease: 'power3.out',
            stagger: 0.035,
            delay,
            scrollTrigger: { trigger: root.current, start: 'top 90%', once: true, refreshPriority: -1 },
          }),
      })
      return () => split.revert()
    })
    return () => media.revert()
  }, [text, delay])

  return (
    <p key={text} ref={root} className={className}>
      {text}
    </p>
  )
}
