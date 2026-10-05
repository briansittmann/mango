/**
 * Placement of an anchored popover from the control that opened it (`desktop-shell` → *Anchored
 * popovers stay on screen*, design D5). Pure: the caller measures and applies.
 */

export type AnchorRect = { top: number; right: number; bottom: number; left: number }
export type PanelSize = { width: number; height: number }
export type Viewport = { width: number; height: number }

/**
 * `below-end`: under the opener, right edges aligned (the account avatar, a card's options control).
 * `above-start`: over the opener, left edges aligned (the sidebar's account card at the bottom).
 * Either flips to the other side when its own side has no room and the other has.
 */
export type AnchorPlacement = 'below-end' | 'above-start'

export type AnchoredPosition = {
  top: number
  left: number
  side: 'below' | 'above'
  /** The `transform-origin` that scales the panel from the opener's side. */
  origin: 'top right' | 'bottom right' | 'top left' | 'bottom left'
}

/** Distance kept from every viewport edge. */
export const ANCHOR_MARGIN = 16
/** Distance between the opener and the panel. */
export const ANCHOR_GAP = 8

export function placeAnchored(
  rect: AnchorRect,
  panel: PanelSize,
  viewport: Viewport,
  placement: AnchorPlacement = 'below-end',
): AnchoredPosition {
  const clampTop = (value: number) => Math.max(ANCHOR_MARGIN, Math.min(value, viewport.height - panel.height - ANCHOR_MARGIN))
  const clampLeft = (value: number) => Math.max(ANCHOR_MARGIN, Math.min(value, viewport.width - panel.width - ANCHOR_MARGIN))
  const fitsBelow = rect.bottom + ANCHOR_GAP + panel.height <= viewport.height - ANCHOR_MARGIN
  const fitsAbove = rect.top - ANCHOR_GAP - panel.height >= ANCHOR_MARGIN

  const preferAbove = placement === 'above-start'
  const side: AnchoredPosition['side'] = preferAbove ? (fitsAbove || !fitsBelow ? 'above' : 'below') : fitsBelow || !fitsAbove ? 'below' : 'above'
  const top = side === 'below' ? rect.bottom + ANCHOR_GAP : rect.top - ANCHOR_GAP - panel.height
  const left = placement === 'above-start' ? rect.left : rect.right - panel.width
  const horizontal = placement === 'above-start' ? 'left' : 'right'
  const vertical = side === 'below' ? 'top' : 'bottom'

  return { top: clampTop(top), left: clampLeft(left), side, origin: `${vertical} ${horizontal}` }
}
