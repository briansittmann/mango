import type { PointerEvent } from 'react'
import { gsap } from 'gsap'

// On hover the mango hops and swings from its stem like fruit on a branch, settling on its own
// even if the pointer leaves mid-swing. The fruit is the hovered element's `.nav-fruit`.
export function swing(event: PointerEvent<HTMLElement>) {
  if (event.pointerType !== 'mouse' || matchMedia('(prefers-reduced-motion: reduce)').matches) return
  const fruit = event.currentTarget.querySelector('.nav-fruit')
  if (!fruit || gsap.isTweening(fruit)) return
  gsap
    .timeline({ defaults: { transformOrigin: '62% 30%' } })
    .to(fruit, { rotate: -18, y: -3, scale: 1.1, duration: 0.2, ease: 'power2.out' })
    .to(fruit, { rotate: 0, y: 0, scale: 1, duration: 1.2, ease: 'elastic.out(1.1, 0.28)' })
}
