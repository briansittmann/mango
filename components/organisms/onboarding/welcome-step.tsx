'use client'

import { useEffect, useLayoutEffect, useRef } from 'react'
import { useTranslations } from 'next-intl'
import { gsap } from 'gsap'
import { SplitText } from 'gsap/SplitText'
import { MangoLogo } from '@/components/atoms/mango-logo'

gsap.registerPlugin(SplitText)

/**
 * Step 1 (`onboarding` → *Welcome without a loaded expense*, D14), in one sequence: the logo lands
 * with a bounce and a ring of its own colour spreads out of it; "¡Hola!" rises letter by letter
 * (React Bits' Split Text), then the title does the same once the greeting is in; the three lines
 * wipe in from the left. `onEntranceEnd` fires as the last line lands (at once under reduced
 * motion): the template brings "Empezar" in on it, so the button is always last. Nothing here
 * blocks the button: it is clickable while all this plays.
 */
export function WelcomeStep({ onEntranceEnd }: { onEntranceEnd?: () => void }) {
  const t = useTranslations('onboarding')
  const root = useRef<HTMLDivElement>(null)
  // The latest callback, read when the timeline reaches it: a new closure must not restart the entrance.
  const onEnd = useRef(onEntranceEnd)
  useEffect(() => {
    onEnd.current = onEntranceEnd
  })
  const lines = ['linea1', 'linea2', 'linea3'] as const

  useLayoutEffect(() => {
    const media = gsap.matchMedia(root)
    media.add('(prefers-reduced-motion: reduce)', () => {
      onEnd.current?.()
    })
    media.add('(prefers-reduced-motion: no-preference)', () => {
      const scope = root.current!
      const timeline = gsap.timeline({ defaults: { ease: 'power3.out' } })
      timeline
        // No blur here: the elastic ease overshoots, and a negative blur radius paints the
        // image's box as a dark square on iOS until the tween ends.
        .from('.welcome-logo', { scale: 0.2, rotate: -24, autoAlpha: 0, duration: 1.3, ease: 'elastic.out(1, 0.55)' }, 0)
        .fromTo('.welcome-ring', { scale: 0.4, autoAlpha: 0.9 }, { scale: 2.4, autoAlpha: 0, duration: 1.2, ease: 'power2.out' }, 0.12)
        .fromTo('.welcome-glow', { scale: 0.3, autoAlpha: 0 }, { scale: 1, autoAlpha: 1, duration: 1.1, ease: 'power2.out' }, 0.1)

      // React Bits' Split Text: each letter rises from 40px below and fades in, 1.25 s on power3.out.
      const greeting = SplitText.create(scope.querySelector('.welcome-hello'), { type: 'chars' })
      const title = SplitText.create(scope.querySelector('.welcome-title'), { type: 'words,chars' })
      timeline
        .from(greeting.chars, { y: 40, autoAlpha: 0, duration: 1.25, stagger: 0.07 }, 0.25)
        .from(title.chars, { y: 40, autoAlpha: 0, duration: 1.25, stagger: 0.028 }, 1.05)
        .from('.welcome-line', { clipPath: 'inset(0 100% 0 0)', x: -14, autoAlpha: 0, duration: 0.8, stagger: 0.2 }, 1.65)
        // The last line is legible from here (its wipe only tails off): "Empezar" can come in.
        .call(() => onEnd.current?.(), [], 2.5)

      return () => {
        greeting.revert()
        title.revert()
      }
    })
    return () => media.revert()
  }, [])

  return (
    <div ref={root} className="flex flex-col items-center pt-8 text-center sm:pt-16">
      {/* The box is the fruit's own bounds (64px tall): the artwork fills only the middle half of
          its 1024 canvas, so the image is drawn at twice the box and offset to the fruit (its
          bounds are x 325–764, y 264–771). The ring and the glow centre on the fruit, outside flow. */}
      <div className="relative h-16 w-14">
        {/* The halo is a box shadow, not `filter: blur`: a filtered layer beside the logo makes
            Safari paint the logo's box dark once the title's letters start moving. */}
        <span
          aria-hidden
          className="welcome-glow absolute left-1/2 top-1/2 size-6 -translate-x-1/2 -translate-y-1/2 rounded-full shadow-[0_0_48px_44px_color-mix(in_oklab,var(--color-brand)_25%,transparent)]"
        />
        <span aria-hidden className="welcome-ring absolute left-1/2 top-1/2 size-24 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-brand/60" />
        <div className="welcome-logo relative size-full">
          <MangoLogo className="absolute -left-[41px] -top-[33px] size-[129px] max-w-none" />
        </div>
      </div>
      {/* One run of text: the greeting and the title share a line where they fit. The gap to the
          fruit is the one between the lines and "Empezar" on desktop (the slot's `sm:pt-8`). */}
      <h1 className="mt-8 text-balance font-display text-display-mobile text-foreground">
        <span className="welcome-hello">{t('bienvenida.hola')}</span> <span className="welcome-title">{t('bienvenida.titulo')}</span>
      </h1>
      <ul className="mt-6 flex flex-col gap-3 text-body-lg text-muted-foreground">
        {lines.map((line) => (
          <li key={line} className="welcome-line">
            {t(`bienvenida.${line}`)}
          </li>
        ))}
      </ul>
    </div>
  )
}
