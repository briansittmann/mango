import { useEffect, useLayoutEffect, useRef, useState, type ReactNode, type RefObject } from 'react'
import { Drawer } from '@base-ui/react/drawer'
import { cn } from '@/lib/utils'

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
  /** Above `sm`, anchor the panel to the control that opened it instead of a bottom sheet (D4). */
  anchored?: boolean
}

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
}: SheetShellProps) {
  const openerRef = useRef<Element | null>(null)
  const popupRef = useRef<HTMLDivElement>(null)
  const [isDesktop, setIsDesktop] = useState(
    () => anchored && typeof window !== 'undefined' && matchMedia('(min-width: 40rem)').matches,
  )

  useLayoutEffect(() => {
    if (open) openerRef.current = document.activeElement
  }, [open])

  useEffect(() => {
    if (!anchored) return
    const query = matchMedia('(min-width: 40rem)')
    const onChange = () => setIsDesktop(query.matches)
    query.addEventListener('change', onChange)
    return () => query.removeEventListener('change', onChange)
  }, [anchored])

  useLayoutEffect(() => {
    if (!anchored || !open) return
    const popup = popupRef.current
    const opener = openerRef.current
    if (!popup || !opener) return
    const rect = opener.getBoundingClientRect()
    popup.style.setProperty('--anchor-top', `${rect.bottom + 8}px`)
    popup.style.setProperty('--anchor-right', `${document.documentElement.clientWidth - rect.right}px`)
  }, [anchored, open, isDesktop])

  return (
    <Drawer.Root
      open={open}
      swipeDirection={anchored && isDesktop ? undefined : 'down'}
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
            className={cn(
              'fixed inset-0 z-40 bg-scrim opacity-[calc(1-var(--drawer-swipe-progress,0))] backdrop-blur-[8px] transition-opacity duration-300 motion-reduce:transition-none data-starting-style:opacity-0 data-ending-style:opacity-0 data-swiping:transition-none',
              anchored && 'sm:bg-transparent sm:backdrop-blur-none',
            )}
          />
          {/* `Drawer.VirtualKeyboardProvider` measures the software keyboard and publishes its
              inset on this element as `--drawer-keyboard-inset`, but it never applies it — that is
              the app's job. Without consuming it the panel keeps its full height behind the
              keyboard, so its last rows are invisible and untappable while a field is focused. */}
          <Drawer.Viewport className="fixed inset-0 z-50 flex items-end justify-center px-3 pb-[calc(max(0.75rem,env(safe-area-inset-bottom))+var(--drawer-keyboard-inset,0px))]">
            <Drawer.Popup
              ref={popupRef}
              initialFocus={initialFocus}
              finalFocus={() => {
                const opener = openerRef.current
                if (opener instanceof HTMLElement && document.contains(opener)) return opener
                return finalFocus?.current ?? true
              }}
              className={cn(
                'liquid-glass relative mx-auto flex max-h-[calc(100dvh-1.5rem-var(--drawer-keyboard-inset,0px))] w-full max-w-[440px] flex-col overflow-hidden rounded-sheet outline-none',
                'translate-y-(--drawer-swipe-movement-y)',
                'transition-transform duration-500 ease-spring motion-reduce:transition-none',
                'data-starting-style:translate-y-[calc(100%+1.5rem)] data-ending-style:translate-y-[calc(100%+1.5rem)]',
                'data-ending-style:duration-[calc(var(--drawer-swipe-strength)*400ms)] data-ending-style:ease-in',
                'data-swiping:transition-none',
                anchored &&
                  cn(
                    'sm:fixed sm:inset-auto sm:bottom-auto sm:left-auto sm:right-(--anchor-right) sm:top-(--anchor-top) sm:mx-0 sm:w-[380px] sm:max-h-[min(560px,calc(100dvh-2rem))] sm:origin-top-right sm:translate-y-0',
                    'sm:data-starting-style:translate-y-0 sm:data-starting-style:scale-95 sm:data-starting-style:opacity-0',
                    'sm:data-ending-style:translate-y-0 sm:data-ending-style:scale-95 sm:data-ending-style:opacity-0 sm:data-ending-style:duration-200 sm:data-ending-style:ease-in',
                  ),
              )}
            >
              <span aria-hidden className={cn('mx-auto mt-2.5 h-1 w-9 shrink-0 rounded-full bg-handle', anchored && 'sm:hidden')} />
              {/* `minmax(0,auto)` on the title, not `auto`: an `auto` track sizes to its content and
                  pushes the cancel and save controls off the panel once the title is long. */}
              <header className="grid min-h-14 shrink-0 grid-cols-[1fr_minmax(0,auto)_1fr] items-center gap-x-2 px-inset pb-1.5">
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
