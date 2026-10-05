'use client'

import { useEffect, useState } from 'react'

/**
 * Which of `ids` is at the reading line (`desktop-shell` → *Sidebar navigation follows the page*,
 * design D3): the target whose top edge is nearest above `lineOffset`, or the last id once the page is
 * scrolled to its end. One `IntersectionObserver` over the targets is the trigger; a passive scroll
 * listener only watches the end-of-page flip, which the observer cannot see. Null while disabled.
 */
export function useScrollSpy(ids: readonly string[], enabled: boolean, lineOffset = 104): string | null {
  const [active, setActive] = useState<string | null>(null)
  const key = ids.join('|')

  useEffect(() => {
    if (!enabled || ids.length === 0) return
    const targets = ids.map((id) => document.getElementById(id)).filter((node): node is HTMLElement => node != null)
    if (targets.length === 0) return

    let atEnd = false
    const pageEnded = () => {
      const root = document.documentElement
      return root.scrollHeight > window.innerHeight + 2 && window.scrollY + window.innerHeight >= root.scrollHeight - 2
    }
    const measure = () => {
      atEnd = pageEnded()
      if (atEnd) {
        setActive(targets[targets.length - 1].id)
        return
      }
      // The target whose top is nearest above the line, not the last in order: the widget column
      // starts beside the first card, so order alone would hand it every card below the fold.
      let current = targets[0].id
      let currentTop = -Infinity
      for (const target of targets) {
        const top = target.getBoundingClientRect().top
        if (top <= lineOffset + 1 && top > currentTop) {
          current = target.id
          currentTop = top
        }
      }
      setActive(current)
    }
    // The observer delivers one callback per target right after `observe` and on every crossing of
    // the band; a scroll that settles with a target exactly at the line crosses nothing more, so a
    // scroll listener (one measure per frame at most) finishes the job and sees the end of the page.
    const observer = new IntersectionObserver(() => measure(), { rootMargin: `-${lineOffset}px 0px -55% 0px`, threshold: [0, 1] })
    targets.forEach((target) => observer.observe(target))
    let frame: number | null = null
    const onScroll = () => {
      if (frame != null) return
      frame = requestAnimationFrame(() => {
        frame = null
        measure()
      })
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      observer.disconnect()
      window.removeEventListener('scroll', onScroll)
      if (frame != null) cancelAnimationFrame(frame)
    }
    // `key` stands in for `ids`: a new array with the same ids must not re-run the observer.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, enabled, lineOffset])

  return enabled ? active : null
}
