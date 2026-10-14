import { useEffect, useState } from 'react'
import { ArrowLeft, Pointer, Trash2 } from 'lucide-react'

/** Its 600 ms wait for the row to land plus the 3.4 s it plays (`.swipe-hint` in globals.css). */
const SWIPE_HINT_MS = 4000

function seen(key: string): boolean {
  try {
    return localStorage.getItem(key) === '1'
  } catch {
    return false
  }
}

function markSeen(key: string) {
  try {
    localStorage.setItem(key, '1')
  } catch {}
}

/**
 * A hint shown once per browser under `storageKey`: `show` starts it unless it was seen, and it
 * ends by itself once it has played, or with `dismiss`.
 */
export function useSwipeHint(storageKey: string) {
  const [active, setActive] = useState(false)

  useEffect(() => {
    if (!active) return
    const timeout = setTimeout(() => setActive(false), SWIPE_HINT_MS)
    return () => clearTimeout(timeout)
  }, [active])

  return {
    active,
    show() {
      if (active || seen(storageKey)) return
      markSeen(storageKey)
      setActive(true)
    },
    dismiss() {
      setActive(false)
    },
  }
}

/**
 * The swipe-to-delete hint over a row: a pill with what it means, a hand dragging left and, under
 * the row's content, the red layer its peek uncovers. Mounted inside the row's positioned frame,
 * which carries `data-hint` (that drives the peek and the dim, and isolates the red layer).
 */
export function SwipeHint({ label }: { label: string }) {
  return (
    <>
      <div aria-hidden className="absolute inset-y-0 right-0 -z-10 flex w-24 items-center justify-end bg-destructive-fill pr-6 text-destructive-fill-foreground">
        <Trash2 className="size-5" />
      </div>
      <div aria-hidden className="swipe-hint pointer-events-none absolute inset-0 flex items-center px-inset">
        <span className="flex items-center gap-1.5 rounded-full bg-foreground/85 px-3 py-1.5 text-body-sm font-medium text-background shadow-lg backdrop-blur-sm">
          <ArrowLeft className="size-4" />
          {label}
        </span>
        <Pointer className="swipe-hint-hand absolute right-5 top-1/2 -mt-3 size-8 fill-background text-foreground drop-shadow-md" />
      </div>
    </>
  )
}
