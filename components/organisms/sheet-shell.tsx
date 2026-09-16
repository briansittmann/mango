import { useLayoutEffect, useRef, type ReactNode, type RefObject } from 'react'
import { Drawer } from '@base-ui/react/drawer'
import { cn } from '@/lib/utils'

export type SheetShellProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  busy: boolean
  isDirty: boolean
  initialFocus?: RefObject<HTMLElement | null>
  finalFocus?: RefObject<HTMLElement | null>
  leading: ReactNode
  title: ReactNode
  trailing: ReactNode
  caption: ReactNode
  children: ReactNode
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
}: SheetShellProps) {
  const openerRef = useRef<Element | null>(null)

  useLayoutEffect(() => {
    if (open) openerRef.current = document.activeElement
  }, [open])

  return (
    <Drawer.Root
      open={open}
      swipeDirection="down"
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
          <Drawer.Backdrop className="fixed inset-0 z-40 bg-scrim opacity-[calc(1-var(--drawer-swipe-progress,0))] backdrop-blur-[8px] transition-opacity duration-300 motion-reduce:transition-none data-starting-style:opacity-0 data-ending-style:opacity-0 data-swiping:transition-none" />
          <Drawer.Viewport className="fixed inset-0 z-50 flex items-end justify-center px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
            <Drawer.Popup
              initialFocus={initialFocus}
              finalFocus={() => {
                const opener = openerRef.current
                if (opener instanceof HTMLElement && document.contains(opener)) return opener
                return finalFocus?.current ?? true
              }}
              className={cn(
                'liquid-glass relative mx-auto flex max-h-[calc(100dvh-1.5rem)] w-full max-w-[440px] flex-col overflow-hidden rounded-sheet outline-none',
                'translate-y-(--drawer-swipe-movement-y)',
                'transition-transform duration-500 ease-spring motion-reduce:transition-none',
                'data-starting-style:translate-y-[calc(100%+1.5rem)] data-ending-style:translate-y-[calc(100%+1.5rem)]',
                'data-ending-style:duration-[calc(var(--drawer-swipe-strength)*400ms)] data-ending-style:ease-in',
                'data-swiping:transition-none',
              )}
            >
              <span aria-hidden className="mx-auto mt-2.5 h-1 w-9 shrink-0 rounded-full bg-handle" />
              <header className="grid min-h-14 shrink-0 grid-cols-[1fr_auto_1fr] items-center gap-x-2 px-inset pb-1.5">
                <div className="flex min-h-target items-center justify-self-start">{leading}</div>
                <Drawer.Title className="font-display text-headline-sm text-foreground">{title}</Drawer.Title>
                <div className="flex min-h-target items-center justify-self-end">{trailing}</div>
                <Drawer.Description className="col-span-3 flex items-center justify-center gap-1.5 whitespace-nowrap text-body-sm text-muted-foreground">
                  {caption}
                </Drawer.Description>
              </header>
              {children}
            </Drawer.Popup>
          </Drawer.Viewport>
        </Drawer.VirtualKeyboardProvider>
      </Drawer.Portal>
    </Drawer.Root>
  )
}
