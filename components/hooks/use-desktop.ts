import { useSyncExternalStore } from 'react'

/** The desktop shell's breakpoint (`lg`): the one media query every width-dependent behaviour reads (design D1). */
export const DESKTOP_QUERY = '(min-width: 64rem)'

const subscribers = new Map<string, (onChange: () => void) => () => void>()

function subscriberFor(query: string) {
  let subscribe = subscribers.get(query)
  if (!subscribe) {
    subscribe = (onChange) => {
      const list = matchMedia(query)
      list.addEventListener('change', onChange)
      return () => list.removeEventListener('change', onChange)
    }
    subscribers.set(query, subscribe)
  }
  return subscribe
}

/**
 * Whether `query` matches. The server snapshot is `false`, so the first client render agrees with
 * the server's markup and the switch happens right after hydration, without a mismatch.
 */
export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(subscriberFor(query), () => matchMedia(query).matches, () => false)
}

/** True at 1024px and wider, where the dashboard wears the desktop shell. */
export function useDesktop(): boolean {
  return useMediaQuery(DESKTOP_QUERY)
}
