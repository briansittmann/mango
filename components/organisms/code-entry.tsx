'use client'

import { useLayoutEffect, useEffect, useRef, useState, type ChangeEvent, type ClipboardEvent } from 'react'
import { flushSync } from 'react-dom'
import { gsap } from 'gsap'
import { Loader2 } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

const N = 6
const GAP = 8
/** Seconds before "Reenviar" is enabled; matches Supabase's per-address OTP interval (D7, task 0.3). */
export const RESEND_SECONDS = 60

export type CodeVerifyStatus = 'ok' | 'rejected' | 'rate_limited' | 'error'
export type CodeResendStatus = 'sent' | 'rate_limited' | 'error'

type Message = 'codigoIncorrecto' | 'demasiadosIntentos' | 'errorVerificacion' | 'demasiadosPedidos' | 'errorEnvio'
type Phase = 'typing' | 'verifying' | 'success'

const VERIFY_MESSAGE: Record<Exclude<CodeVerifyStatus, 'ok'>, Message> = {
  rejected: 'codigoIncorrecto',
  rate_limited: 'demasiadosIntentos',
  error: 'errorVerificacion',
}

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

type CodeEntryProps = {
  email: string
  onVerify: (code: string) => Promise<CodeVerifyStatus>
  onResend: () => Promise<CodeResendStatus>
  onChangeEmail: () => void
  onDone: () => void
}

/**
 * The code step of `/login` (D3): one invisible numeric input under six visual cells, and the
 * motion of `docs/prototipos/login-otp.html`. Cells are placed on the row with `left`/`top`; the
 * orbit is a transform on top, so at rest (and with reduced motion) no cell is translated.
 */
export function CodeEntry({ email, onVerify, onResend, onChangeEmail, onDone }: CodeEntryProps) {
  const t = useTranslations('acceso')
  const [value, setValue] = useState('')
  const [phase, setPhase] = useState<Phase>('typing')
  const [focused, setFocused] = useState(false)
  const [message, setMessage] = useState<Message | null>(null)
  const [done, setDone] = useState(false)
  const [nudging, setNudging] = useState(false)
  const [leaving, setLeaving] = useState(false)
  const [left, setLeft] = useState(RESEND_SECONDS)

  const cardRef = useRef<HTMLElement>(null)
  const askRef = useRef<HTMLDivElement>(null)
  const footRef = useRef<HTMLDivElement>(null)
  const doneRef = useRef<HTMLDivElement>(null)
  const ctaRef = useRef<HTMLDivElement>(null)
  const stageRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const ringRef = useRef<SVGSVGElement>(null)
  const circleRef = useRef<SVGCircleElement>(null)
  const hubRef = useRef<HTMLSpanElement>(null)
  const successRef = useRef<HTMLDivElement>(null)
  const badgeRef = useRef<HTMLDivElement>(null)
  const f1Ref = useRef<HTMLSpanElement>(null)
  const f2Ref = useRef<HTMLSpanElement>(null)
  const coreRef = useRef<HTMLSpanElement>(null)
  const pathRef = useRef<SVGPathElement>(null)
  const slotRefs = useRef<HTMLDivElement[]>([])
  const digitRefs = useRef<HTMLSpanElement[]>([])
  const headRefs = useRef<SVGRectElement[]>([])
  const tailRefs = useRef<SVGRectElement[]>([])

  const ctx = useRef<gsap.Context | null>(null)
  const alive = useRef(false)
  const busy = useRef(false)
  const reduced = useRef(false)
  const prev = useRef('')
  // Stage geometry and orbit state: t = 0 row, 1 orbit; a = angle; rot = own rotation; r = radius.
  const geo = useRef({ s: 46, cx: 0, cy: 0 })
  const orbit = useRef({ t: 0, a: 0, rot: 0, r: 80 })

  const anim = (fn: () => void) => ctx.current?.add(fn)

  function render() {
    const { s, cx, cy } = geo.current
    const S = orbit.current
    slotRefs.current.forEach((el, i) => {
      const hx = cx + (i - (N - 1) / 2) * (s + GAP) - s / 2
      const hy = cy - s / 2
      const ang = ((180 + i * 60 + S.a) * Math.PI) / 180
      const ox = cx + S.r * Math.cos(ang) - s / 2
      const oy = cy + S.r * Math.sin(ang) - s / 2
      gsap.set(el, { x: (ox - hx) * S.t, y: (oy - hy) * S.t, rotation: S.rot })
    })
  }

  function layout() {
    const stage = stageRef.current
    const input = inputRef.current
    if (!stage || !input) return
    const w = stage.clientWidth
    const h = stage.clientHeight
    const s = Math.min(48, Math.floor((w - GAP * (N - 1)) / N))
    const cx = w / 2
    const cy = h / 2
    const R = Math.min(86, h / 2 - s / 2 - 8)
    geo.current = { s, cx, cy }
    if (orbit.current.t === 0) orbit.current.r = R
    slotRefs.current.forEach((el, i) => {
      el.style.width = el.style.height = `${s}px`
      el.style.left = `${cx + (i - (N - 1) / 2) * (s + GAP) - s / 2}px`
      el.style.top = `${cy - s / 2}px`
      const radius = parseFloat(getComputedStyle(el).borderTopLeftRadius) || 12
      for (const rect of [headRefs.current[i], tailRefs.current[i]]) {
        if (!rect) continue
        rect.setAttribute('x', '1')
        rect.setAttribute('y', '1')
        rect.setAttribute('width', String(s - 2))
        rect.setAttribute('height', String(s - 2))
        rect.setAttribute('rx', String(radius - 1))
      }
    })
    ringRef.current?.setAttribute('viewBox', `0 0 ${w} ${h}`)
    circleRef.current?.setAttribute('cx', String(cx))
    circleRef.current?.setAttribute('cy', String(cy))
    circleRef.current?.setAttribute('r', String(R))
    gsap.set(ringRef.current, { transformOrigin: `${cx}px ${cy}px` })
    for (const el of [hubRef.current, badgeRef.current]) {
      if (!el) continue
      el.style.left = `${cx}px`
      el.style.top = `${cy}px`
    }
    const rowW = N * s + (N - 1) * GAP
    Object.assign(input.style, { left: `${cx - rowW / 2}px`, top: `${cy - s / 2}px`, width: `${rowW}px`, height: `${s}px` })
    render()
  }

  useLayoutEffect(() => {
    alive.current = true
    reduced.current = matchMedia('(prefers-reduced-motion: reduce)').matches
    const context = gsap.context(() => {}, cardRef)
    ctx.current = context
    context.add(() => {
      gsap.set([f1Ref.current, f2Ref.current, coreRef.current], { xPercent: -50, yPercent: -50, scale: 0 })
      gsap.set(coreRef.current, { '--glow': 30 })
    })
    const stage = stageRef.current
    const observer = new ResizeObserver(layout)
    if (stage) {
      observer.observe(stage)
      layout()
      stage.style.visibility = 'visible'
    }
    // Entrance: the text first, line by line, then the cells land one by one. Only opacity, blur,
    // scale and yPercent move here; the orbit owns x, y and rotation, so the two never collide.
    if (!reduced.current) {
      context.add(() => {
        gsap
          .timeline()
          .from(askRef.current ? [...askRef.current.children] : [], {
            opacity: 0,
            y: 14,
            filter: 'blur(8px)',
            duration: 0.55,
            ease: 'power3.out',
            stagger: 0.08,
            clearProps: 'opacity,transform,filter',
          })
          .from(
            slotRefs.current,
            { opacity: 0, yPercent: 70, scale: 0.55, filter: 'blur(6px)', duration: 0.6, ease: 'back.out(1.7)', stagger: 0.075, clearProps: 'opacity,filter' },
            0.3,
          )
          .from(footRef.current, { opacity: 0, y: 8, duration: 0.4, ease: 'power2.out', clearProps: 'opacity,transform' }, '-=0.25')
      })
    }
    if (!matchMedia('(pointer: coarse)').matches) inputRef.current?.focus()
    return () => {
      alive.current = false
      observer.disconnect()
      context.revert()
      ctx.current = null
    }
    // Mount only: `layout` reads refs, not props or state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Pop and frame light on every new digit (3.2).
  useLayoutEffect(() => {
    const from = prev.current.length
    prev.current = value
    if (reduced.current) return
    for (let i = from; i < value.length; i++) {
      const digit = digitRefs.current[i]
      const head = headRefs.current[i]
      const tail = tailRefs.current[i]
      anim(() => {
        gsap.fromTo(digit, { scale: 0.5, opacity: 0 }, { scale: 1, opacity: 1, duration: 0.28, ease: 'back.out(2.2)' })
        gsap
          .timeline()
          .set(head, { attr: { 'stroke-dasharray': '9 100' }, strokeDashoffset: 0, opacity: 1 })
          .set(tail, { attr: { 'stroke-dasharray': '26 100' }, strokeDashoffset: 8, opacity: 0.45 })
          .to([head, tail], { strokeDashoffset: '-=104', duration: 0.75, ease: 'power2.inOut' }, 0)
          .to([head, tail], { opacity: 0, duration: 0.2 }, 0.58)
      })
    }
  }, [value])

  // Resend countdown (3.6).
  useEffect(() => {
    if (left <= 0 || done) return
    const id = setTimeout(() => setLeft((n) => n - 1), 1000)
    return () => clearTimeout(id)
  }, [left, done])

  function toEnd() {
    const input = inputRef.current
    if (!input) return
    const end = input.value.length
    input.setSelectionRange(end, end)
  }

  function onInput(event: ChangeEvent<HTMLInputElement>) {
    accept(event.target.value)
  }

  // `maxLength` would cut "48 29-13" to "48 29-" before the digit filter, so a paste is read whole.
  function onPaste(event: ClipboardEvent<HTMLInputElement>) {
    event.preventDefault()
    accept(value + event.clipboardData.getData('text'))
  }

  function accept(raw: string) {
    if (busy.current) return
    const next = raw.replace(/\D/g, '').slice(0, N)
    if (next === value) return
    if (next.length > value.length && message) setMessage(null)
    setValue(next)
    if (next.length === N) void submit(next)
  }

  async function submit(code: string) {
    busy.current = true
    setPhase('verifying')
    inputRef.current?.blur()
    const check = onVerify(code).catch((): CodeVerifyStatus => 'error')

    if (reduced.current) {
      const status = await check
      if (!alive.current) return
      return status === 'ok' ? finishOk(true) : finishBad(status, true)
    }

    await wait(260)
    if (!alive.current) return
    const S = orbit.current
    const ring = ringRef.current
    let orbitDone: Promise<unknown> = Promise.resolve()
    anim(() => {
      const tl = gsap.timeline()
      tl.fromTo(ring, { opacity: 0, scale: 0.7 }, { opacity: 1, scale: 1, duration: 0.45, ease: 'power2.out' }, 0)
        .to(hubRef.current, { opacity: 1, duration: 0.3 }, 0.15)
        .to(S, { t: 1, duration: 0.5, ease: 'power3.inOut', onUpdate: render }, 0)
        .to(S, { a: 420, rot: 360, duration: 1.3, ease: 'power4.inOut', onUpdate: render }, 0.45)
        .to(slotRefs.current, { scale: 1.08, duration: 0.12, ease: 'power2.out', yoyo: true, repeat: 1 }, 1.75)
      orbitDone = tl.then()
    })
    const [status] = await Promise.all([check, orbitDone])
    if (!alive.current) return
    return status === 'ok' ? finishOk(false) : finishBad(status, false)
  }

  async function finishBad(status: Exclude<CodeVerifyStatus, 'ok'>, plain: boolean) {
    if (!plain) {
      anim(() => gsap.fromTo(stageRef.current, { x: -10 }, { x: 0, duration: 0.6, ease: 'elastic.out(1, .3)' }))
      await wait(450)
      if (!alive.current) return
      const S = orbit.current
      let back: Promise<unknown> = Promise.resolve()
      anim(() => {
        const tl = gsap.timeline()
        tl.to(S, { t: 0, a: 360, rot: 360, duration: 0.6, ease: 'power3.inOut', onUpdate: render }, 0)
          .to(ringRef.current, { opacity: 0, scale: 0.8, duration: 0.4 }, 0)
          .to(hubRef.current, { opacity: 0, duration: 0.2 }, 0)
        back = tl.then()
      })
      await back
      if (!alive.current) return
      S.a = 0
      S.rot = 0
      render()
    } else {
      await wait(500)
      if (!alive.current) return
    }
    busy.current = false
    prev.current = ''
    flushSync(() => {
      setMessage(VERIFY_MESSAGE[status])
      setValue('')
      setPhase('typing')
    })
    inputRef.current?.focus()
  }

  async function finishOk(plain: boolean) {
    setPhase('success')
    const slots = slotRefs.current
    const fading = [...slots, askRef.current, footRef.current]
    const showResult = () => {
      flushSync(() => setDone(true))
    }

    if (plain) {
      await wait(300)
      if (!alive.current) return
      anim(() => gsap.to(fading, { opacity: 0, duration: 0.25 }))
      await wait(260)
      if (!alive.current) return
      showResult()
      anim(() => {
        gsap.set(coreRef.current, { scale: 1.65 })
        gsap.set(pathRef.current, { strokeDashoffset: 0 })
        gsap.fromTo([doneRef.current, ctaRef.current, badgeRef.current], { opacity: 0 }, { opacity: 1, duration: 0.3 })
      })
      return
    }

    await wait(700)
    if (!alive.current) return
    const S = orbit.current
    const core = coreRef.current
    const f1 = f1Ref.current
    const f2 = f2Ref.current
    let sequence: Promise<unknown> = Promise.resolve()
    anim(() => {
      const tl = gsap.timeline()
      tl.to(S, { r: 0, a: '+=140', rot: '+=140', duration: 0.55, ease: 'power2.in', onUpdate: render }, 0)
        .to(slots, { scale: 0.25, opacity: 0, duration: 0.5, ease: 'power2.in' }, 0.05)
        .to(ringRef.current, { scale: 0.3, opacity: 0, duration: 0.45, ease: 'power2.in' }, 0)
        .to([askRef.current, footRef.current], { opacity: 0, duration: 0.3 }, 0)
        .to(hubRef.current, { scale: 2.5, duration: 0.2, ease: 'power2.out' }, 0.45)
        .to(hubRef.current, { opacity: 0, duration: 0.15 }, 0.6)
        .add(() => {
          showResult()
          anim(() =>
            gsap.fromTo([doneRef.current, ctaRef.current], { opacity: 0, y: 6 }, { opacity: 1, y: 0, duration: 0.45, stagger: 0.08, ease: 'power2.out', delay: 0.15 }),
          )
        }, 0.6)
        .to(core, { scale: 1, duration: 0.5, ease: 'back.out(2)' }, 0.6)
        .to(pathRef.current, { strokeDashoffset: 0, duration: 0.35, ease: 'power2.out' }, 0.85)
        .add(() => burst(8, 55, 35), 0.62)
        // The child frames expand past their place...
        .to(f2, { scale: 1.2, duration: 0.5, ease: 'power2.out' }, 0.66)
        .to(f1, { scale: 1.26, duration: 0.55, ease: 'power2.out' }, 0.7)
        // ...then retract and hit the parent.
        .to(f2, { scale: 60 / 108, '--frame-a': 70, duration: 0.28, ease: 'power3.in' }, 1.22)
        .to(f1, { scale: 60 / 150, '--frame-a': 70, duration: 0.3, ease: 'power3.in' }, 1.22)
        .set([f1, f2], { opacity: 0 }, 1.52)
        // Impact: the parent absorbs them and takes its final shape.
        .to(core, { scaleX: 1.91, scaleY: 1.67, '--glow': 70, duration: 0.11, ease: 'power2.out' }, 1.5)
        .add(impact, 1.52)
        .to(core, { scaleX: 1.65, scaleY: 1.65, '--glow': 42, duration: 0.9, ease: 'elastic.out(1, .38)' }, 1.61)
      sequence = tl.then()
    })
    await sequence
    if (alive.current) setNudging(true)
  }

  function spark(size: number) {
    const { cx, cy } = geo.current
    const p = document.createElement('span')
    p.dataset.spark = ''
    p.className = 'absolute rounded-full bg-brand opacity-0'
    Object.assign(p.style, { left: `${cx}px`, top: `${cy}px`, width: `${size}px`, height: `${size}px`, margin: `${-size / 2}px 0 0 ${-size / 2}px` })
    successRef.current?.appendChild(p)
    return p
  }

  // Radial burst: n particles at a base distance plus a random spread.
  function burst(n: number, base: number, spread: number) {
    anim(() => {
      for (let i = 0; i < n; i++) {
        const p = spark(2 + Math.random() * 4)
        const ang = (i / n) * Math.PI * 2 + Math.random() * 0.4
        const dist = base + Math.random() * spread
        gsap
          .timeline({ onComplete: () => p.remove() })
          .set(p, { opacity: 1 })
          .to(p, { x: Math.cos(ang) * dist, y: Math.sin(ang) * dist, duration: 0.8 + Math.random() * 0.5, ease: 'expo.out' }, 0)
          .to(p, { opacity: 0, scale: 0.3, duration: 0.6 }, 0.4 + Math.random() * 0.3)
      }
    })
  }

  // The final hit: expanding silhouettes, a burst and remains that drift and flicker.
  function impact() {
    const { cx, cy } = geo.current
    const size = 99 // final square: 60 × 1.65
    anim(() => {
      for (let k = 0; k < 3; k++) {
        const g = document.createElement('span')
        g.dataset.ghost = ''
        g.className = 'pointer-events-none absolute rounded-[26px] border-[1.5px] border-ring'
        Object.assign(g.style, { left: `${cx}px`, top: `${cy}px`, width: `${size}px`, height: `${size}px` })
        successRef.current?.appendChild(g)
        gsap.fromTo(
          g,
          { xPercent: -50, yPercent: -50, scale: 1, opacity: 0.75 - k * 0.15, rotation: (k - 1) * 6 },
          { scale: 2.2 + k * 0.7, opacity: 0, rotation: (k - 1) * 14, duration: 1.1 + k * 0.35, delay: k * 0.09, ease: 'power2.out', onComplete: () => g.remove() },
        )
      }
      for (let i = 0; i < 12; i++) {
        const p = spark(2 + Math.random() * 3)
        const ang = Math.random() * Math.PI * 2
        const d1 = 50 + Math.random() * 50
        const d2 = d1 + 40 + Math.random() * 60
        const life = 2.6 + Math.random() * 1.8
        gsap
          .timeline({ onComplete: () => p.remove() })
          .set(p, { opacity: 0.9 })
          .to(p, { x: Math.cos(ang) * d1, y: Math.sin(ang) * d1, duration: 0.7, ease: 'expo.out' }, 0)
          .to(p, { x: Math.cos(ang) * d2, y: Math.sin(ang) * d2 - 20, duration: life, ease: 'sine.out' }, 0.7)
          .to(p, { opacity: 0.25, duration: 0.35, yoyo: true, repeat: 3, ease: 'sine.inOut' }, 0.8)
          .to(p, { opacity: 0, duration: 1 }, 0.7 + life - 1)
      }
    })
    burst(30, 80, 70)
  }

  async function resend() {
    setLeft(RESEND_SECONDS)
    setMessage(null)
    inputRef.current?.focus()
    const status = await onResend().catch((): CodeResendStatus => 'error')
    if (!alive.current) return
    if (status === 'rate_limited') setMessage('demasiadosPedidos')
    else if (status === 'error') setMessage('errorEnvio')
  }

  const activeIndex = focused && phase === 'typing' && value.length < N ? value.length : -1

  return (
    <section ref={cardRef} aria-live="polite" className="relative w-full max-w-sm rounded-card border border-border bg-card px-5 pt-7 pb-5 text-center">
      {done ? (
        <div ref={doneRef}>
          <h1 className="text-headline-lg text-brand-ink">{t('listoEntraste')}</h1>
          <p className="mx-auto mt-2 max-w-[30ch] text-body-md text-muted-foreground">{t('sesionAbierta')}</p>
        </div>
      ) : (
        <div ref={askRef}>
          <h1 className="text-headline-lg">{t('revisaTuMail')}</h1>
          <p className="mx-auto mt-2 max-w-[30ch] text-body-md text-muted-foreground">
            {t.rich('codigoEnviadoA', {
              email,
              strong: (chunks) => <strong className="font-semibold break-all text-foreground">{chunks}</strong>,
            })}
          </p>
          <button type="button" onClick={onChangeEmail} className="pressable mt-1 min-h-target rounded-lg px-2 text-body-sm text-muted-foreground underline underline-offset-4">
            {t('cambiarMail')}
          </button>
        </div>
      )}

      <div ref={stageRef} className="invisible relative my-2 h-60">
        <svg ref={ringRef} aria-hidden="true" className="pointer-events-none absolute inset-0 size-full overflow-visible opacity-0">
          <circle ref={circleRef} className="fill-none stroke-border" strokeWidth={1.5} strokeDasharray="2 8" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
        </svg>
        <span ref={hubRef} aria-hidden="true" className="absolute -mt-[3px] -ml-[3px] size-1.5 rounded-full bg-foreground opacity-0" />
        {Array.from({ length: N }, (_, i) => (
          <div
            key={i}
            ref={(el) => {
              if (el) slotRefs.current[i] = el
            }}
            aria-hidden="true"
            data-cell=""
            data-active={i === activeIndex || undefined}
            className={cn(
              'absolute flex items-center justify-center rounded-xl border-2 bg-muted text-tabular-numeric-lg text-foreground transition-[border-color,background-color,color,box-shadow] duration-200 ease-out motion-reduce:transition-none',
              phase === 'success'
                ? 'border-ring bg-field-active-fill text-ring [box-shadow:0_0_22px_var(--neon-glow)]'
                : i === activeIndex
                  ? 'border-ring bg-field-active-fill [box-shadow:var(--field-halo)]'
                  : 'border-border',
            )}
          >
            <span
              ref={(el) => {
                if (el) digitRefs.current[i] = el
              }}
              className="inline-block"
            >
              {value[i] ?? ''}
            </span>
            {i === activeIndex ? <span className="h-6 w-0.5 animate-caret-blink rounded-full bg-ring motion-reduce:animate-none" /> : null}
            <svg className="pointer-events-none absolute -inset-0.5 size-[calc(100%+4px)] overflow-visible [filter:drop-shadow(0_0_3px_var(--neon-glow))_drop-shadow(0_0_8px_var(--neon-glow))]">
              <rect
                ref={(el) => {
                  if (el) tailRefs.current[i] = el
                }}
                data-frame-light=""
                pathLength={100}
                className="fill-none stroke-ring opacity-0"
                strokeWidth={1.5}
                strokeLinecap="round"
                strokeDasharray="0 100"
              />
              <rect
                ref={(el) => {
                  if (el) headRefs.current[i] = el
                }}
                data-frame-light=""
                pathLength={100}
                className="fill-none stroke-ring opacity-0"
                strokeWidth={2}
                strokeLinecap="round"
                strokeDasharray="0 100"
              />
            </svg>
          </div>
        ))}
        <input
          ref={inputRef}
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="[0-9]*"
          maxLength={N}
          aria-label={t('codigoLabel')}
          value={value}
          disabled={phase !== 'typing'}
          onChange={onInput}
          onPaste={onPaste}
          onFocus={() => {
            setFocused(true)
            toEnd()
          }}
          onBlur={() => setFocused(false)}
          onClick={toEnd}
          onKeyUp={toEnd}
          className="absolute z-10 border-0 bg-transparent text-body-lg text-transparent caret-ring opacity-[0.001] outline-none"
        />
        <div ref={successRef} aria-hidden="true" className="pointer-events-none absolute inset-0">
          <div ref={badgeRef} className="absolute">
            <span ref={f1Ref} className="absolute size-[150px] rounded-[36px] border [--frame-a:18] [border-color:color-mix(in_oklab,var(--ring)_calc(var(--frame-a)*1%),transparent)]" />
            <span ref={f2Ref} className="absolute size-[108px] rounded-[28px] border [--frame-a:32] [border-color:color-mix(in_oklab,var(--ring)_calc(var(--frame-a)*1%),transparent)]" />
            <span
              ref={coreRef}
              data-check=""
              className="absolute flex size-[60px] items-center justify-center rounded-2xl border-[1.5px] border-ring bg-field-active-fill [box-shadow:0_0_calc(var(--glow)*1px)_var(--neon-glow)]"
            >
              <svg viewBox="0 0 30 30" className="size-[30px]">
                <path ref={pathRef} d="M8 15.5l5 5 9-10" className="fill-none stroke-ring" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" strokeDasharray={30} strokeDashoffset={30} />
              </svg>
            </span>
          </div>
        </div>
      </div>

      {done ? (
        <div ref={ctaRef} className="mt-4 flex justify-center">
          {/* On tap the button presses in, then folds into a round spinner that stays until
              /dashboard replaces the page. With reduced motion the fold is instant. */}
          <Button
            size="lg"
            aria-disabled={leaving || undefined}
            aria-busy={leaving || undefined}
            onClick={() => {
              if (leaving) return
              setNudging(false)
              setLeaving(true)
              onDone()
            }}
            onPointerDown={() => setNudging(false)}
            className={cn(
              'relative h-target overflow-hidden text-body-lg font-semibold transition-[width,border-radius,scale] duration-300 ease-out active:scale-95 motion-reduce:transition-none',
              leaving ? 'w-target rounded-full' : 'w-full',
              nudging && 'animate-nudge motion-reduce:animate-none',
            )}
          >
            <span className={cn('transition-opacity duration-150 motion-reduce:transition-none', leaving && 'opacity-0')}>{t('irAMiMes')}</span>
            <Loader2
              aria-hidden
              className={cn('absolute inset-0 m-auto size-5 animate-spin transition-opacity duration-200 motion-reduce:transition-none', leaving ? 'opacity-100 delay-150' : 'opacity-0')}
            />
          </Button>
        </div>
      ) : (
        <div ref={footRef} className="flex flex-col items-center gap-1">
          <p className={cn('min-h-10 max-w-[32ch] text-body-sm', message ? 'text-destructive-ink' : 'text-muted-foreground')} data-message="">
            {message ? t(message) : null}
          </p>
          <p className="text-body-sm text-muted-foreground">
            {t('noTeLlego')}{' '}
            <button
              type="button"
              onClick={resend}
              disabled={left > 0 || phase !== 'typing'}
              className="pressable min-h-target rounded-lg px-2 font-medium text-foreground underline underline-offset-4 disabled:text-muted-foreground disabled:no-underline"
            >
              {left > 0 ? t('reenviarEn', { segundos: left }) : t('reenviarCodigo')}
            </button>
          </p>
        </div>
      )}
    </section>
  )
}
