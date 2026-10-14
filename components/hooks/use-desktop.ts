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
 * Whether `query` matches. The server snapshot is `serverValue` (`false` unless given), so the first
 * client render agrees with the server's markup and the switch happens right after hydration.
 */
export function useMediaQuery(query: string, serverValue = false): boolean {
  return useSyncExternalStore(subscriberFor(query), () => matchMedia(query).matches, () => serverValue)
}

/** True at 1024px and wider, where the dashboard wears the desktop shell. */
export function useDesktop(): boolean {
  return useMediaQuery(DESKTOP_QUERY)
}

/**
 * A phone: a touch screen whose short side is under 640px, in either orientation. A tablet or a
 * computer is not one, and gets the QR to scan instead of the `wa.me` link (whatsapp-linking).
 * The server assumes a phone, today's behaviour.
 */
export const PHONE_QUERY = '(pointer: coarse) and (max-width: 40rem), (pointer: coarse) and (max-height: 40rem)'

export function usePhone(): boolean {
  return useMediaQuery(PHONE_QUERY, true)
}
