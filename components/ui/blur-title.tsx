'use client'

import { Fragment, useLayoutEffect, useRef } from 'react'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { SplitText } from 'gsap/SplitText'

gsap.registerPlugin(ScrollTrigger, SplitText)

// React Bits Pro's Text Scatter settings: how far and how wildly the letters fly, how long they
// stay out and how long each leg takes.
const SCATTER = { velocity: 200, rotation: 90, scale: 1, returnAfter: 1, duration: 0.6 }

// A narrow screen gets a shorter throw, so the letters stay in view.
function reach() {
  return SCATTER.velocity * Math.min(1, Math.max(0.45, window.innerWidth / 900))
}

// One letter flies `distance` along `angle`, waits, then snaps back into place.
function throwChar(char: Element, angle: number, distance: number, spin: number) {
  return gsap
    .timeline()
    .to(char, { x: Math.cos(angle) * distance, y: Math.sin(angle) * distance, rotation: spin, scale: SCATTER.scale, duration: SCATTER.duration, ease: 'power3.out' })
    .to(char, { x: 0, y: 0, rotation: 0, scale: 1, duration: SCATTER.duration, ease: 'back.out(1.6)' }, `+=${SCATTER.returnAfter}`)
}

// Adapted from React Bits' Blur Text: a title drops in word by word from above, coming into focus
// as it lands, the first time it scrolls into view. With `scatter`, once the title has landed a
// letter of that word the mouse hits flies the way the mouse was moving, as far as it was going
// fast, and comes back (React Bits Pro's Text Scatter). Only on hover: flying on its own, the word
// broke apart right over the call to action. A line break in `text` breaks the title there.
export function BlurTitle({ text, scatter: word, id, className }: { text: string; scatter?: string; id?: string; className?: string }) {
  const root = useRef<HTMLHeadingElement>(null)

  useLayoutEffect(() => {
    const media = gsap.matchMedia()
    media.add('(prefers-reduced-motion: no-preference)', () => {
      let chars: Element[] = []
      let entered = false
      // The pointer's last position and speed (px/ms), so a letter it hits flies the way it moved.
      let last = { x: 0, y: 0, t: 0 }
      let velocity = { x: 0, y: 0 }

      const onPointerMove = (event: PointerEvent) => {
        const dt = Math.max(1, event.timeStamp - last.t)
        // Smoothed, so one jittery event doesn't decide the direction.
        velocity = {
          x: velocity.x * 0.4 + ((event.clientX - last.x) / dt) * 0.6,
          y: velocity.y * 0.4 + ((event.clientY - last.y) / dt) * 0.6,
        }
        last = { x: event.clientX, y: event.clientY, t: event.timeStamp }
      }
      const onPointerOver = (event: PointerEvent) => {
        const char = event.target as Element
        if (event.pointerType !== 'mouse' || !entered || !chars.includes(char) || gsap.isTweening(char)) return
        const speed = Math.hypot(velocity.x, velocity.y)
        // A barely moving pointer pushes the letter straight away from itself.
        const { left, top, width, height } = char.getBoundingClientRect()
        const angle =
          speed > 0.05 ? Math.atan2(velocity.y, velocity.x) : Math.atan2(top + height / 2 - event.clientY, left + width / 2 - event.clientX)
        const force = gsap.utils.clamp(0.4, 1, speed / 1.2)
        const spin = SCATTER.rotation * force * gsap.utils.random(0.5, 1) * (velocity.x < 0 ? -1 : 1)
        throwChar(char, angle, reach() * force, spin)
      }
      const split = SplitText.create(root.current, {
        type: word ? 'words,chars' : 'words',
        autoSplit: true,
        onSplit: (self) => {
          chars = gsap.utils.toArray<Element>(self.words.find((node) => node.textContent?.startsWith(word ?? '\0'))?.children ?? [])
          gsap.set(self.words, { filter: 'blur(10px)', opacity: 0, y: -50 })
          return gsap.to(self.words, {
            keyframes: [
              { filter: 'blur(5px)', opacity: 0.5, y: 5, duration: 0.35, ease: 'none' },
              { filter: 'blur(0px)', opacity: 1, y: 0, duration: 0.35, ease: 'none' },
            ],
            stagger: 0.2,
            clearProps: 'filter',
            onComplete: () => {
              entered = true
            },
            // Measured after the story and pace pins, whose spacers push this title down.
            scrollTrigger: { trigger: root.current, start: 'top 85%', once: true, refreshPriority: -1 },
          })
        },
      })
      const heading = root.current!
      window.addEventListener('pointermove', onPointerMove, { passive: true })
      heading.addEventListener('pointerover', onPointerOver)
      return () => {
        window.removeEventListener('pointermove', onPointerMove)
        heading.removeEventListener('pointerover', onPointerOver)
        gsap.killTweensOf(chars)
        split.revert()
      }
    })
    return () => media.revert()
  }, [text, word])

  // A new text remounts the heading: React never has to patch the words SplitText wrapped.
  return (
    <h2 key={text} ref={root} id={id} className={className}>
      {text.split('\n').map((line, index) => (
        <Fragment key={index}>
          {index > 0 ? <br /> : null}
          {line}
        </Fragment>
      ))}
    </h2>
  )
}
