'use client'

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react'

function subscribe(onChange: () => void) {
  const query = matchMedia('(prefers-reduced-motion: reduce)')
  query.addEventListener('change', onChange)
  return () => query.removeEventListener('change', onChange)
}

const getSnapshot = () => matchMedia('(prefers-reduced-motion: reduce)').matches
const getServerSnapshot = () => false

/**
 * Whether a widget has been scrolled into view once (modernize-dashboard-widgets D9): the chart
 * marks draw when it flips and never again. The line is the card entrance's own (`top 80%`), so
 * the marks start as the card lands rather than while it is still hidden. Under reduced motion it
 * is true from the first client render, so every mark is drawn at rest in its first frame.
 */
export function useFirstReveal<T extends HTMLElement = HTMLDivElement>(): [(node: T | null) => void, boolean] {
  const reduced = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
  const [seen, setSeen] = useState(false)
  const observerRef = useRef<IntersectionObserver | null>(null)

  const ref = useCallback((node: T | null) => {
    observerRef.current?.disconnect()
    observerRef.current = null
    if (!node) return
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return
        setSeen(true)
        observer.disconnect()
      },
      { rootMargin: '0px 0px -20% 0px' },
    )
    observer.observe(node)
    observerRef.current = observer
  }, [])

  useEffect(() => () => observerRef.current?.disconnect(), [])

  return [ref, reduced || seen]
}
