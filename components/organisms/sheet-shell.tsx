import { useLayoutEffect, useRef, type ReactNode, type RefObject } from 'react'
import { Drawer } from '@base-ui/react/drawer'
import { useDesktop, useMediaQuery } from '@/components/hooks/use-desktop'
import { placeAnchored } from '@/lib/ui/anchor'
import { cn } from '@/lib/utils'

/** Where an anchored sheet becomes a popover (`sm`). */
const ANCHOR_QUERY = '(min-width: 40rem)'

export type SheetShellProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  busy: boolean
  isDirty: boolean
  initialFocus?: RefObject<HTMLElement | null> | false
  finalFocus?: RefObject<HTMLElement | null>
  leading: ReactNode
  title: ReactNode
  trailing: ReactNode
  /** Omitted when the title already carries everything the sheet has to say about its subject. */
  caption?: ReactNode
  children: ReactNode
  /** From `sm` to `lg`, anchor the panel to the control that opened it instead of a bottom sheet (D4). */
  anchored?: boolean
  /**
   * The control an anchored panel is placed from and focus returns to (`desktop-shell` → *Anchored
   * popovers stay on screen*). Without it, whatever held focus when the sheet opened.
   */
  opener?: RefObject<HTMLElement | null>
}

/**
 * The surface every sheet shares. Three presentations, resolved per render (add-desktop-dashboard-shell D5):
 * `sheet` below `sm` (and up to `lg` when not anchored), `anchored` from `sm` to `lg` for the sheets
 * that ask for it, `side` at `lg` for every sheet — a panel docked to the right edge.
 */
export function SheetShell({
  open,
  onOpenChange,
  busy,
  isDirty,
  initialFocus,
  finalFocus,
  leading,
  title,
  trailing,
  caption,
  children,
  anchored,
  opener,
}: SheetShellProps) {
  const focusedAtOpenRef = useRef<Element | null>(null)
  const popupRef = useRef<HTMLDivElement>(null)
  const wide = useMediaQuery(ANCHOR_QUERY)
  const desktop = useDesktop()
  const presentation: 'sheet' | 'anchored' | 'side' = desktop ? 'side' : anchored && wide ? 'anchored' : 'sheet'

  useLayoutEffect(() => {
    if (open) focusedAtOpenRef.current = document.activeElement
  }, [open])

  useLayoutEffect(() => {
    if (presentation !== 'anchored' || !open) return
    const popup = popupRef.current
    const anchor = opener?.current ?? focusedAtOpenRef.current
    if (!popup || !anchor) return
    // Clamped to the viewport from the opener's rect, scaling from the opener's side (D5). The
    // popup's body lands a frame after `open`, so its size is re-read until it settles.
    const place = () => {
      const placed = placeAnchored(
        anchor.getBoundingClientRect(),
        { width: popup.offsetWidth, height: popup.offsetHeight },
        { width: document.documentElement.clientWidth, height: window.innerHeight },
      )
      popup.style.setProperty('--anchor-top', `${placed.top}px`)
      popup.style.setProperty('--anchor-left', `${placed.left}px`)
      popup.style.setProperty('--anchor-origin', placed.origin)
    }
    place()
    const observer = new ResizeObserver(place)
    observer.observe(popup)
    return () => observer.disconnect()
  }, [presentation, open, opener])

  return (
    <Drawer.Root
      open={open}
      swipeDirection={presentation === 'sheet' ? 'down' : presentation === 'side' ? 'right' : undefined}
      modal
      onOpenChange={(nextOpen, details) => {
        if (nextOpen) {
          onOpenChange(true)
          return
        }
        if (busy) {
          details.cancel()
          return
        }
        if (isDirty && (details.reason === 'outside-press' || details.reason === 'swipe')) {
          details.cancel()
          return
        }
        onOpenChange(false)
      }}
    >
      <Drawer.Portal keepMounted>
        <Drawer.VirtualKeyboardProvider>
          <Drawer.Backdrop
            data-sheet-backdrop
            className={cn(
              'fixed inset-0 z-40 bg-scrim opacity-[calc(1-var(--drawer-swipe-progress,0))] backdrop-blur-[8px] transition-opacity duration-300 motion-reduce:transition-none data-starting-style:opacity-0 data-ending-style:opacity-0 data-swiping:transition-none',
              presentation === 'anchored' && 'bg-transparent backdrop-blur-none',
            )}
          />
          {/* `Drawer.VirtualKeyboardProvider` measures the software keyboard and publishes its
              inset on this element as `--drawer-keyboard-inset`, but it never applies it — that is
              the app's job. Without consuming it the panel keeps its full height behind the
              keyboard, so its last rows are invisible and untappable while a field is focused. */}
          <Drawer.Viewport className="fixed inset-0 z-50 flex items-end justify-center px-3 pb-[calc(max(0.75rem,env(safe-area-inset-bottom))+var(--drawer-keyboard-inset,0px))]">
            <Drawer.Popup
              ref={popupRef}
              data-presentation={presentation}
              // `false` lands focus on the popup itself (focusable, `outline-none`) instead of
              // not moving it: with the opener gone (the account menu closes as the sheet opens)
              // the focus trap would otherwise pull focus to the first button and ring "Cancelar".
              initialFocus={initialFocus === false ? () => popupRef.current : initialFocus}
              finalFocus={() => {
                // Another sheet opened as this one closed (a row of the day detail) keeps the focus it took.
                const active = document.activeElement
                if (active && !popupRef.current?.contains(active) && active.closest('[role="dialog"]')) return false
                const target = opener?.current ?? focusedAtOpenRef.current
                if (target instanceof HTMLElement && document.contains(target)) return target
                return finalFocus?.current ?? true
              }}
              className={cn(
                'liquid-glass flex flex-col overflow-hidden rounded-sheet outline-none motion-reduce:transition-none data-swiping:transition-none',
                presentation === 'sheet' &&
                  cn(
                    'relative mx-auto w-full max-w-[440px] max-h-[calc(100dvh-1.5rem-var(--drawer-keyboard-inset,0px))]',
                    'translate-y-(--drawer-swipe-movement-y) transition-transform duration-500 ease-spring',
                    'data-starting-style:translate-y-[calc(100%+1.5rem)] data-ending-style:translate-y-[calc(100%+1.5rem)]',
                    'data-ending-style:duration-[calc(var(--drawer-swipe-strength)*400ms)] data-ending-style:ease-[var(--ease-out)]',
                  ),
                // Scales out of its opener over 200 ms (motion-skills → Dropdown, popover).
                presentation === 'anchored' &&
                  cn(
                    'fixed left-(--anchor-left) top-(--anchor-top) w-[380px] max-h-[min(560px,calc(100dvh-2rem))] origin-(--anchor-origin)',
                    'transition-[transform,opacity] duration-200 ease-[var(--ease-out)]',
                    'data-starting-style:scale-95 data-starting-style:opacity-0 data-ending-style:scale-95 data-ending-style:opacity-0',
                  ),
                // Docked to the right edge: in over 400 ms on the drawer curve, out faster (D5).
                presentation === 'side' &&
                  cn(
                    'fixed bottom-4 right-4 top-4 w-[440px] max-w-[calc(100vw-2rem)]',
                    'translate-x-(--drawer-swipe-movement-x) transition-transform duration-[400ms] ease-[var(--ease-drawer)]',
                    'data-starting-style:translate-x-[calc(100%+1rem)] data-ending-style:translate-x-[calc(100%+1rem)]',
                    'data-ending-style:duration-[250ms] data-ending-style:ease-[var(--ease-out)]',
                  ),
              )}
            >
              <span aria-hidden className={cn('mx-auto mt-2.5 h-1 w-9 shrink-0 rounded-full bg-handle', presentation !== 'sheet' && 'hidden')} />
              {/* `minmax(0,auto)` on the title, not `auto`: an `auto` track sizes to its content and
                  pushes the cancel and save controls off the panel once the title is long. */}
              <header className={cn('grid min-h-14 shrink-0 grid-cols-[1fr_minmax(0,auto)_1fr] items-center gap-x-2 px-inset pb-1.5', presentation !== 'sheet' && 'pt-2')}>
                <div className="flex min-h-target items-center justify-self-start">{leading}</div>
                <Drawer.Title className="min-w-0 truncate font-display text-headline-sm text-foreground">{title}</Drawer.Title>
                <div className="flex min-h-target items-center justify-self-end">{trailing}</div>
                {caption ? (
                  <Drawer.Description className="col-span-3 flex items-center justify-center gap-1.5 whitespace-nowrap text-body-sm text-muted-foreground">
                    {caption}
                  </Drawer.Description>
                ) : null}
              </header>
              {children}
            </Drawer.Popup>
          </Drawer.Viewport>
        </Drawer.VirtualKeyboardProvider>
      </Drawer.Portal>
    </Drawer.Root>
  )
}
