'use client'

import { useState, type KeyboardEvent, type PointerEvent, type ReactNode } from 'react'
import { Reorder, useDragControls, useReducedMotion } from 'motion/react'
import { GripVertical } from 'lucide-react'
import type { WidgetId } from '@/lib/data/dashboard'
import { cn } from '@/lib/utils'

type WidgetListProps = {
  /** The widgets to show, in order (already filtered for a projected cycle). */
  order: WidgetId[]
  /** Each widget's visible name, for the grip's label and the move announcement. */
  names: Record<WidgetId, string>
  /** Renders one widget; `grip` is null when the list is not reorderable. */
  render: (id: WidgetId, grip: ReactNode | null) => ReactNode
  /**
   * The order as it changes: `commit` is false while a drag is in progress and true on the drop
   * and on every keyboard move — the one call to save (`desktop-shell` → *Widget order is the
   * user's*). Absent when the list cannot be reordered (below `lg`, or no save operation).
   */
  onOrderChange?: (next: WidgetId[], commit: boolean, moved: WidgetId) => void
  gripLabel: (name: string, position: number, total: number) => string
  className?: string
}

/** Two layers, like the category drag: a tight contact shadow and the lift. */
const HELD_SHADOW = 'shadow-[0_2px_8px_-2px_var(--lift-shadow),0_26px_50px_-12px_var(--lift-shadow),0_0_0_1px_var(--lift-rim)]'

/**
 * The chart widgets as a vertical list the user can arrange (design D6): `motion`'s `Reorder`
 * with the drag started from a grip only, so each chart's own hover, tap and keyboard stay its
 * own; Up/Down on a focused grip move the widget one slot. Under reduced motion the items jump
 * instead of travelling, while a held widget still follows the pointer.
 */
export function WidgetList({ order, names, render, onOrderChange, gripLabel, className }: WidgetListProps) {
  const reorderable = onOrderChange != null && order.length > 1

  function move(index: number, direction: -1 | 1) {
    if (!onOrderChange) return
    const target = index + direction
    if (target < 0 || target >= order.length) return
    const next = [...order]
    const [moved] = next.splice(index, 1)
    next.splice(target, 0, moved)
    onOrderChange(next, true, moved)
  }

  return (
    <Reorder.Group
      as="div"
      axis="y"
      values={order}
      onReorder={(next: WidgetId[]) => {
        const moved = next.find((id, index) => order[index] !== id && next.indexOf(id) !== order.indexOf(id))
        onOrderChange?.(next, false, moved ?? next[0])
      }}
      className={cn('flex flex-col gap-stack', className)}
      data-widget-list
    >
      {order.map((id, index) => (
        <WidgetItem
          key={id}
          id={id}
          reorderable={reorderable}
          label={gripLabel(names[id], index + 1, order.length)}
          onMove={(direction) => move(index, direction)}
          onDrop={() => onOrderChange?.(order, true, id)}
          render={render}
        />
      ))}
    </Reorder.Group>
  )
}

type WidgetItemProps = {
  id: WidgetId
  reorderable: boolean
  label: string
  onMove: (direction: -1 | 1) => void
  onDrop: () => void
  render: WidgetListProps['render']
}

function WidgetItem({ id, reorderable, label, onMove, onDrop, render }: WidgetItemProps) {
  const controls = useDragControls()
  const reduced = useReducedMotion() ?? false
  const [held, setHeld] = useState(false)

  function onGripKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') return
    event.preventDefault()
    onMove(event.key === 'ArrowUp' ? -1 : 1)
  }

  function onGripPointerDown(event: PointerEvent<HTMLButtonElement>) {
    // Without this Firefox turns the press into a native text/element drag a few pixels in and
    // cancels the pointer session, leaving the widget lifted where it was.
    event.preventDefault()
    controls.start(event)
  }

  const grip = reorderable ? (
    <button
      type="button"
      aria-label={label}
      data-widget-grip={id}
      onPointerDown={onGripPointerDown}
      onKeyDown={onGripKeyDown}
      className={cn(
        'pressable grid size-target touch-none place-items-center rounded-full text-muted-foreground [--press-scale:0.9] hover:bg-foreground/[0.06] hover:text-foreground',
        held ? 'cursor-grabbing' : 'cursor-grab',
      )}
    >
      <GripVertical aria-hidden className="size-4" />
    </button>
  ) : null

  return (
    <Reorder.Item
      as="div"
      value={id}
      dragListener={false}
      dragControls={controls}
      // Only the position is laid out across a move: the card's own size never changes. Under
      // reduced motion the layout animation is off altogether: a zero-length transition still
      // paints one FLIP frame in Firefox (`false` is what motion reads; its prop type only names
      // the enabled values).
      layout={(reduced ? false : 'position') as 'position'}
      transition={reduced ? { duration: 0 } : { type: 'spring', duration: 0.5, bounce: 0.2 }}
      whileDrag={reduced ? undefined : { scale: 1.02 }}
      onDragStart={() => setHeld(true)}
      onDragEnd={() => {
        setHeld(false)
        onDrop()
      }}
      className={cn('relative rounded-card transition-shadow duration-200 ease-out motion-reduce:transition-none', held && cn('z-10 select-none', HELD_SHADOW))}
      data-widget={id}
      data-held={held ? '' : undefined}
    >
      {render(id, grip)}
    </Reorder.Item>
  )
}
