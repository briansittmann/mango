'use client'

import { useEffect, useRef } from 'react'

// Adapted from reactbits' ColorBends (https://reactbits.dev/backgrounds/color-bends), rewritten on
// raw WebGL instead of three.js so the background costs no new dependency. Only the knobs we
// actually tune are exposed; the rest of the original's defaults are folded into the shader.
type ColorBendsProps = {
  /** Band colour, hex. */
  color: string
  speed?: number
  frequency?: number
  noise?: number
  /** Degrees. The bands run perpendicular to this. */
  rotation?: number
  /**
   * Band contrast. This shader's own scale (upstream default 6), not the 0–1 knob the reactbits
   * playground shows — 2 keeps the bands readable without fighting the cards on top of them.
   */
  bandWidth?: number
  /** Fraction of the height the bands fade out over, measured from the top. */
  fadeTop?: number
  iterations?: number
  intensity?: number
  parallax?: number
  mouseInfluence?: number
  className?: string
}

const VERTEX_SHADER = `
attribute vec2 aPosition;
varying vec2 vUv;
void main() {
  vUv = aPosition * 0.5 + 0.5;
  gl_Position = vec4(aPosition, 0.0, 1.0);
}
`

const FRAGMENT_SHADER = `
precision highp float;
uniform vec2 uCanvas;
uniform float uTime;
uniform float uSpeed;
uniform vec2 uRot;
uniform vec3 uColor;
uniform vec2 uPointer;
uniform float uFrequency;
uniform float uNoise;
uniform float uIntensity;
uniform float uBandWidth;
uniform float uParallax;
uniform float uMouseInfluence;
uniform int uIterations;
varying vec2 vUv;

void main() {
  float t = uTime * uSpeed;
  vec2 p = vUv * 2.0 - 1.0;
  p += uPointer * uParallax * 0.1;
  vec2 rp = vec2(p.x * uRot.x - p.y * uRot.y, p.x * uRot.y + p.y * uRot.x);
  vec2 q = vec2(rp.x * (uCanvas.x / uCanvas.y), rp.y);
  q /= 0.5 + 0.2 * dot(q, q);
  q += 0.2 * cos(t) - 7.56;
  q += (uPointer - rp) * uMouseInfluence * 0.2;

  for (int j = 0; j < 5; j++) {
    if (j >= uIterations - 1) break;
    vec2 rr = sin(1.5 * (q.yx * uFrequency) + 2.0 * cos(q * uFrequency));
    q += (rr - q) * 0.15;
  }

  vec2 s = q - 0.01;
  vec2 r = sin(1.5 * (s.yx * uFrequency) + 2.0 * cos(s * uFrequency));
  float m = length(r + sin(5.0 * r.y * uFrequency - 3.0 * t) / 4.0);
  float a = 1.0 - exp(-uBandWidth / exp(uBandWidth * m));

  vec3 col = clamp(uColor * a, 0.0, 1.0) * uIntensity;
  if (uNoise > 0.0001) {
    float n = fract(sin(dot(gl_FragCoord.xy + vec2(uTime), vec2(12.9898, 78.233))) * 43758.5453123);
    col = clamp(col + (n - 0.5) * uNoise, 0.0, 1.0);
  }

  // Premultiplied, which is what the canvas compositor expects.
  gl_FragColor = vec4(col * a, a);
}
`

const UNIFORM_NAMES = [
  'uCanvas',
  'uTime',
  'uSpeed',
  'uRot',
  'uColor',
  'uPointer',
  'uFrequency',
  'uNoise',
  'uIntensity',
  'uBandWidth',
  'uParallax',
  'uMouseInfluence',
  'uIterations',
] as const

function compile(gl: WebGLRenderingContext, type: number, source: string): WebGLShader | null {
  const shader = gl.createShader(type)
  if (!shader) return null
  gl.shaderSource(shader, source)
  gl.compileShader(shader)
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    gl.deleteShader(shader)
    return null
  }
  return shader
}

function toRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '').trim()
  const full = h.length === 3 ? h[0] + h[0] + h[1] + h[1] + h[2] + h[2] : h
  return [
    parseInt(full.slice(0, 2), 16) / 255,
    parseInt(full.slice(2, 4), 16) / 255,
    parseInt(full.slice(4, 6), 16) / 255,
  ]
}

export function ColorBends({
  color,
  speed = 0.2,
  frequency = 1,
  noise = 0.15,
  bandWidth = 1.5,
  rotation = 90,
  fadeTop = 0.75,
  iterations = 1,
  intensity = 1.3,
  parallax = 0.5,
  mouseInfluence = 1,
  className,
}: ColorBendsProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  // The draw loop reads the current props from here, so a prop change never rebuilds the context.
  const propsRef = useRef({ color, speed, frequency, noise, bandWidth, rotation, iterations, intensity, parallax, mouseInfluence })
  useEffect(() => {
    propsRef.current = { color, speed, frequency, noise, bandWidth, rotation, iterations, intensity, parallax, mouseInfluence }
  })

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    // `preserveDrawingBuffer`: mobile browsers can composite a scroll frame without a fresh draw, and
    // with a discarded buffer that frame showed the background gone for a few milliseconds.
    const gl = canvas.getContext('webgl', {
      alpha: true,
      antialias: false,
      powerPreference: 'high-performance',
      preserveDrawingBuffer: true,
    })
    if (!gl) return

    const vertex = compile(gl, gl.VERTEX_SHADER, VERTEX_SHADER)
    const fragment = compile(gl, gl.FRAGMENT_SHADER, FRAGMENT_SHADER)
    if (!vertex || !fragment) return
    const program = gl.createProgram()!
    gl.attachShader(program, vertex)
    gl.attachShader(program, fragment)
    gl.linkProgram(program)
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return
    gl.useProgram(program)

    const buffer = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW)
    const position = gl.getAttribLocation(program, 'aPosition')
    gl.enableVertexAttribArray(position)
    gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0)

    const uniforms = Object.fromEntries(
      UNIFORM_NAMES.map((name) => [name, gl.getUniformLocation(program, name)]),
    ) as Record<(typeof UNIFORM_NAMES)[number], WebGLUniformLocation | null>

    const pointerTarget = { x: 0, y: 0 }
    const pointer = { x: 0, y: 0 }
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches

    let lastElapsed = 0
    const draw = (elapsed: number) => {
      lastElapsed = elapsed
      const p = propsRef.current
      const [r, g, b] = toRgb(p.color)
      const rad = ((p.rotation % 360) * Math.PI) / 180
      gl.uniform2f(uniforms.uCanvas, canvas.width, canvas.height)
      gl.uniform1f(uniforms.uTime, elapsed)
      gl.uniform1f(uniforms.uSpeed, p.speed)
      gl.uniform2f(uniforms.uRot, Math.cos(rad), Math.sin(rad))
      gl.uniform3f(uniforms.uColor, r, g, b)
      gl.uniform2f(uniforms.uPointer, pointer.x, pointer.y)
      gl.uniform1f(uniforms.uFrequency, p.frequency)
      gl.uniform1f(uniforms.uNoise, p.noise)
      gl.uniform1f(uniforms.uIntensity, p.intensity)
      gl.uniform1f(uniforms.uBandWidth, p.bandWidth)
      gl.uniform1f(uniforms.uParallax, p.parallax)
      gl.uniform1f(uniforms.uMouseInfluence, p.mouseInfluence)
      gl.uniform1i(uniforms.uIterations, p.iterations)
      gl.clearColor(0, 0, 0, 0)
      gl.clear(gl.COLOR_BUFFER_BIT)
      gl.drawArrays(gl.TRIANGLES, 0, 3)
    }

    const resize = () => {
      // The bands are soft blurs, so touch screens render at 1x: a full-screen 2x shader every frame
      // while scrolling is what a phone GPU drops first.
      const coarse = matchMedia('(pointer: coarse)').matches
      const dpr = coarse ? 1 : Math.min(window.devicePixelRatio || 1, 2)
      const width = Math.max(1, Math.round(canvas.clientWidth * dpr))
      const height = Math.max(1, Math.round(canvas.clientHeight * dpr))
      if (canvas.width === width && canvas.height === height) return
      canvas.width = width
      canvas.height = height
      gl.viewport(0, 0, width, height)
      // Setting the size clears the canvas; repaint now instead of leaving it blank until the next frame.
      draw(lastElapsed)
    }

    resize()
    const observer = new ResizeObserver(resize)
    observer.observe(canvas)

    let frame = 0
    const start = performance.now()
    const loop = (now: number) => {
      // The pointer trails the cursor instead of snapping to it, as in the original.
      pointer.x += (pointerTarget.x - pointer.x) * 0.08
      pointer.y += (pointerTarget.y - pointer.y) * 0.08
      draw((now - start) / 1000)
      frame = requestAnimationFrame(loop)
    }

    const onPointerMove = (event: PointerEvent) => {
      pointerTarget.x = (event.clientX / window.innerWidth) * 2 - 1
      pointerTarget.y = -((event.clientY / window.innerHeight) * 2 - 1)
    }

    // Reduced motion keeps the bends but freezes them: one frame, no loop, no pointer parallax.
    if (reduced) {
      draw(0)
    } else {
      frame = requestAnimationFrame(loop)
      window.addEventListener('pointermove', onPointerMove, { passive: true })
    }

    return () => {
      cancelAnimationFrame(frame)
      observer.disconnect()
      window.removeEventListener('pointermove', onPointerMove)
      gl.deleteProgram(program)
      gl.deleteShader(vertex)
      gl.deleteShader(fragment)
      gl.deleteBuffer(buffer)
      // No `WEBGL_lose_context` here on purpose: the context belongs to the canvas element, and
      // killing it leaves a dead context behind for the next mount (React remounts effects in dev).
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      className={className}
      style={{
        maskImage: `linear-gradient(to bottom, transparent 0%, #000 ${Math.round(fadeTop * 100)}%)`,
        WebkitMaskImage: `linear-gradient(to bottom, transparent 0%, #000 ${Math.round(fadeTop * 100)}%)`,
      }}
    />
  )
}
