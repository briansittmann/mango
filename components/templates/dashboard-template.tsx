'use client'

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from 'react'
import { flushSync } from 'react-dom'
import { Toast } from '@base-ui/react/toast'
import { gsap } from 'gsap'
import { Flip } from 'gsap/Flip'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { useFormatter, useTranslations } from 'next-intl'
import { currencyFormatOptions } from '@/i18n/formats'
import { cn } from '@/lib/utils'
import { Avatar } from '@/components/atoms/avatar'
import { Money } from '@/components/atoms/money'
import { SavingsSparkline } from '@/components/atoms/savings-sparkline'
import { AddCategoryTile } from '@/components/molecules/add-category-tile'
import { AddRow } from '@/components/molecules/add-row'
import { CATEGORY_COLORS } from '@/components/molecules/color-swatch-picker'
import { ExpenseRow } from '@/components/molecules/expense-row'
import { MonthSelector } from '@/components/molecules/month-selector'
import { SavingsMovementRow } from '@/components/molecules/savings-movement-row'
import { SummaryRow } from '@/components/molecules/summary-row'
import { SwipeToDelete } from '@/components/molecules/swipe-to-delete'
import { UndoToast } from '@/components/molecules/undo-toast'
import { AccountMenu } from '@/components/organisms/account-menu'
import { CategoryCard } from '@/components/organisms/category-card'
import { CategoryPieChart } from '@/components/organisms/category-pie-chart'
import { CategorySheet } from '@/components/organisms/category-sheet'
import { EntrySheet, expenseEntry, incomeEntry } from '@/components/organisms/entry-sheet'
import { FreeMarginCard } from '@/components/organisms/free-margin-card'
import { MonthlyBarsChart } from '@/components/organisms/monthly-bars-chart'
import { RecurringSheet } from '@/components/organisms/recurring-sheet'
import { SavingsProgressBar } from '@/components/molecules/savings-progress'
import { SummaryGroup } from '@/components/organisms/summary-group'
import { UpcomingChargesCard } from '@/components/organisms/upcoming-charges-card'
import { AnimatedContent } from '@/components/ui/animated-content'
import type { DashboardActions, DashboardData, Expense, ExpenseGroup } from '@/lib/data/dashboard'
import type { CategoryDraft } from '@/lib/data/categories'
import type { SavingsProgress } from '@/lib/data/savings'

gsap.registerPlugin(ScrollTrigger, Flip)
import type { ExpenseDraft } from '@/lib/data/expenses'
import type { IncomeEntry } from '@/lib/data/income'
import type { RecurringDefinition, RecurringDraft } from '@/lib/data/recurring'
import type { UpcomingCharge } from '@/lib/data/upcoming-charges'

type DashboardTemplateProps = {
  data: DashboardData
  actions: DashboardActions
  charges: UpcomingCharge[]
  definitions: RecurringDefinition[]
  /** Absent exactly when `data.savings.target` is null — computed by the caller (`@/lib/data/savings`). */
  savingsProgress: SavingsProgress | null
  notice?: ReactNode
}

type SummaryKey = 'income' | 'expenses' | 'savings'

type SheetTarget =
  | { kind: 'expense'; mode: 'create'; group: ExpenseGroup }
  | { kind: 'expense'; mode: 'edit'; group: ExpenseGroup; expense: Expense }
  | { kind: 'income'; mode: 'create' }
  | { kind: 'income'; mode: 'edit'; entry: IncomeEntry }

type CategorySheetTarget = { mode: 'create' } | { mode: 'edit'; group: ExpenseGroup }

const BAR_HEIGHT = 56
const UPCOMING_CHARGES_ID = 'proximos-cobros'

function clampDate(date: string, min: string, max: string): string {
  if (date < min) return min
  if (date > max) return max
  return date
}

function localDateOf(dateIso: string, timeZone: string): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(dateIso))
}

function clampIndex(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

// Apple's rubber-band curve. `dimension` is the row height rather than the list's full extent,
// so resistance saturates within about two rows of overshoot instead of needing the whole list's
// height as slack.
function rubberBand(overshoot: number, dimension: number): number {
  const sign = overshoot < 0 ? -1 : 1
  const magnitude = Math.abs(overshoot)
  return (sign * magnitude * dimension * 0.55) / (dimension + 0.55 * magnitude)
}

function arraysEqual(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((value, index) => value === b[index])
}

function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

const DRAG_MOVE_THRESHOLD_PX = 4
/** Two layers, because one blur can only read as either contact or height: the tight one pins the
 *  card's edge to the list, the wide one is the height it was lifted to. */
const LIFTED_SHADOW =
  '0 2px 8px -2px var(--lift-shadow), 0 26px 50px -12px var(--lift-shadow), 0 0 0 1px var(--lift-rim)'
const AUTO_SCROLL_MARGIN_PX = 64
const AUTO_SCROLL_MAX_SPEED_PX = 12

type DragGesture = {
  pointerId: number
  categoryId: string
  startIndex: number
  startClientY: number
  lastClientY: number
  rowHeight: number
  order: string[]
  targetIndex: number
  moved: boolean
  scrollFrame: number | null
  reducedMotion: boolean
}

type DragVisual = { categoryId: string; startIndex: number; targetIndex: number; rowHeight: number }

function neighbourShift(index: number, visual: DragVisual): number {
  const { startIndex, targetIndex, rowHeight } = visual
  if (startIndex === targetIndex) return 0
  if (targetIndex > startIndex) return index > startIndex && index <= targetIndex ? -rowHeight : 0
  return index >= targetIndex && index < startIndex ? rowHeight : 0
}

export function DashboardTemplate({ data, actions, charges, definitions, savingsProgress, notice }: DashboardTemplateProps) {
  const t = useTranslations('dashboard')
  const tResumen = useTranslations('resumen')
  const tMenu = useTranslations('menuCuenta')
  const tHojaGasto = useTranslations('hojaGasto')
  const tHojaCategoria = useTranslations('hojaCategoria')
  const tRecurrente = useTranslations('gastoRecurrente')
  const tReordenar = useTranslations('modoReordenar')
  const format = useFormatter()
  const [openIds, setOpenIds] = useState<Set<string>>(new Set())
  // Categories whose budget bar is hidden from the card, toggled in the category options sheet.
  const [hiddenProgressIds, setHiddenProgressIds] = useState<Set<string>>(new Set())
  const [openSummary, setOpenSummary] = useState<SummaryKey | null>(null)
  const [accountMenuOpen, setAccountMenuOpen] = useState(false)
  const [titleInView, setTitleInView] = useState(true)
  const [sheet, setSheet] = useState<{ open: boolean; target: SheetTarget | null }>({ open: false, target: null })
  const [categorySheet, setCategorySheet] = useState<{ open: boolean; target: CategorySheetTarget | null }>({
    open: false,
    target: null,
  })
  const [recurringSheet, setRecurringSheet] = useState<{ open: boolean; charge: UpcomingCharge | null }>({ open: false, charge: null })
  const [statusMessage, setStatusMessage] = useState('')
  const [reordering, setReordering] = useState(false)
  const [displayedOrder, setDisplayedOrder] = useState<string[] | null>(null)
  const [dragVisual, setDragVisual] = useState<DragVisual | null>(null)
  const titleRef = useRef<HTMLDivElement>(null)
  const expensesRef = useRef<HTMLDivElement>(null)
  const categoryListRef = useRef<HTMLDivElement>(null)
  const doneRef = useRef<HTMLButtonElement>(null)
  const reorderOriginRef = useRef<string | null>(null)
  const cardNodeRefs = useRef(new Map<string, HTMLDivElement>())
  // Held so a later create's Flip capture can kill this tween first, instead of measuring the
  // tile mid-entrance (D6, Risks).
  const tileEntranceTweenRef = useRef<gsap.core.Tween | null>(null)
  const tileScrollTriggerRef = useRef<ScrollTrigger | null>(null)
  // Kept so a create's Flip capture can read the tile's pre-commit box (D6) — the entrance ref
  // callback only fires on mount/unmount, not on every render.
  const tileNodeRef = useRef<HTMLDivElement | null>(null)
  // The tile unmounts in reorder mode (D8) and remounts on leaving it, so its entrance can't be a
  // plain mount effect — a callback ref re-runs on every (re)mount, and this flag makes sure only
  // the very first one (page load) plays the cascade; a remount after reorder just shows it.
  const tileHasEnteredRef = useRef(false)
  const dragGestureRef = useRef<DragGesture | null>(null)
  const reorderingRef = useRef(false)
  const saveRef = useRef<{ inFlight: boolean; queued: string[] | null; committed: string[] }>({
    inFlight: false,
    queued: null,
    committed: [],
  })
  const initialFocusRef = useRef<HTMLInputElement>(null)
  const toasts = useMemo(() => Toast.createToastManager(), [])
  const currency = data.user.currency

  function openCreateSheet(group: ExpenseGroup) {
    flushSync(() => setSheet({ open: true, target: { kind: 'expense', mode: 'create', group } }))
    initialFocusRef.current?.focus({ preventScroll: true })
  }

  function openEditSheet(group: ExpenseGroup, expense: Expense) {
    flushSync(() => setSheet({ open: true, target: { kind: 'expense', mode: 'edit', group, expense } }))
    initialFocusRef.current?.focus({ preventScroll: true })
    initialFocusRef.current?.select()
  }

  function openIncomeCreateSheet() {
    flushSync(() => setSheet({ open: true, target: { kind: 'income', mode: 'create' } }))
    initialFocusRef.current?.focus({ preventScroll: true })
  }

  function openIncomeEditSheet(entry: IncomeEntry) {
    flushSync(() => setSheet({ open: true, target: { kind: 'income', mode: 'edit', entry } }))
    initialFocusRef.current?.focus({ preventScroll: true })
    initialFocusRef.current?.select()
  }

  function openCategorySheet(group: ExpenseGroup) {
    setCategorySheet({ open: true, target: { mode: 'edit', group } })
  }

  function openCreateCategorySheet() {
    setCategorySheet({ open: true, target: { mode: 'create' } })
  }

  function openRecurringSheet(charge: UpcomingCharge) {
    setRecurringSheet({ open: true, charge })
  }

  function handleEnterReorder() {
    // The sheet closes and the mode turns on in the same tick, so the sheet's exit scrim and the
    // reorder overlay crossfade as one dimming instead of two events (D11).
    reorderOriginRef.current = categorySheetTargetGroup?.id ?? null
    setCategorySheet((prev) => ({ ...prev, open: false }))
    const ids = data.expenses.groups.map((group) => group.id)
    saveRef.current = { inFlight: false, queued: null, committed: ids }
    flushSync(() => {
      setReordering(true)
      setDisplayedOrder(ids)
    })
    categoryListRef.current?.scrollIntoView({ block: 'start' })
    doneRef.current?.focus({ preventScroll: true })
  }

  // One save in flight; a move that lands while it is running is queued behind it rather than
  // sent concurrently, since two calls could resolve out of order (D8).
  async function sendReorder(order: string[]) {
    if (!actions.categories) return
    if (saveRef.current.inFlight) {
      saveRef.current.queued = order
      return
    }
    saveRef.current.inFlight = true
    let failed = false
    try {
      await actions.categories.reorder(order)
      saveRef.current.committed = order
    } catch {
      failed = true
      animateOrderChange(saveRef.current.committed)
      toasts.add({ title: tReordenar('errorGuardarOrden'), priority: 'high' })
    }
    saveRef.current.inFlight = false
    const queued = saveRef.current.queued
    saveRef.current.queued = null
    if (failed) {
      if (!reorderingRef.current) setDisplayedOrder(null)
      return
    }
    if (queued) {
      void sendReorder(queued)
    } else if (!reorderingRef.current) {
      setDisplayedOrder(null)
    }
  }

  // A whole-list FLIP: capture positions, commit the new order, then travel from the old
  // position to the new one instead of jumping — used for the failure revert (D8). Reduced
  // motion drops the travel: the card appears in its reverted position directly (D12).
  function animateOrderChange(newOrder: string[]) {
    if (prefersReducedMotion()) {
      setDisplayedOrder(newOrder)
      return
    }
    const nodes = cardNodeRefs.current
    const before = new Map<string, number>()
    nodes.forEach((node, id) => before.set(id, node.getBoundingClientRect().top))

    flushSync(() => setDisplayedOrder(newOrder))

    nodes.forEach((node, id) => {
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

  async function moveCategory(index: number, direction: -1 | 1) {
    if (!actions.categories) return
    const order = displayedOrder ?? data.expenses.groups.map((group) => group.id)
    const target = index + direction
    if (target < 0 || target >= order.length) return
    const newOrder = [...order]
    const [movedId] = newOrder.splice(index, 1)
    newOrder.splice(target, 0, movedId)
    setStatusMessage(
      tReordenar('movido', {
        categoria: findGroupName(movedId),
        posicion: target + 1,
        total: newOrder.length,
      }),
    )
    setDisplayedOrder(newOrder)
    void sendReorder(newOrder)
  }

  function startDrag(event: ReactPointerEvent, categoryId: string, index: number) {
    if (!reordering || !actions.categories) return
    if (dragGestureRef.current) return // a second pointer touching mid-drag is ignored (7.1)
    const node = cardNodeRefs.current.get(categoryId)
    const list = categoryListRef.current
    if (!node || !list) return
    const gap = parseFloat(getComputedStyle(list).rowGap || '0')
    const rowHeight = node.getBoundingClientRect().height + gap
    if (rowHeight <= 0) return

    event.currentTarget.setPointerCapture(event.pointerId)
    const order = displayedOrder ?? data.expenses.groups.map((group) => group.id)
    const reducedMotion = prefersReducedMotion()
    dragGestureRef.current = {
      pointerId: event.pointerId,
      categoryId,
      startIndex: index,
      startClientY: event.clientY,
      lastClientY: event.clientY,
      rowHeight,
      order,
      targetIndex: index,
      moved: false,
      scrollFrame: null,
      reducedMotion,
    }
    if (!displayedOrder) setDisplayedOrder(order)
    node.style.willChange = 'transform'
    // Only `box-shadow` is transitioned, so the lift eases in while the transform keeps tracking
    // the pointer 1:1 — a transition on transform would lag the card behind the finger.
    node.style.transition = reducedMotion ? 'none' : `box-shadow 200ms var(--ease-spring)`
    // Reduced motion drops the lift scale; the held card still tracks the pointer 1:1 (D12).
    node.style.transform = reducedMotion ? 'translateY(0px)' : 'translateY(0px) scale(1.03)'
    node.style.boxShadow = LIFTED_SHADOW
    setDragVisual({ categoryId, startIndex: index, targetIndex: index, rowHeight })
  }

  // The card's transform is always the pointer's own movement since it started (equivalent to
  // design.md D5's `pointerY − grabOffset`, minus the constant original top, which cancels out).
  function applyDragFrame(gesture: DragGesture, clientY: number) {
    const rawDelta = clientY - gesture.startClientY
    const maxIndex = gesture.order.length - 1
    const minY = -(gesture.startIndex * gesture.rowHeight)
    const maxY = (maxIndex - gesture.startIndex) * gesture.rowHeight
    let visualY = rawDelta
    if (rawDelta < minY) visualY = minY + rubberBand(rawDelta - minY, gesture.rowHeight)
    else if (rawDelta > maxY) visualY = maxY + rubberBand(rawDelta - maxY, gesture.rowHeight)

    const node = cardNodeRefs.current.get(gesture.categoryId)
    if (node) node.style.transform = gesture.reducedMotion ? `translateY(${visualY}px)` : `translateY(${visualY}px) scale(1.03)`

    // Every card is collapsed to the same height in this mode, so the target index is a
    // division rather than a per-card measurement or hit test (D5, Risks). A future addition
    // that varies a card's height in this mode breaks this into off-by-one drops.
    const targetIndex = clampIndex(gesture.startIndex + Math.round(rawDelta / gesture.rowHeight), 0, maxIndex)
    if (targetIndex !== gesture.targetIndex) {
      gesture.targetIndex = targetIndex
      setDragVisual({ categoryId: gesture.categoryId, startIndex: gesture.startIndex, targetIndex, rowHeight: gesture.rowHeight })
    }
  }

  function runAutoScroll(gesture: DragGesture) {
    const margin = AUTO_SCROLL_MARGIN_PX
    const viewportHeight = window.innerHeight
    const y = gesture.lastClientY
    let speed = 0
    if (y < margin) speed = -AUTO_SCROLL_MAX_SPEED_PX * (1 - y / margin)
    else if (y > viewportHeight - margin) speed = AUTO_SCROLL_MAX_SPEED_PX * (1 - (viewportHeight - y) / margin)

    if (speed === 0) {
      if (gesture.scrollFrame != null) {
        cancelAnimationFrame(gesture.scrollFrame)
        gesture.scrollFrame = null
      }
      return
    }
    if (gesture.scrollFrame != null) return

    const step = () => {
      if (dragGestureRef.current !== gesture) return
      window.scrollBy(0, speed)
      // The drag's origin moves with the scroll so 1:1 tracking survives it (7.7).
      gesture.startClientY -= speed
      applyDragFrame(gesture, gesture.lastClientY)
      gesture.scrollFrame = requestAnimationFrame(step)
    }
    gesture.scrollFrame = requestAnimationFrame(step)
  }

  function handleDragPointerMove(event: ReactPointerEvent) {
    const gesture = dragGestureRef.current
    if (!gesture || gesture.pointerId !== event.pointerId) return
    gesture.lastClientY = event.clientY
    if (!gesture.moved && Math.abs(event.clientY - gesture.startClientY) > DRAG_MOVE_THRESHOLD_PX) gesture.moved = true
    applyDragFrame(gesture, event.clientY)
    runAutoScroll(gesture)
  }

  // `beforeTop` is the node's visual top (with its held transform, before any DOM reorder) —
  // reordering the DOM cancels an in-flight transition on a moved node, so when the caller has
  // just flushed a reorder, the settle is a FLIP: land at the compensating offset first, then
  // transition from there to rest, instead of transitioning across a reorder that would cancel it.
  function settleDraggedNode(node: HTMLDivElement | undefined, beforeTop?: number) {
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
      node.getBoundingClientRect() // force reflow: read the new resting position with transform cleared
      const delta = beforeTop - node.getBoundingClientRect().top
      if (delta) node.style.transform = `translateY(${delta}px) scale(1)`
    }
    node.getBoundingClientRect() // force reflow: paint the starting position before animating away from it
    requestAnimationFrame(() => {
      // The shadow lands with the card instead of being cut at the end of the settle.
      node.style.transition = 'transform 260ms var(--ease-spring), box-shadow 260ms ease-out'
      node.style.transform = 'translateY(0px) scale(1)'
      node.style.boxShadow = ''
    })
    const clear = (event: TransitionEvent) => {
      // Both properties settle together, so waiting on the transform keeps the shadow's own
      // `transitionend` from clearing the inline styles while the card is still travelling.
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
    const gesture = dragGestureRef.current
    if (!gesture || gesture.pointerId !== event.pointerId) return
    dragGestureRef.current = null
    if (gesture.scrollFrame != null) cancelAnimationFrame(gesture.scrollFrame)
    const node = cardNodeRefs.current.get(gesture.categoryId)
    setDragVisual(null)

    if (!gesture.moved) {
      if (node) {
        node.style.transform = ''
        node.style.transition = ''
        node.style.willChange = ''
        node.style.boxShadow = ''
      }
      return
    }

    const newOrder = [...gesture.order]
    const [movedId] = newOrder.splice(gesture.startIndex, 1)
    newOrder.splice(gesture.targetIndex, 0, movedId)
    const reordered = !arraysEqual(newOrder, gesture.order)

    // Reordering the DOM cancels an in-flight transition on a node it moves, so the reorder is
    // flushed before the settle starts rather than concurrently with it.
    const beforeTop = reordered ? node?.getBoundingClientRect().top : undefined
    if (reordered) flushSync(() => setDisplayedOrder(newOrder))
    settleDraggedNode(node, beforeTop)

    if (reordered) void sendReorder(newOrder)
  }

  function cancelDrag(event: ReactPointerEvent) {
    const gesture = dragGestureRef.current
    if (!gesture || gesture.pointerId !== event.pointerId) return
    dragGestureRef.current = null
    if (gesture.scrollFrame != null) cancelAnimationFrame(gesture.scrollFrame)
    setDragVisual(null)
    settleDraggedNode(cardNodeRefs.current.get(gesture.categoryId))
  }

  const leaveReorder = useCallback(() => {
    flushSync(() => setReordering(false))
    if (!saveRef.current.inFlight) setDisplayedOrder(null)
    const originId = reorderOriginRef.current
    if (!originId) return
    document
      .querySelector<HTMLButtonElement>(`[data-category-options="${originId}"]`)
      ?.focus({ preventScroll: true })
  }, [])

  async function handleSaveCategory(categoryId: string, draft: CategoryDraft) {
    if (!actions.categories) return
    await actions.categories.update(categoryId, draft)
    setCategorySheet((prev) => ({ ...prev, open: false }))
    setStatusMessage(tHojaCategoria('cambiosGuardados'))
  }

  async function handleDeleteCategory(categoryId: string, reassignTo: string | null) {
    if (!actions.categories) return
    await actions.categories.delete(categoryId, reassignTo)
    setCategorySheet((prev) => ({ ...prev, open: false }))
    setStatusMessage(tHojaCategoria('categoriaEliminada'))
  }

  // Kills every card's still-running entrance tween and the tile's own, and settles each at its
  // final transform-free box, so a create within the ~800ms cascade window gives Flip a settled
  // "before" state to capture rather than one mid-tween (D6, Risks — 6.3).
  function settleEntranceTweens() {
    tileEntranceTweenRef.current?.kill()
    tileEntranceTweenRef.current = null
    tileScrollTriggerRef.current?.kill()
    tileScrollTriggerRef.current = null
    tileHasEnteredRef.current = true
    if (tileNodeRef.current) gsap.set(tileNodeRef.current, { clearProps: 'transform,opacity', visibility: 'visible' })
    cardNodeRefs.current.forEach((node) => {
      const wrapper = node.parentElement
      if (!wrapper) return
      gsap.killTweensOf(wrapper)
      gsap.set(wrapper, { clearProps: 'transform,opacity', visibility: 'visible' })
    })
  }

  // The create path's motion (D6): the tile's rect and a Flip.getState() over the settled cards
  // and the tile are captured before the commit; `flushSync` puts the new card and the relocated
  // tile in the DOM in the same frame the capture assumed, so `Flip.from` can travel every
  // pre-existing box from its old position without a jump, while the new card is tweened by hand
  // from the tile's old box into its own, its content fading in as a dashed-border overlay
  // (D6, 6.2) cross-fades out over its real solid border. Reduced motion skips straight to a plain
  // commit (D7, 6.4).
  async function handleCreateCategory(draft: CategoryDraft): Promise<string> {
    if (!actions.categories) throw new Error('missing category operations')
    const reduced = prefersReducedMotion()

    let tileRect: DOMRect | undefined
    let flipState: Flip.FlipState | undefined
    if (!reduced) {
      settleEntranceTweens()
      tileRect = tileNodeRef.current?.getBoundingClientRect()
      const targets = [...cardNodeRefs.current.values(), tileNodeRef.current].filter(
        (node): node is HTMLDivElement => node != null,
      )
      flipState = Flip.getState(targets)
    }

    let createPromise!: Promise<string>
    flushSync(() => {
      createPromise = actions.categories!.create(draft)
    })
    const id = await createPromise

    setCategorySheet((prev) => ({ ...prev, open: false }))
    setStatusMessage(tHojaCategoria('categoriaCreada'))

    if (reduced || !flipState || !tileRect) return id

    Flip.from(flipState, { duration: 0.4, ease: 'power2.out' })

    const cardWrapper = cardNodeRefs.current.get(id)
    if (cardWrapper) {
      const cardRect = cardWrapper.getBoundingClientRect()
      const overlay = document.createElement('div')
      overlay.setAttribute('aria-hidden', 'true')
      overlay.className =
        'pointer-events-none absolute inset-0 rounded-card border border-dashed border-muted-foreground/50'
      cardWrapper.appendChild(overlay)

      // The card's own markup (dot, name, solid border) is the wrapper's first child; fading it
      // in while the dashed overlay fades out is the border cross-fade 6.2 asks for, since
      // `border-style` itself does not interpolate.
      const contentNode = cardWrapper.firstElementChild as HTMLElement | null

      gsap.fromTo(
        cardWrapper,
        {
          x: tileRect.left - cardRect.left,
          y: tileRect.top - cardRect.top,
          scaleX: cardRect.width ? tileRect.width / cardRect.width : 1,
          scaleY: cardRect.height ? tileRect.height / cardRect.height : 1,
          transformOrigin: 'top left',
        },
        { x: 0, y: 0, scaleX: 1, scaleY: 1, duration: 0.4, ease: 'power2.out' },
      )
      if (contentNode) {
        gsap.fromTo(contentNode, { opacity: 0 }, { opacity: 1, duration: 0.2, delay: 0.2, ease: 'power1.out' })
      }
      gsap.to(overlay, {
        opacity: 0,
        duration: 0.4,
        ease: 'power2.out',
        onComplete: () => overlay.remove(),
      })
    }

    return id
  }

  function showUndo(expense: Expense) {
    toasts.close()
    const id = toasts.add({
      title: tHojaGasto('gastoEliminado'),
      priority: 'low',
      actionProps: { children: tHojaGasto('deshacer'), onClick: () => void undoDelete(id, expense) },
    })
  }

  async function undoDelete(id: string, expense: Expense) {
    if (!actions.expenses) return
    try {
      await actions.expenses.restore(expense.id)
      toasts.close(id)
    } catch {
      toasts.update(id, { title: tHojaGasto('errorDeshacer'), priority: 'high', actionProps: undefined })
    }
  }

  async function handleDeleteExpense(expense: Expense) {
    if (!actions.expenses) return
    try {
      await actions.expenses.softDelete(expense.id)
      showUndo(expense)
    } catch (error) {
      toasts.add({ title: tHojaGasto('errorEliminar'), priority: 'high' })
      throw error
    }
  }

  function showIncomeUndo(entry: IncomeEntry) {
    toasts.close()
    const id = toasts.add({
      title: tHojaGasto('ingresoEliminado'),
      priority: 'low',
      actionProps: { children: tHojaGasto('deshacer'), onClick: () => void undoIncomeDelete(id, entry) },
    })
  }

  async function undoIncomeDelete(id: string, entry: IncomeEntry) {
    if (!actions.income) return
    try {
      await actions.income.restore(entry.id)
      toasts.close(id)
    } catch {
      toasts.update(id, { title: tHojaGasto('errorDeshacer'), priority: 'high', actionProps: undefined })
    }
  }

  async function handleDeleteIncome(entry: IncomeEntry) {
    if (!actions.income) return
    try {
      await actions.income.softDelete(entry.id)
      showIncomeUndo(entry)
    } catch (error) {
      toasts.add({ title: tHojaGasto('errorEliminarIngreso'), priority: 'high' })
      throw error
    }
  }

  async function handleSheetDelete() {
    if (sheet.target?.mode !== 'edit') return
    if (sheet.target.kind === 'income') {
      if (!actions.income) return
      const entry = sheet.target.entry
      await actions.income.softDelete(entry.id)
      setSheet((prev) => ({ ...prev, open: false }))
      showIncomeUndo(entry)
      return
    }
    if (!actions.expenses) return
    const expense = sheet.target.expense
    await actions.expenses.softDelete(expense.id)
    setSheet((prev) => ({ ...prev, open: false }))
    showUndo(expense)
  }

  async function handleSaveEntry(values: ExpenseDraft) {
    if (!sheet.target) return
    if (sheet.target.kind === 'income') {
      if (!actions.income) return
      if (sheet.target.mode === 'create') {
        await actions.income.create(values)
      } else {
        await actions.income.update(sheet.target.entry.id, values)
      }
      setSheet((prev) => ({ ...prev, open: false }))
      setStatusMessage(sheet.target.mode === 'create' ? tHojaGasto('ingresoAnadido') : tHojaGasto('cambiosGuardados'))
      return
    }
    if (!actions.expenses) return
    if (sheet.target.mode === 'create') {
      await actions.expenses.create(sheet.target.group.id, values)
    } else {
      await actions.expenses.update(sheet.target.expense.id, values)
    }
    setSheet((prev) => ({ ...prev, open: false }))
    setStatusMessage(sheet.target.mode === 'create' ? tHojaGasto('gastoAnadido') : tHojaGasto('cambiosGuardados'))
  }

  async function handleSaveRecurrence(draft: RecurringDraft) {
    if (!actions.recurring || sheet.target?.mode !== 'create') return
    if (sheet.target.kind === 'income') {
      await actions.recurring.create({ tipo: 'ingreso' }, draft)
      return
    }
    await actions.recurring.create({ tipo: 'gasto', categoryId: sheet.target.group.id }, draft)
  }

  async function handleSaveDefinition(definitionId: string, draft: RecurringDraft) {
    if (!actions.recurring) return
    await actions.recurring.update(definitionId, draft)
    setRecurringSheet((prev) => ({ ...prev, open: false }))
    setStatusMessage(
      tRecurrente('cambiosGuardados', { nombre: draft.name, monto: format.number(draft.expectedAmount, { ...currencyFormatOptions, currency }) }),
    )
  }

  async function handleStopDefinition(definitionId: string) {
    if (!actions.recurring) return
    await actions.recurring.stop(definitionId)
    setRecurringSheet((prev) => ({ ...prev, open: false }))
  }

  async function handleDeleteDefinition(definitionId: string) {
    if (!actions.recurring) return
    await actions.recurring.delete(definitionId)
    setRecurringSheet((prev) => ({ ...prev, open: false }))
  }

  const sheetIsIncome = sheet.target?.kind === 'income'
  const sheetGroup = sheet.target?.kind === 'expense' ? sheet.target.group : data.expenses.groups[0]
  const sheetContext =
    sheet.target?.kind === 'income'
      ? { kind: 'income' as const, recurring: sheet.target.mode === 'edit' && sheet.target.entry.recurring != null }
      : {
          kind: 'category' as const,
          name: sheetGroup.name,
          color: sheetGroup.color,
          recurring: sheet.target?.mode === 'edit' && sheet.target.expense.fixed != null,
        }
  const sheetInitialValues: Partial<ExpenseDraft> =
    sheet.target?.mode === 'edit'
      ? sheet.target.kind === 'income'
        ? {
            amount: sheet.target.entry.amount,
            description: sheet.target.entry.name,
            date: localDateOf(sheet.target.entry.date, data.user.timezone),
          }
        : {
            amount: sheet.target.expense.amount,
            description: sheet.target.expense.name,
            date: localDateOf(sheet.target.expense.date, data.user.timezone),
          }
      : { date: clampDate(data.cycle.today, data.cycle.start, data.cycle.end) }

  const categorySheetMode = categorySheet.target?.mode ?? 'edit'
  const categorySheetTargetGroup = categorySheet.target?.mode === 'edit' ? categorySheet.target.group : null
  const receivingCategories = data.expenses.groups
    .filter((group) => group.kind === 'category' && group.id !== categorySheetTargetGroup?.id)
    .map((group) => ({ id: group.id, name: group.name ?? '' }))
  // D3: the first colour in the picker's order that no current category uses, falling back to
  // the first entry when every colour is taken.
  const usedCategoryColors = new Set(data.expenses.groups.filter((group) => group.kind === 'category').map((group) => group.color))
  const createCategoryColor = CATEGORY_COLORS.find((color) => !usedCategoryColors.has(color)) ?? CATEGORY_COLORS[0]

  const recurringSheetTarget =
    (recurringSheet.charge ? definitions.find((definition) => definition.id === recurringSheet.charge!.definitionId) : null) ??
    definitions[0]
  const recurringSheetCategory = recurringSheetTarget
    ? data.expenses.groups.find((group) => group.id === recurringSheetTarget.categoryId)
    : undefined
  const recurringSheetCurrentAmount = recurringSheet.charge?.amount ?? recurringSheetTarget?.expectedAmount ?? 0

  useEffect(() => {
    const el = titleRef.current
    if (!el) return
    const observer = new IntersectionObserver(([entry]) => setTitleInView(entry.isIntersecting), {
      rootMargin: `-${BAR_HEIGHT}px 0px 0px 0px`,
      threshold: 0,
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    if (!reordering) return
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') leaveReorder()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [reordering, leaveReorder])

  useEffect(() => {
    reorderingRef.current = reordering
  }, [reordering])

  function toggleProgress(id: string) {
    setHiddenProgressIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleCard(id: string) {
    setOpenIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  function toggleSummary(key: SummaryKey) {
    setOpenSummary((prev) => (prev === key ? null : key))
  }

  function scrollToCategory(id: string) {
    const node = cardNodeRefs.current.get(id)
    if (!node) return
    const openCard = () => setOpenIds((prev) => (prev.has(id) ? prev : new Set(prev).add(id)))
    if (prefersReducedMotion()) {
      node.scrollIntoView({ behavior: 'auto', block: 'start' })
      openCard()
      return
    }
    node.scrollIntoView({ behavior: 'smooth', block: 'start' })
    // scrollIntoView has no completion callback, so the expand animation waits for the scroll
    // position to settle (a few stable frames) before it opens the card.
    let lastY = window.scrollY
    let stableFrames = 0
    const waitForScrollEnd = () => {
      const y = window.scrollY
      if (Math.abs(y - lastY) < 0.5) {
        stableFrames += 1
      } else {
        stableFrames = 0
        lastY = y
      }
      if (stableFrames >= 3) {
        openCard()
        return
      }
      requestAnimationFrame(waitForScrollEnd)
    }
    requestAnimationFrame(waitForScrollEnd)
  }

  // The entrance cascade is fixed at first paint. Deriving it from the current index instead would
  // change AnimatedContent's `delay` every time a card moves, re-running its effect and replaying
  // the entrance on a card the user is in the middle of reordering.
  const [cascadeOrder] = useState(() => data.expenses.groups.map((group) => group.id))
  function cascadeDelay(id: string) {
    const position = cascadeOrder.indexOf(id)
    return 0.48 + Math.min(position < 0 ? 5 : position + 1, 5) * 0.05
  }

  // The tile's own entrance (D6): unlike `AnimatedContent`, it clears its inline transform and
  // opacity once it lands, and keeps the tween in a ref a later create can kill before its own
  // Flip capture. An id not in `cascadeOrder` gets the cascade's capped, last-card delay, so the
  // tile always fades in alongside the last cards regardless of how many there are.
  const setTileEntranceRef = useCallback((el: HTMLDivElement | null) => {
    tileNodeRef.current = el
    if (!el) {
      tileScrollTriggerRef.current?.kill()
      tileScrollTriggerRef.current = null
      tileEntranceTweenRef.current?.kill()
      tileEntranceTweenRef.current = null
      return
    }
    if (tileHasEnteredRef.current || prefersReducedMotion()) {
      gsap.set(el, { clearProps: 'transform,opacity', visibility: 'visible' })
      tileHasEnteredRef.current = true
      return
    }
    gsap.set(el, { y: 24, opacity: 0, visibility: 'visible' })
    const tween = gsap.to(el, {
      y: 0,
      opacity: 1,
      duration: 0.3,
      ease: 'power3.out',
      delay: cascadeDelay('__add-category-tile__'),
      paused: true,
      onComplete: () => {
        gsap.set(el, { clearProps: 'transform,opacity' })
        tileHasEnteredRef.current = true
        tileEntranceTweenRef.current = null
      },
    })
    tileEntranceTweenRef.current = tween
    tileScrollTriggerRef.current = ScrollTrigger.create({
      trigger: document.getElementById('category-cascade'),
      start: 'top 80%',
      once: true,
      onEnter: () => tween.play(),
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const sortedExpenseGroups = useMemo(
    () => [...data.expenses.groups].sort((a, b) => b.total - a.total),
    [data.expenses.groups],
  )

  const sortedIncomeEntries = useMemo(
    () => [...data.income.entries].sort((a, b) => b.date.localeCompare(a.date)),
    [data.income.entries],
  )

  function findGroupName(categoryId: string): string {
    return data.expenses.groups.find((group) => group.id === categoryId)?.name ?? ''
  }

  // The card order tracked locally while a reorder is in flight (or being reverted), decoupled
  // from `data` so a failure can revert without waiting on it (D8). Falls back to `data`'s own
  // order otherwise, which is what the dashboard always renders (D2).
  const renderedGroups = useMemo(() => {
    if (!displayedOrder) return data.expenses.groups
    const byId = new Map(data.expenses.groups.map((group) => [group.id, group]))
    const ordered = displayedOrder.map((id) => byId.get(id)).filter((group): group is ExpenseGroup => group != null)
    const missing = data.expenses.groups.filter((group) => !displayedOrder.includes(group.id))
    return [...ordered, ...missing]
  }, [displayedOrder, data.expenses.groups])

  return (
    <Toast.Provider toastManager={toasts} limit={1} timeout={5000}>
    <div className="pb-12">
      {/* One fixed layer pushes the whole page back; the category list is raised above it (D3). */}
      <div
        aria-hidden
        className={cn(
          'reorder-scrim fixed inset-0 z-[35] transition-[opacity,display] duration-[240ms] ease-out transition-discrete starting:opacity-0 motion-reduce:transition-none',
          reordering ? 'opacity-100' : 'hidden opacity-0',
        )}
      />
      {reordering ? (
        <div
          className="glass-bar fixed inset-x-0 top-0 z-40"
          style={{ height: BAR_HEIGHT }}
        >
          <div className="mx-auto flex h-full w-full max-w-[640px] items-center justify-between gap-3 px-gutter">
            <span className="font-display text-headline-sm text-foreground">{tReordenar('titulo')}</span>
            <button
              ref={doneRef}
              type="button"
              onClick={leaveReorder}
              className="pressable -me-2 inline-flex min-h-target items-center rounded-full px-2 text-body-lg font-medium text-brand-ink transition-colors duration-150 ease-out hover:text-brand"
            >
              {tReordenar('listo')}
            </button>
          </div>
        </div>
      ) : null}
      <div className="sticky top-0 z-30" style={{ height: BAR_HEIGHT }} aria-hidden={reordering} inert={reordering}>
        <div
          aria-hidden
          // The reorder scrim is the mode's only blurred surface, and the bar sits behind it anyway.
          data-pushed-back={reordering ? '' : undefined}
          className={cn(
            'glass-bar absolute inset-0 transition-opacity duration-500 ease-spring motion-reduce:transition-none',
            titleInView ? 'opacity-0' : 'opacity-100',
          )}
        />
        <div className="relative mx-auto flex h-full w-full max-w-[640px] items-center gap-2.5 px-gutter">
          <div className="flex min-w-0 flex-1 items-center gap-0.5">
            <button
              type="button"
              onClick={() => window.scrollTo({ top: 0, behavior: prefersReducedMotion() ? 'auto' : 'smooth' })}
              aria-label={t('irArriba')}
              className="pressable relative -top-px -ms-3 grid size-11 shrink-0 animate-header-pop place-items-center rounded-full [--press-scale:0.9] motion-reduce:animate-none"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/mango-logo-light.svg" alt="" aria-hidden className="size-11 object-contain dark:hidden" />
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/mango-logo-dark.svg" alt="" aria-hidden className="hidden size-11 object-contain dark:block" />
            </button>
            <div className="relative min-w-0 flex-1 animate-header-in [animation-delay:90ms] motion-reduce:animate-none">
              <span
                aria-hidden={!titleInView}
                inert={!titleInView}
                className={cn(
                  'absolute inset-0 flex items-center font-display text-headline-sm text-foreground transition-[opacity,translate] duration-500 ease-spring motion-reduce:transition-none',
                  titleInView ? 'translate-y-0 opacity-100' : 'pointer-events-none -translate-y-2 opacity-0',
                )}
              >
                {t('appName')}
              </span>
              <div
                aria-hidden={titleInView}
                inert={titleInView}
                className={cn(
                  'transition-[opacity,translate] duration-500 ease-spring motion-reduce:transition-none',
                  titleInView ? 'pointer-events-none translate-y-2 opacity-0' : 'translate-y-0 opacity-100',
                )}
              >
                <MonthSelector
                  variant="compact"
                  month={data.cycle.month}
                  start={data.cycle.start}
                  end={data.cycle.end}
                  inProgress={data.cycle.inProgress}
                  onPrevious={actions.previousCycle}
                  onNext={actions.nextCycle}
                  onSelect={actions.selectCycle}
                />
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setAccountMenuOpen(true)}
            aria-label={tMenu('abrirMenuDeCuenta')}
            aria-haspopup="dialog"
            aria-expanded={accountMenuOpen}
            aria-controls="account-menu"
            // The 44px target is wider than the 40px avatar inside it, so it hangs 2px past the
            // gutter to leave the circle's edge level with the logo's on the other side.
            className="pressable -me-0.5 grid size-target shrink-0 animate-header-pop place-items-center rounded-full [--pop-rotate:12deg] [--press-scale:0.9] [animation-delay:180ms] motion-reduce:animate-none"
          >
            <Avatar name={data.user.name} photoUrl={data.user.photoUrl} />
          </button>
        </div>
      </div>
      <div className="mx-auto w-full max-w-[640px] px-gutter">
      <div ref={titleRef} className="relative z-20" aria-hidden={reordering} inert={reordering}>
        <AnimatedContent className="pb-3 pt-5" distance={20} delay={0.12}>
          <MonthSelector
            variant="title"
            month={data.cycle.month}
            start={data.cycle.start}
            end={data.cycle.end}
            inProgress={data.cycle.inProgress}
            onPrevious={actions.previousCycle}
            onNext={actions.nextCycle}
            onSelect={actions.selectCycle}
          />
        </AnimatedContent>
      </div>
      {notice ? (
        <AnimatedContent className="mb-stack" distance={12} delay={0.06} duration={0.6} aria-hidden={reordering} inert={reordering}>
          {notice}
        </AnimatedContent>
      ) : null}
      <AnimatedContent
        distance={32}
        scale={0.97}
        duration={1}
        delay={0.2}
        aria-hidden={reordering}
        inert={reordering}
      >
        <FreeMarginCard amount={data.freeMargin} currency={currency} />
      </AnimatedContent>
      <AnimatedContent className="mt-stack" distance={24} delay={0.32} aria-hidden={reordering} inert={reordering}>
        <SummaryGroup
          currency={currency}
          openKey={openSummary}
          onToggle={(key) => toggleSummary(key as SummaryKey)}
          items={[
            {
              key: 'income',
              label: tResumen('ingresos'),
              total: data.income.total,
              panel: (
                <>
                  <div className="flex flex-col">
                    {sortedIncomeEntries.map((entry, index) => {
                      const row = (
                        <ExpenseRow
                          name={entry.name || tHojaGasto('ingreso')}
                          date={entry.date}
                          amount={entry.amount}
                          currency={currency}
                          timeZone={data.user.timezone}
                          onActivate={actions.income ? () => openIncomeEditSheet(entry) : undefined}
                          first={index === 0}
                        />
                      )
                      return actions.income ? (
                        <SwipeToDelete key={entry.id} onDelete={() => handleDeleteIncome(entry)}>
                          {row}
                        </SwipeToDelete>
                      ) : (
                        <div key={entry.id}>{row}</div>
                      )
                    })}
                    <AddRow label={t('anadirIngreso')} onClick={actions.income ? openIncomeCreateSheet : undefined} />
                  </div>
                </>
              ),
            },
            {
              key: 'expenses',
              label: tResumen('gastos'),
              total: data.expenses.total,
              panel: (
                <>
                  <div className="flex flex-col">
                    {sortedExpenseGroups.map((group) => (
                      <SummaryRow
                        key={group.id}
                        color={group.color}
                        name={group.name}
                        amount={group.total}
                        currency={currency}
                        onClick={() => scrollToCategory(group.id)}
                      />
                    ))}
                  </div>
                  <button
                    type="button"
                    onClick={() => expensesRef.current?.scrollIntoView({ behavior: 'smooth' })}
                    className="flex min-h-12 w-full items-center justify-center gap-2 text-label-ui text-muted-foreground"
                  >
                    {tResumen('verTodosLosGastos')}
                    <ChevronDown className="size-4" aria-hidden />
                  </button>
                </>
              ),
            },
            {
              key: 'savings',
              label: tResumen('ahorro'),
              total: data.savings.cycle,
              below: savingsProgress ? <SavingsProgressBar progress={savingsProgress} currency={currency} /> : undefined,
              panel: (
                <>
                  <div className="flex flex-col">
                    <div className="flex items-center gap-3 px-inset pb-6 pt-2.5">
                      <p className="min-w-0 flex-1 truncate text-body-sm text-muted-foreground">{tResumen('acumulado')}</p>
                      <SavingsSparkline history={data.savings.history} />
                      <Money amount={data.savings.accumulated} currency={currency} className="shrink-0 text-body-lg text-foreground" />
                    </div>
                    {data.savings.movements.map((movement, index) => (
                      <SavingsMovementRow
                        key={movement.id}
                        name={movement.name}
                        date={movement.date}
                        amount={movement.amount}
                        currency={currency}
                        timeZone={data.user.timezone}
                        depositLabel={tResumen('deposito')}
                        withdrawalLabel={tResumen('retiro')}
                        index={index}
                      />
                    ))}
                    <AddRow label={t('anadirMovimientoAhorro')} onClick={actions.addSavingsMovement} />
                  </div>
                </>
              ),
            },
          ]}
        />
      </AnimatedContent>

      <AnimatedContent
        className="mt-section flex items-center justify-between"
        distance={16}
        delay={0.42}
        aria-hidden={reordering}
        inert={reordering}
      >
        <h2 className="font-display text-headline-md text-foreground">{t('expenseBreakdown')}</h2>
        {openIds.size > 0 ? (
          <button
            type="button"
            onClick={() => setOpenIds(new Set())}
            className="pressable inline-flex min-h-target items-center gap-2 text-body-lg font-medium text-brand-ink"
          >
            <ChevronUp className="size-4" aria-hidden />
            {t('colapsarTodo')}
          </button>
        ) : null}
      </AnimatedContent>
      <div ref={expensesRef} className="mt-4 flex scroll-mt-20 flex-col gap-stack">
        <AnimatedContent
          id="category-cascade"
          threshold={0.2}
          distance={24}
          duration={0.3}
          delay={0.48}
          aria-hidden={reordering}
          inert={reordering}
        >
          <UpcomingChargesCard
            charges={charges}
            currency={currency}
            open={openIds.has(UPCOMING_CHARGES_ID)}
            onToggle={() => toggleCard(UPCOMING_CHARGES_ID)}
            onOpenDefinition={actions.recurring ? openRecurringSheet : undefined}
          />
        </AnimatedContent>
        {/* The lane is a step, not an animation: one reflow of the list, hidden inside the
            overlay's fade and the cards collapsing (D4). */}
        <div
          ref={categoryListRef}
          className={cn(
            'flex flex-col gap-stack',
            reordering && 'relative z-[36] scroll-mt-[68px] pe-11',
          )}
        >
          {renderedGroups.map((group, index) => {
            const isDragging = dragVisual?.categoryId === group.id
            const shift = dragVisual && !isDragging ? neighbourShift(index, dragVisual) : 0
            // A category created after mount isn't in the cascade's own snapshot, and must not
            // run through `AnimatedContent`'s entrance: that wrapper starts `visibility:hidden`
            // until its own delayed tween plays, which would hide the new card underneath the
            // create morph that already owns its appearance (D6).
            const isNewlyCreated = !cascadeOrder.includes(group.id)
            const card = (
              <div
                ref={(node) => {
                  if (node) cardNodeRefs.current.set(group.id, node)
                  else cardNodeRefs.current.delete(group.id)
                }}
                className={cn(
                  'group relative scroll-mt-20',
                  reordering && !isDragging && 'transition-transform duration-200 ease-in-out motion-reduce:transition-none',
                  // The lift's shadows are drawn on this wrapper, not on the card inside it, so it
                  // needs the card's own radius or they trace a square around a rounded card.
                  isDragging && 'z-10 rounded-card',
                )}
                style={!isDragging && shift ? { transform: `translateY(${shift}px)` } : undefined}
              >
                <CategoryCard
                  group={group}
                  currency={currency}
                  timeZone={data.user.timezone}
                  open={openIds.has(group.id)}
                  onToggle={() => toggleCard(group.id)}
                  onAddExpense={actions.expenses ? () => openCreateSheet(group) : undefined}
                  onEditExpense={actions.expenses ? (expense) => openEditSheet(group, expense) : undefined}
                  onDeleteExpense={actions.expenses ? (expense) => handleDeleteExpense(expense) : undefined}
                  onOpenOptions={actions.categories ? () => openCategorySheet(group) : undefined}
                  reordering={reordering}
                  showProgress={!hiddenProgressIds.has(group.id)}
                />
                {reordering ? (
                  <div
                    aria-hidden
                    onPointerDown={(event) => {
                      if (event.pointerType === 'touch') return // touch drags start at the handle only (D6)
                      startDrag(event, group.id, index)
                    }}
                    onPointerMove={handleDragPointerMove}
                    onPointerUp={endDrag}
                    onPointerCancel={cancelDrag}
                    className={cn('absolute inset-0 touch-pan-y', isDragging ? 'cursor-grabbing' : 'cursor-grab')}
                  />
                ) : null}
                {reordering ? (
                  <button
                    type="button"
                    aria-label={tReordenar('mover', {
                      categoria: group.name,
                      posicion: index + 1,
                      total: renderedGroups.length,
                    })}
                    onPointerDown={(event) => startDrag(event, group.id, index)}
                    onPointerMove={handleDragPointerMove}
                    onPointerUp={endDrag}
                    onPointerCancel={cancelDrag}
                    onKeyDown={(event) => {
                      if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') return
                      event.preventDefault()
                      void moveCategory(index, event.key === 'ArrowUp' ? -1 : 1)
                    }}
                    style={{ animationDelay: `${Math.min(index, 4) * 30}ms` }}
                    // The handle is drawn on the scrim, which is dark in both themes, so its lines
                    // are light in both rather than following the theme's muted foreground.
                    // The hover contrast bump only applies to a fine pointer that supports hover,
                    // so a tap on a touch device never leaves it looking hovered (D6, 9.3).
                    className={cn(
                      'animate-handle-in absolute -end-11 inset-y-0 grid w-11 touch-none place-items-center rounded-card text-white/70 group-hover:hover-fine:text-white/90 motion-reduce:animate-none',
                      isDragging ? 'cursor-grabbing' : 'pressable cursor-grab [--press-scale:0.94]',
                    )}
                  >
                    <span aria-hidden className="flex flex-col gap-[3px]">
                      <span className="block h-0.5 w-4 rounded-full bg-current" />
                      <span className="block h-0.5 w-4 rounded-full bg-current" />
                      <span className="block h-0.5 w-4 rounded-full bg-current" />
                    </span>
                  </button>
                ) : null}
              </div>
            )

            if (isNewlyCreated) {
              return (
                <div key={group.id} className={cn(isDragging && 'relative z-20')}>
                  {card}
                </div>
              )
            }

            return (
              <AnimatedContent
                key={group.id}
                trigger="#category-cascade"
                threshold={0.2}
                distance={24}
                duration={0.3}
                delay={cascadeDelay(group.id)}
                // The entrance animation leaves an inline transform here, and any transform makes
                // this wrapper a stacking context — which traps the held card's own z-index inside
                // it, so the card slid *under* the cards below it. The lift has to be raised on the
                // element that owns the context, not on the card within it.
                className={cn(isDragging && 'relative z-20')}
              >
                {card}
              </AnimatedContent>
            )
          })}
          {reordering ? null : (
            <div ref={setTileEntranceRef} style={{ visibility: 'hidden' }}>
              <AddCategoryTile label={t('anadirCategoria')} onClick={actions.categories ? openCreateCategorySheet : undefined} />
            </div>
          )}
        </div>
      </div>
      <div className="mt-section flex flex-col gap-stack" aria-hidden={reordering} inert={reordering}>
        <AnimatedContent threshold={0.2} distance={24} duration={0.3}>
          <MonthlyBarsChart history={data.history} currentMonth={data.cycle.month} currency={currency} />
        </AnimatedContent>
        <AnimatedContent threshold={0.2} distance={24} duration={0.3} delay={0.05}>
          <CategoryPieChart groups={data.expenses.groups} total={data.expenses.total} currency={currency} />
        </AnimatedContent>
      </div>
      </div>
      <AccountMenu
        user={data.user}
        actions={actions}
        open={accountMenuOpen}
        onClose={() => setAccountMenuOpen(false)}
      />
      <EntrySheet
        config={sheetIsIncome ? incomeEntry : expenseEntry}
        open={sheet.open}
        onOpenChange={(open) => setSheet((prev) => ({ ...prev, open }))}
        mode={sheet.target?.mode ?? 'create'}
        context={sheetContext}
        initialValues={sheetInitialValues}
        fieldOptions={{ amount: { currency }, date: { min: data.cycle.start, max: data.cycle.end } }}
        initialFocusRef={initialFocusRef}
        onSave={handleSaveEntry}
        onDelete={sheet.target?.mode === 'edit' ? handleSheetDelete : undefined}
        onSaveRecurrence={actions.recurring ? handleSaveRecurrence : undefined}
      />
      <CategorySheet
        open={categorySheet.open}
        onOpenChange={(open) => setCategorySheet((prev) => ({ ...prev, open }))}
        mode={categorySheetMode}
        target={categorySheetTargetGroup}
        currency={currency}
        receivingCategories={receivingCategories}
        onSave={handleSaveCategory}
        onDelete={handleDeleteCategory}
        onCreate={actions.categories ? handleCreateCategory : undefined}
        initialColor={categorySheetMode === 'create' ? createCategoryColor : undefined}
        onReorder={actions.categories ? handleEnterReorder : undefined}
        progressVisible={!hiddenProgressIds.has(categorySheetTargetGroup?.id ?? '')}
        onToggleProgress={() => {
          if (categorySheetTargetGroup) toggleProgress(categorySheetTargetGroup.id)
        }}
      />
      {recurringSheetTarget ? (
        <RecurringSheet
          open={recurringSheet.open}
          onOpenChange={(open) => setRecurringSheet((prev) => ({ ...prev, open }))}
          target={recurringSheetTarget}
          categoryName={recurringSheetCategory?.name ?? ''}
          categoryColor={recurringSheetCategory?.color ?? 'gris_calido'}
          currency={currency}
          currentAmount={recurringSheetCurrentAmount}
          onSave={handleSaveDefinition}
          onStop={handleStopDefinition}
          onDelete={handleDeleteDefinition}
        />
      ) : null}
      <UndoToast />
      <div role="status" className="sr-only">
        {statusMessage}
      </div>
    </div>
    </Toast.Provider>
  )
}
