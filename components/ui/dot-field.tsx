'use client'

import { useEffect, useRef } from 'react'

// Adapted from reactbits' DotField (https://reactbits.dev/backgrounds/dot-field). Changes: the
// canvas sits in a fixed layer, so the pointer is read in client coordinates; the colours come
// from props per theme; a settled field stops redrawing until the pointer moves again; and reduced
// motion draws the grid once and never bulges it.
type DotFieldProps = {
  dotRadius?: number
  dotSpacing?: number
  cursorRadius?: number
  bulgeStrength?: number
  glowRadius?: number
  gradientFrom: string
  gradientTo: string
  glowColor: string
  className?: string
}

type Dot = { ax: number; ay: number; sx: number; sy: number }

export function DotField({
  dotRadius = 1.5,
  dotSpacing = 14,
  cursorRadius = 420,
  bulgeStrength = 60,
  glowRadius = 180,
  gradientFrom,
  gradientTo,
  glowColor,
  className,
}: DotFieldProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const glowRef = useRef<SVGCircleElement>(null)
  const colorsRef = useRef({ gradientFrom, gradientTo })
  const redrawRef = useRef<() => void>(() => {})

  useEffect(() => {
    const canvas = canvasRef.current
    const glow = glowRef.current
    const ctx = canvas?.getContext('2d', { alpha: true })
    if (!canvas || !ctx) return
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    const mouse = { x: -9999, y: -9999, prevX: -9999, prevY: -9999, speed: 0 }
    let dots: Dot[] = []
    let w = 0
    let h = 0
    let engagement = 0
    let glowOpacity = 0
    let frame = 0
    let dirty = true

    function build() {
      const rect = canvas!.getBoundingClientRect()
      w = rect.width
      h = rect.height
      canvas!.width = w * dpr
      canvas!.height = h * dpr
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0)
      const step = dotRadius + dotSpacing
      const cols = Math.floor(w / step)
      const rows = Math.floor(h / step)
      const padX = (w % step) / 2
      const padY = (h % step) / 2
      dots = []
      for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
          const ax = padX + col * step + step / 2
          const ay = padY + row * step + step / 2
          dots.push({ ax, ay, sx: ax, sy: ay })
        }
      }
      dirty = true
    }

    function draw() {
      const { gradientFrom: from, gradientTo: to } = colorsRef.current
      ctx!.clearRect(0, 0, w, h)
      const gradient = ctx!.createLinearGradient(0, 0, w, h)
      gradient.addColorStop(0, from)
      gradient.addColorStop(1, to)
      ctx!.fillStyle = gradient
      const radius = dotRadius / 2
      ctx!.beginPath()
      for (const dot of dots) {
        ctx!.moveTo(dot.sx + radius, dot.sy)
        ctx!.arc(dot.sx, dot.sy, radius, 0, Math.PI * 2)
      }
      ctx!.fill()
    }

    function tick() {
      const dx = mouse.prevX - mouse.x
      const dy = mouse.prevY - mouse.y
      mouse.speed += (Math.hypot(dx, dy) - mouse.speed) * 0.5
      if (mouse.speed < 0.001) mouse.speed = 0
      mouse.prevX = mouse.x
      mouse.prevY = mouse.y

      engagement += (Math.min(mouse.speed / 5, 1) - engagement) * 0.06
      if (engagement < 0.001) engagement = 0
      glowOpacity += (engagement - glowOpacity) * 0.08
      if (glow) {
        glow.setAttribute('cx', String(mouse.x))
        glow.setAttribute('cy', String(mouse.y))
        glow.style.opacity = String(glowOpacity)
      }

      const crSq = cursorRadius * cursorRadius
      let moving = false
      for (const dot of dots) {
        const ddx = mouse.x - dot.ax
        const ddy = mouse.y - dot.ay
        const distSq = ddx * ddx + ddy * ddy
        let tx = dot.ax
        let ty = dot.ay
        let ease = 0.1
        if (distSq < crSq && engagement > 0.01) {
          const t = 1 - Math.sqrt(distSq) / cursorRadius
          const push = t * t * bulgeStrength * engagement
          const angle = Math.atan2(ddy, ddx)
          tx = dot.ax - Math.cos(angle) * push
          ty = dot.ay - Math.sin(angle) * push
          ease = 0.15
        }
        const mx = (tx - dot.sx) * ease
        const my = (ty - dot.sy) * ease
        if (Math.abs(mx) > 0.01 || Math.abs(my) > 0.01) moving = true
        dot.sx += mx
        dot.sy += my
      }

      if (moving || dirty) {
        draw()
        dirty = false
      }
      frame = requestAnimationFrame(tick)
    }

    function onPointerMove(event: PointerEvent) {
      if (event.pointerType !== 'mouse') return
      const rect = canvas!.getBoundingClientRect()
      mouse.x = event.clientX - rect.left
      mouse.y = event.clientY - rect.top
    }

    let resizeTimer: ReturnType<typeof setTimeout>
    function onResize() {
      clearTimeout(resizeTimer)
      resizeTimer = setTimeout(() => {
        build()
        if (reduced) draw()
      }, 100)
    }

    build()
    redrawRef.current = () => {
      dirty = true
      if (reduced) draw()
    }
    window.addEventListener('resize', onResize)
    if (reduced) {
      draw()
    } else {
      window.addEventListener('pointermove', onPointerMove, { passive: true })
      frame = requestAnimationFrame(tick)
    }

    return () => {
      cancelAnimationFrame(frame)
      clearTimeout(resizeTimer)
      window.removeEventListener('resize', onResize)
      window.removeEventListener('pointermove', onPointerMove)
    }
  }, [dotRadius, dotSpacing, cursorRadius, bulgeStrength])

  // A theme switch only changes the colours: repaint without rebuilding the grid.
  useEffect(() => {
    colorsRef.current = { gradientFrom, gradientTo }
    redrawRef.current()
  }, [gradientFrom, gradientTo])

  return (
    <div aria-hidden className={className}>
      <canvas ref={canvasRef} className="absolute inset-0 size-full" />
      <svg className="pointer-events-none absolute inset-0 size-full">
        <defs>
          <radialGradient id="dot-field-glow">
            <stop offset="0%" stopColor={glowColor} />
            <stop offset="100%" stopColor="transparent" />
          </radialGradient>
        </defs>
        <circle ref={glowRef} cx="-9999" cy="-9999" r={glowRadius} fill="url(#dot-field-glow)" style={{ opacity: 0 }} />
      </svg>
    </div>
  )
}
