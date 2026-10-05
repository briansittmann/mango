import { test } from 'node:test'
import assert from 'node:assert/strict'
import { ANCHOR_GAP, ANCHOR_MARGIN, placeAnchored } from './anchor.ts'

const viewport = { width: 1280, height: 700 }
const panel = { width: 380, height: 500 }

test('an opener near the top places the panel below it, right edges aligned, scaling from the top right', () => {
  const rect = { top: 60, bottom: 100, left: 800, right: 844 }
  const placed = placeAnchored(rect, panel, viewport)
  assert.equal(placed.side, 'below')
  assert.equal(placed.top, 100 + ANCHOR_GAP)
  assert.equal(placed.left, 844 - 380)
  assert.equal(placed.origin, 'top right')
})

test('bottom overflow flips the panel above the opener and the origin follows', () => {
  const rect = { top: 600, bottom: 644, left: 800, right: 844 }
  const placed = placeAnchored(rect, panel, viewport)
  assert.equal(placed.side, 'above')
  assert.equal(placed.top, 600 - ANCHOR_GAP - 500)
  assert.equal(placed.origin, 'bottom right')
})

test('with no room on either side the panel is clamped inside the viewport', () => {
  const rect = { top: 340, bottom: 384, left: 800, right: 844 }
  const placed = placeAnchored(rect, panel, { width: 1280, height: 560 })
  assert.equal(placed.top, 560 - 500 - ANCHOR_MARGIN)
  assert.ok(placed.top >= ANCHOR_MARGIN)
})

test('right overflow clamps the panel 16px from the right edge', () => {
  const rect = { top: 60, bottom: 100, left: 1240, right: 1270 }
  const placed = placeAnchored(rect, { width: 380, height: 200 }, viewport)
  assert.equal(placed.left + 380, viewport.width - ANCHOR_MARGIN)
})

test('an opener at the bottom left places the panel above it, left edges aligned, from the bottom left', () => {
  const rect = { top: 620, bottom: 680, left: 16, right: 256 }
  const placed = placeAnchored(rect, { width: 344, height: 420 }, viewport, 'above-start')
  assert.equal(placed.side, 'above')
  assert.equal(placed.top, 620 - ANCHOR_GAP - 420)
  assert.equal(placed.left, 16)
  assert.equal(placed.origin, 'bottom left')
})

test('an above-start opener too close to the top falls below it', () => {
  const rect = { top: 20, bottom: 80, left: 16, right: 256 }
  const placed = placeAnchored(rect, { width: 344, height: 420 }, viewport, 'above-start')
  assert.equal(placed.side, 'below')
  assert.equal(placed.top, 80 + ANCHOR_GAP)
  assert.equal(placed.origin, 'top left')
})

test('a wide panel from a narrow left opener never crosses the left margin', () => {
  const rect = { top: 60, bottom: 100, left: 4, right: 40 }
  const placed = placeAnchored(rect, { width: 380, height: 200 }, viewport)
  assert.equal(placed.left, ANCHOR_MARGIN)
})
