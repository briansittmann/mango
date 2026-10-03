'use client'

import { useRef, type ComponentProps, type PointerEvent } from 'react'
import { cn } from '@/lib/utils'

type SpotlightCardProps = ComponentProps<'div'>

/**
 * React Bits' SpotlightCard, ported by hand (modernize-dashboard-widgets D12): a soft radial
 * highlight follows the pointer over the card. The position is written straight to the node as two
 * custom properties (no React state per `pointermove`), and the highlight only exists for a fine
 * pointer that can hover (`.spotlight-card` in `globals.css`) and never under reduced motion.
 */
export function SpotlightCard({ className, children, onPointerMove, ref, ...props }: SpotlightCardProps) {
  const nodeRef = useRef<HTMLDivElement | null>(null)

  function handlePointerMove(event: PointerEvent<HTMLDivElement>) {
    onPointerMove?.(event)
    const node = nodeRef.current
    if (!node || event.pointerType !== 'mouse') return
    const rect = node.getBoundingClientRect()
    node.style.setProperty('--spot-x', `${event.clientX - rect.left}px`)
    node.style.setProperty('--spot-y', `${event.clientY - rect.top}px`)
  }

  return (
    <div
      ref={(node) => {
        nodeRef.current = node
        if (typeof ref === 'function') ref(node)
        else if (ref) ref.current = node
      }}
      onPointerMove={handlePointerMove}
      className={cn('spotlight-card', className)}
      {...props}
    >
      {children}
    </div>
  )
}
