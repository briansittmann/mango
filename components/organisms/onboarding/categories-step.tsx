import { useEffect, useId, useRef, useState, type CSSProperties, type FormEvent, type PointerEvent as ReactPointerEvent } from 'react'
import { flushSync } from 'react-dom'
import { Toast } from '@base-ui/react/toast'
import { useTranslations } from 'next-intl'
import { CategoryDot } from '@/components/atoms/category-dot'
import { Collapsible } from '@/components/atoms/collapsible'
import { CATEGORY_COLORS, ColorSwatchPicker } from '@/components/molecules/color-swatch-picker'
import { SwipeToDelete } from '@/components/molecules/swipe-to-delete'
import { cn } from '@/lib/utils'
import type { CategoryColor } from '@/lib/data/dashboard'
import type { RecurringDefinition } from '@/lib/data/recurring'

/** A row of step 3's list: a stored category, or one not written yet (`new:` id) until "Continuar". */
export type DraftCategory = { id: string; name: string; color: CategoryColor }

const NEW_PREFIX = 'new:'

export function isNewCategory(row: DraftCategory): boolean {
  return row.id.startsWith(NEW_PREFIX)
}

/** How long a taken chip grows and dissolves before it leaves the row (D14). */
const CHIP_FADE_MS = 300
const DRAG_MOVE_THRESHOLD_PX = 4
/** The dashboard's lift (reorder mode): a tight contact shadow and a wide one for the height. */
const LIFTED_SHADOW = '0 2px 8px -2px var(--lift-shadow), 0 26px 50px -12px var(--lift-shadow), 0 0 0 1px var(--lift-rim)'

type CategoriesStepProps = {
  categories: DraftCategory[]
  definitions: RecurringDefinition[]
  onChange: (categories: DraftCategory[]) => void
  /** While "Continuar" writes the list. */
  disabled?: boolean
  onStatus: (message: string) => void
}

type DragGesture = {
  pointerId: number
  categoryId: string
  startIndex: number
  startClientY: number
  rowHeight: number
  order: DraftCategory[]
  targetIndex: number
  moved: boolean
  reducedMotion: boolean
}

type DragVisual = { categoryId: string; startIndex: number; targetIndex: number; rowHeight: number }

function foldName(name: string): string {
  return name.trim().toLocaleLowerCase()
}

/** The palette's neutrals: a border in them reads as no colour, so they come last. */
const NEUTRAL_COLORS: CategoryColor[] = ['gris_calido', 'gris_oscuro', 'blanco']

const VIVID_COLORS = CATEGORY_COLORS.filter((color) => !NEUTRAL_COLORS.includes(color))

/** A colour no category uses yet, picked at random among the vivid ones first; the whole palette once all are taken. */
function randomColor(categories: DraftCategory[]): CategoryColor {
  const free = CATEGORY_COLORS.filter((color) => !categories.some((category) => category.color === color))
  const vivid = free.filter((color) => !NEUTRAL_COLORS.includes(color))
  const pool = vivid.length > 0 ? vivid : free.length > 0 ? free : CATEGORY_COLORS
  return pool[Math.floor(Math.random() * pool.length)]
}

/**
 * Each suggestion chip wears a vivid colour of its own, derived from its name so the server and
 * the browser paint the same one (no hydration flash), distinct across the row.
 */
function chipColors(names: string[]): Record<string, CategoryColor> {
  const used = new Set<CategoryColor>()
  const result: Record<string, CategoryColor> = {}
  for (const name of names) {
    let hash = 0
    for (const char of name) hash = (hash * 31 + char.charCodeAt(0)) >>> 0
    let index = hash % VIVID_COLORS.length
    while (used.has(VIVID_COLORS[index]) && used.size < VIVID_COLORS.length) index = (index + 1) % VIVID_COLORS.length
    used.add(VIVID_COLORS[index])
    result[name] = VIVID_COLORS[index]
  }
  return result
}

function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

function clampIndex(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

// Apple's rubber-band curve over one row of slack (the dashboard's reorder mode).
function rubberBand(overshoot: number, dimension: number): number {
  const sign = overshoot < 0 ? -1 : 1
  const magnitude = Math.abs(overshoot)
  return (sign * magnitude * dimension * 0.55) / (dimension + 0.55 * magnitude)
}

function neighbourShift(index: number, visual: DragVisual): number {
  const { startIndex, targetIndex, rowHeight } = visual
  if (startIndex === targetIndex) return 0
  if (targetIndex > startIndex) return index > startIndex && index <= targetIndex ? -rowHeight : 0
  return index >= targetIndex && index < startIndex ? rowHeight : 0
}

function moveRow(rows: DraftCategory[], from: number, to: number): DraftCategory[] {
  const next = [...rows]
  const [moved] = next.splice(from, 1)
  next.splice(to, 0, moved)
  return next
}

/**
 * Step 3 (`onboarding` → *Categories step*, D8): suggestion chips, a composer and the list, with
 * inline rename, the colour picker under a row, swipe to delete with undo and an in-place reorder
 * mode with the dashboard's lift and neighbour shift. Everything here edits the draft; the
 * template writes it through the dashboard's category operations on "Continuar".
 */
export function CategoriesStep({ categories, definitions, onChange, disabled = false, onStatus }: CategoriesStepProps) {
  const t = useTranslations('onboarding')
  const tCategory = useTranslations('hojaCategoria')
  const tReordenar = useTranslations('modoReordenar')
  const toasts = Toast.useToastManager()
  const listId = useId()
  const [composer, setComposer] = useState('')
  const [composerError, setComposerError] = useState<'duplicate' | null>(null)
  // Chips tapped and not yet gone: fading for 150 ms, then removed.
  const [taken, setTaken] = useState<Record<string, 'leaving' | 'gone'>>({})
  const [editing, setEditing] = useState<{ id: string; name: string } | null>(null)
  const [pickerId, setPickerId] = useState<string | null>(null)
  const [dragVisual, setDragVisual] = useState<DragVisual | null>(null)
  const dragRef = useRef<DragGesture | null>(null)
  const rowNodes = useRef(new Map<string, HTMLLIElement>())
  const listRef = useRef<HTMLUListElement>(null)
  const newCount = useRef(0)
  // The latest list, for the undo of a delete and a drop that land after other edits.
  const latest = useRef(categories)
  useEffect(() => {
    latest.current = categories
  }, [categories])

  const allSuggestions = t.raw('sugerencias') as string[]
  const colors = chipColors(allSuggestions)
  const suggestions = allSuggestions.filter((name) => {
    const state = taken[name]
    if (state === 'gone') return false
    const exists = categories.some((category) => foldName(category.name) === foldName(name))
    return !exists || state === 'leaving'
  })

  function isDuplicate(name: string, exceptId?: string): boolean {
    return latest.current.some((category) => category.id !== exceptId && foldName(category.name) === foldName(name))
  }

  /** Adds a row; a chip hands over its own colour unless a category already wears it. */
  function add(name: string, preferred?: CategoryColor): boolean {
    if (isDuplicate(name)) return false
    const rows = latest.current
    const color = preferred && !rows.some((row) => row.color === preferred) ? preferred : randomColor(rows)
    newCount.current += 1
    onChange([...rows, { id: `${NEW_PREFIX}${listId}-${newCount.current}`, name: name.trim(), color }])
    onStatus(t('categorias.creada'))
    return true
  }

  function takeSuggestion(name: string) {
    if (!add(name, colors[name])) return
    setTaken((prev) => ({ ...prev, [name]: 'leaving' }))
    setTimeout(() => setTaken((prev) => ({ ...prev, [name]: 'gone' })), CHIP_FADE_MS)
  }

  function submitComposer(event: FormEvent) {
    event.preventDefault()
    const name = composer.trim()
    if (!name || disabled) return
    if (add(name)) {
      setComposer('')
      setComposerError(null)
    } else {
      setComposerError('duplicate')
    }
  }

  function rename(category: DraftCategory, name: string) {
    setEditing(null)
    const trimmed = name.trim()
    if (!trimmed || trimmed === category.name) return
    if (isDuplicate(trimmed, category.id)) {
      toasts.add({ title: tCategory('nombreDuplicado'), priority: 'high' })
      return
    }
    onChange(latest.current.map((row) => (row.id === category.id ? { ...row, name: trimmed } : row)))
    onStatus(tCategory('cambiosGuardados'))
  }

  function recolour(category: DraftCategory, color: CategoryColor) {
    setPickerId(null)
    if (color === category.color) return
    onChange(latest.current.map((row) => (row.id === category.id ? { ...row, color } : row)))
  }

  async function remove(category: DraftCategory) {
    // A category holding a definition keeps it: the person removes the fixed expense first (D8).
    if (definitions.some((definition) => definition.categoryId === category.id)) {
      toasts.add({ title: t('categorias.tieneFijos'), priority: 'high' })
      throw new Error('category-not-empty')
    }
    const index = latest.current.findIndex((row) => row.id === category.id)
    onChange(latest.current.filter((row) => row.id !== category.id))
    // Its suggestion chip, if it was one, comes back.
    setTaken((prev) => {
      const next = { ...prev }
      delete next[category.name]
      return next
    })
    toasts.close()
    const id = toasts.add({
      title: t('categorias.eliminada'),
      priority: 'low',
      actionProps: {
        children: t('categorias.deshacer'),
        onClick: () => {
          const rows = latest.current
          if (!rows.some((row) => row.id === category.id)) {
            onChange([...rows.slice(0, index), category, ...rows.slice(index)])
          }
          toasts.close(id)
        },
      },
    })
  }

  // ── Reorder, always on from the handle: the dashboard's drag (lift, neighbour shift, FLIP settle) ──

  function startDrag(event: ReactPointerEvent, categoryId: string, index: number) {
    if (disabled || dragRef.current) return
    setPickerId(null)
    setEditing(null)
    const node = rowNodes.current.get(categoryId)
    const list = listRef.current
    if (!node || !list) return
    const gap = parseFloat(getComputedStyle(list).rowGap || '0')
    const rowHeight = node.getBoundingClientRect().height + gap
    if (rowHeight <= 0) return

    event.currentTarget.setPointerCapture(event.pointerId)
    const reducedMotion = prefersReducedMotion()
    dragRef.current = {
      pointerId: event.pointerId,
      categoryId,
      startIndex: index,
      startClientY: event.clientY,
      rowHeight,
      order: latest.current,
      targetIndex: index,
      moved: false,
      reducedMotion,
    }
    node.style.willChange = 'transform'
    // Only the shadow is transitioned: a transition on transform would lag the row behind the finger.
    node.style.transition = reducedMotion ? 'none' : 'box-shadow 200ms var(--ease-spring)'
    node.style.transform = reducedMotion ? 'translateY(0px)' : 'translateY(0px) scale(1.03)'
    node.style.boxShadow = LIFTED_SHADOW
    setDragVisual({ categoryId, startIndex: index, targetIndex: index, rowHeight })
  }

  function applyDragFrame(gesture: DragGesture, clientY: number) {
    const rawDelta = clientY - gesture.startClientY
    const maxIndex = gesture.order.length - 1
    const minY = -(gesture.startIndex * gesture.rowHeight)
    const maxY = (maxIndex - gesture.startIndex) * gesture.rowHeight
    let visualY = rawDelta
    if (rawDelta < minY) visualY = minY + rubberBand(rawDelta - minY, gesture.rowHeight)
    else if (rawDelta > maxY) visualY = maxY + rubberBand(rawDelta - maxY, gesture.rowHeight)

    const node = rowNodes.current.get(gesture.categoryId)
    if (node) node.style.transform = gesture.reducedMotion ? `translateY(${visualY}px)` : `translateY(${visualY}px) scale(1.03)`

    // Every row has the same height in this mode, so the target index is a division.
    const targetIndex = clampIndex(gesture.startIndex + Math.round(rawDelta / gesture.rowHeight), 0, maxIndex)
    if (targetIndex !== gesture.targetIndex) {
      gesture.targetIndex = targetIndex
      setDragVisual({ categoryId: gesture.categoryId, startIndex: gesture.startIndex, targetIndex, rowHeight: gesture.rowHeight })
    }
  }

  function handleDragPointerMove(event: ReactPointerEvent) {
    const gesture = dragRef.current
    if (!gesture || gesture.pointerId !== event.pointerId) return
    if (!gesture.moved && Math.abs(event.clientY - gesture.startClientY) > DRAG_MOVE_THRESHOLD_PX) gesture.moved = true
    applyDragFrame(gesture, event.clientY)
  }

  // After a DOM reorder the settle is a FLIP: land at the compensating offset, then travel to rest.
  function settleDraggedNode(node: HTMLLIElement | undefined, beforeTop?: number) {
    if (!node) return
    if (prefersReducedMotion()) {
      node.style.transition = ''
      node.style.transform = ''
      node.style.willChange = ''
      node.style.boxShadow = ''
      return
    }
    node.style.transition = 'none'
    node.style.transform = 'translateY(0px) scale(1)'
    if (beforeTop != null) {
      node.getBoundingClientRect()
      const delta = beforeTop - node.getBoundingClientRect().top
      if (delta) node.style.transform = `translateY(${delta}px) scale(1)`
    }
    node.getBoundingClientRect()
    requestAnimationFrame(() => {
      node.style.transition = 'transform 260ms var(--ease-spring), box-shadow 260ms ease-out'
      node.style.transform = 'translateY(0px) scale(1)'
      node.style.boxShadow = ''
    })
    const clear = (event: TransitionEvent) => {
      if (event.propertyName !== 'transform') return
      node.removeEventListener('transitionend', clear)
      node.style.transition = ''
      node.style.transform = ''
      node.style.willChange = ''
      node.style.boxShadow = ''
    }
    node.addEventListener('transitionend', clear)
  }

  function endDrag(event: ReactPointerEvent) {
    const gesture = dragRef.current
    if (!gesture || gesture.pointerId !== event.pointerId) return
    dragRef.current = null
    const node = rowNodes.current.get(gesture.categoryId)
    setDragVisual(null)

    if (!gesture.moved || gesture.targetIndex === gesture.startIndex) {
      settleDraggedNode(node)
      return
    }
    // Reordering the DOM cancels an in-flight transition on a moved node: flush first, then settle.
    const beforeTop = node?.getBoundingClientRect().top
    flushSync(() => onChange(moveRow(gesture.order, gesture.startIndex, gesture.targetIndex)))
    settleDraggedNode(node, beforeTop)
  }

  function cancelDrag(event: ReactPointerEvent) {
    const gesture = dragRef.current
    if (!gesture || gesture.pointerId !== event.pointerId) return
    dragRef.current = null
    setDragVisual(null)
    settleDraggedNode(rowNodes.current.get(gesture.categoryId))
  }

  // Keyboard: a whole-list FLIP from the old positions to the new ones (reduced motion jumps).
  function moveCategory(index: number, direction: -1 | 1) {
    const rows = latest.current
    const target = index + direction
    if (target < 0 || target >= rows.length) return
    const newOrder = moveRow(rows, index, target)
    onStatus(tReordenar('movido', { categoria: rows[index].name, posicion: target + 1, total: rows.length }))
    if (prefersReducedMotion()) {
      onChange(newOrder)
      return
    }
    const before = new Map<string, number>()
    rowNodes.current.forEach((node, id) => before.set(id, node.getBoundingClientRect().top))
    flushSync(() => onChange(newOrder))
    rowNodes.current.forEach((node, id) => {
      const previousTop = before.get(id)
      if (previousTop == null) return
      const delta = previousTop - node.getBoundingClientRect().top
      if (delta === 0) return
      node.style.transition = 'none'
      node.style.transform = `translateY(${delta}px)`
      node.getBoundingClientRect()
      requestAnimationFrame(() => {
        node.style.transition = 'transform 300ms var(--ease-in-out)'
        node.style.transform = ''
      })
    })
  }

  return (
    <div className="flex flex-col gap-4">
      <h1 className="font-display text-headline-lg text-foreground">{t('categorias.titulo')}</h1>

      {suggestions.length > 0 ? (
        <div role="group" aria-label={t('categorias.sugeridas')} className="flex flex-wrap gap-2">
          {suggestions.map((name) => {
            const index = allSuggestions.indexOf(name)
            return (
              <button
                key={name}
                type="button"
                data-leaving={taken[name] === 'leaving' || undefined}
                data-chip-color={colors[name]}
                disabled={disabled}
                onClick={() => takeSuggestion(name)}
                // Each chip drifts on its own phase and period, so the row never bobs in unison.
                style={
                  {
                    '--chip-color': `var(--cat-${colors[name]})`,
                    '--float-delay': `${-index * 430}ms`,
                    '--float-duration': `${2800 + (index % 4) * 300}ms`,
                  } as CSSProperties
                }
                className="onboarding-chip onboarding-suggestion h-9 rounded-full border px-4 text-body-md font-medium text-foreground outline-none focus-visible:outline-2 focus-visible:outline-offset-2"
              >
                {name}
              </button>
            )
          })}
        </div>
      ) : null}

      <div className="rounded-card border bg-card">
        <form onSubmit={submitComposer} className="flex min-h-row items-center gap-3 px-inset py-2">
          <input
            type="text"
            aria-label={t('categorias.nombre')}
            placeholder={t('categorias.nombre')}
            autoCapitalize="sentences"
            enterKeyHint="done"
            aria-invalid={composerError != null || undefined}
            aria-describedby={composerError ? `${listId}-composer-error` : undefined}
            readOnly={disabled}
            value={composer}
            onChange={(event) => {
              setComposer(event.target.value)
              setComposerError(null)
            }}
            className="field-focus min-w-0 flex-1 rounded-lg bg-muted px-3 py-1.5 text-body-lg text-foreground outline-none placeholder:text-muted-foreground/70"
          />
          <button
            type="submit"
            disabled={disabled || composer.trim() === ''}
            className="onboarding-button h-10 shrink-0 rounded-full px-3 text-body-lg font-medium text-brand-ink outline-none focus-visible:outline-2 disabled:opacity-50"
          >
            {t('categorias.anadir')}
          </button>
        </form>
        {composerError ? (
          <p id={`${listId}-composer-error`} role="alert" className="px-inset pb-3 text-body-sm text-destructive-ink">
            {tCategory('nombreDuplicado')}
          </p>
        ) : null}
      </div>

      {categories.length > 0 ? (
        <ul ref={listRef} aria-label={t('categorias.lista')} className="flex flex-col gap-2">
          {categories.map((category, index) => {
            const isEditing = editing?.id === category.id
            const isDragging = dragVisual?.categoryId === category.id
            const shift = dragVisual && !isDragging ? neighbourShift(index, dragVisual) : 0
            const colorLabelId = `${listId}-${category.id}-color`
            return (
              <li
                key={category.id}
                ref={(node) => {
                  if (node) rowNodes.current.set(category.id, node)
                  else rowNodes.current.delete(category.id)
                }}
                className={cn('relative', !isDragging && 'onboarding-reorder-row', isDragging && 'z-10 rounded-card')}
                style={!isDragging && shift ? { transform: `translateY(${shift}px)` } : undefined}
              >
                {/* The category's colour frames its row, as the dashboard's open card does. */}
                <div className="onboarding-row overflow-hidden rounded-card border bg-card" style={{ borderColor: `var(--cat-${category.color})` }}>
                  <SwipeToDelete rowId={category.id} onDelete={() => remove(category)}>
                    <div className="flex min-h-row items-center gap-3 ps-inset">
                      <button
                        type="button"
                        id={colorLabelId}
                        aria-label={t('categorias.color', { categoria: category.name })}
                        aria-expanded={pickerId === category.id}
                        disabled={disabled}
                        onClick={() => setPickerId((prev) => (prev === category.id ? null : category.id))}
                        className="onboarding-button grid size-9 shrink-0 place-items-center rounded-full outline-none focus-visible:outline-2"
                      >
                        <CategoryDot color={category.color} className="size-3" />
                      </button>
                      {isEditing ? (
                        <input
                          type="text"
                          autoFocus
                          aria-label={t('categorias.renombrar', { categoria: category.name })}
                          enterKeyHint="done"
                          value={editing.name}
                          onChange={(event) => setEditing({ id: category.id, name: event.target.value })}
                          onBlur={() => rename(category, editing.name)}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter') event.currentTarget.blur()
                            if (event.key === 'Escape') setEditing(null)
                          }}
                          className="field-focus min-w-0 flex-1 rounded-lg bg-muted px-2 py-1 text-body-lg text-foreground outline-none"
                        />
                      ) : (
                        <button
                          type="button"
                          aria-label={t('categorias.renombrar', { categoria: category.name })}
                          disabled={disabled}
                          onClick={() => setEditing({ id: category.id, name: category.name })}
                          className="min-w-0 flex-1 truncate py-2 text-left text-body-lg text-foreground outline-none focus-visible:outline-2"
                        >
                          {category.name}
                        </button>
                      )}
                      {/* The handle lives inside the swipeable content so it slides with the row; its
                          pointer events stop here so the swipe never sees a drag. */}
                      <button
                        type="button"
                        aria-label={tReordenar('mover', { categoria: category.name, posicion: index + 1, total: categories.length })}
                        disabled={disabled}
                        onPointerDown={(event) => {
                          event.stopPropagation()
                          startDrag(event, category.id, index)
                        }}
                        onPointerMove={(event) => {
                          event.stopPropagation()
                          handleDragPointerMove(event)
                        }}
                        onPointerUp={(event) => {
                          event.stopPropagation()
                          endDrag(event)
                        }}
                        onPointerCancel={(event) => {
                          event.stopPropagation()
                          cancelDrag(event)
                        }}
                        onKeyDown={(event) => {
                          if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') return
                          event.preventDefault()
                          moveCategory(index, event.key === 'ArrowUp' ? -1 : 1)
                        }}
                        className={cn(
                          'grid min-h-row w-11 shrink-0 touch-none place-items-center self-stretch text-muted-foreground outline-none hover-fine:hover:text-foreground focus-visible:outline-2',
                          isDragging ? 'cursor-grabbing' : 'pressable cursor-grab [--press-scale:0.94]',
                        )}
                      >
                        <span aria-hidden className="flex flex-col gap-[3px]">
                          <span className="block h-0.5 w-4 rounded-full bg-current" />
                          <span className="block h-0.5 w-4 rounded-full bg-current" />
                          <span className="block h-0.5 w-4 rounded-full bg-current" />
                        </span>
                      </button>
                    </div>
                  </SwipeToDelete>
                  <Collapsible open={pickerId === category.id}>
                    <div className="pb-3">
                      <ColorSwatchPicker value={category.color} onChange={(color) => recolour(category, color)} labelledBy={colorLabelId} />
                    </div>
                  </Collapsible>
                </div>
              </li>
            )
          })}
        </ul>
      ) : null}
    </div>
  )
}
