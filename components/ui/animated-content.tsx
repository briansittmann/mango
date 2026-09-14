'use client'

import { useEffect, useRef, type ComponentProps } from 'react'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

gsap.registerPlugin(ScrollTrigger)

type AnimatedContentProps = ComponentProps<'div'> & {
  container?: string | HTMLElement | null
  trigger?: string | Element | null
  distance?: number
  direction?: 'vertical' | 'horizontal'
  reverse?: boolean
  duration?: number
  ease?: string
  initialOpacity?: number
  animateOpacity?: boolean
  scale?: number
  threshold?: number
  delay?: number
  disappearAfter?: number
  disappearDuration?: number
  disappearEase?: string
  onComplete?: () => void
  onDisappearanceComplete?: () => void
}

export function AnimatedContent({
  children,
  container,
  trigger,
  distance = 100,
  direction = 'vertical',
  reverse = false,
  duration = 0.8,
  ease = 'power3.out',
  initialOpacity = 0,
  animateOpacity = true,
  scale = 1,
  threshold = 0.1,
  delay = 0,
  disappearAfter = 0,
  disappearDuration = 0.5,
  disappearEase = 'power3.in',
  onComplete,
  onDisappearanceComplete,
  className = '',
  ...props
}: AnimatedContentProps) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return

    if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
      gsap.set(el, { clearProps: 'transform,opacity', visibility: 'visible' })
      return
    }

    let scrollerTarget: string | Element | null = container || document.getElementById('snap-main-container') || null

    if (typeof scrollerTarget === 'string') {
      scrollerTarget = document.querySelector(scrollerTarget)
    }

    const axis = direction === 'horizontal' ? 'x' : 'y'
    const offset = reverse ? -distance : distance
    const startPct = (1 - threshold) * 100

    gsap.set(el, {
      [axis]: offset,
      scale,
      opacity: animateOpacity ? initialOpacity : 1,
      visibility: 'visible',
    })

    const tl = gsap.timeline({
      paused: true,
      delay,
      onComplete: () => {
        if (onComplete) onComplete()
        if (disappearAfter > 0) {
          gsap.to(el, {
            [axis]: reverse ? distance : -distance,
            scale: 0.8,
            opacity: animateOpacity ? initialOpacity : 0,
            delay: disappearAfter,
            duration: disappearDuration,
            ease: disappearEase,
            onComplete: () => onDisappearanceComplete?.(),
          })
        }
      },
    })

    tl.to(el, {
      [axis]: 0,
      scale: 1,
      opacity: 1,
      duration,
      ease,
    })

    const triggerEl = (typeof trigger === 'string' ? document.querySelector(trigger) : trigger) ?? el

    const st = ScrollTrigger.create({
      trigger: triggerEl,
      scroller: scrollerTarget ?? undefined,
      start: `top ${startPct}%`,
      once: true,
      onEnter: () => tl.play(),
    })

    return () => {
      st.kill()
      tl.kill()
    }
  }, [
    container,
    trigger,
    distance,
    direction,
    reverse,
    duration,
    ease,
    initialOpacity,
    animateOpacity,
    scale,
    threshold,
    delay,
    disappearAfter,
    disappearDuration,
    disappearEase,
    onComplete,
    onDisappearanceComplete,
  ])

  return (
    <div ref={ref} className={className} style={{ visibility: 'hidden' }} {...props}>
      {children}
    </div>
  )
}
