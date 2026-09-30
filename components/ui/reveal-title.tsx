'use client'

import { useLayoutEffect, useRef } from 'react'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { SplitText } from 'gsap/SplitText'

gsap.registerPlugin(ScrollTrigger, SplitText)

// Adapted from React Bits' Split Text: a section title flips up letter by letter, each one hinged on
// its baseline, the first time it scrolls into view.
export function RevealTitle({ text, id, className }: { text: string; id?: string; className?: string }) {
  const root = useRef<HTMLHeadingElement>(null)

  useLayoutEffect(() => {
    const media = gsap.matchMedia()
    media.add('(prefers-reduced-motion: no-preference)', () => {
      const split = SplitText.create(root.current, {
        type: 'words,chars',
        autoSplit: true,
        onSplit: (self) =>
          gsap.from(self.chars, {
            rotateX: -100,
            yPercent: 40,
            opacity: 0,
            transformOrigin: '50% 100%',
            transformPerspective: 500,
            duration: 1.1,
            ease: 'expo.out',
            stagger: 0.022,
            // Measured after the story and pace pins, whose spacers push these titles down.
            scrollTrigger: { trigger: root.current, start: 'top 85%', once: true, refreshPriority: -1 },
          }),
      })
      return () => split.revert()
    })
    return () => media.revert()
  }, [text])

  // A new text remounts the heading: React never has to patch the letters SplitText wrapped.
  return (
    <h2 key={text} ref={root} id={id} className={className}>
      {text}
    </h2>
  )
}
