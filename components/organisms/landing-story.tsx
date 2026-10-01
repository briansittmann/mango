'use client'

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import { gsap } from 'gsap'
import { Observer } from 'gsap/Observer'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { BatteryFull, CheckCheck, Signal, Wifi } from 'lucide-react'
import { cn } from '@/lib/utils'

gsap.registerPlugin(ScrollTrigger, Observer)

type StoryMessage = { texto: string; descripcion: string; categoria: string; monto: number; respuesta: string }

// The phone shows `/demo` at an iPhone's CSS size, scaled to fit the stage.
const SCREEN_WIDTH = 390
const SCREEN_HEIGHT = 844
const STATUS_BAR = 47
const BEZEL = 10
const CLOCK = '9:41'
// Step thresholds along the pinned scroll: the intro, then one message each.
const STEP_AT = [0.18, 0.47, 0.76]
// The reply lands this long after its message: the margin drops with it, not before.
const REPLY_DELAY_MS = 1100
// Inside the pin, a gesture moves one step; the next waits this long, so each message is seen.
const STEP_HOLD_MS = 900
// A new gesture starts after this long without input.
const GESTURE_GAP_MS = 200
// How long a jump holds the page still against a fling's leftover momentum.
const MOMENTUM_HOLD_MS = 700

function stepAt(progress: number) {
  return STEP_AT.filter((at) => progress >= at).length
}

function StatusBar({ scale }: { scale: number }) {
  return (
    <div
      className="flex items-end justify-between bg-background px-[8%] font-display font-semibold text-foreground"
      style={{ height: STATUS_BAR * scale, paddingBottom: 6 * scale, fontSize: 15 * scale }}
    >
      <span>{CLOCK}</span>
      <span className="flex items-center" style={{ gap: 5 * scale }}>
        <Signal style={{ width: 16 * scale, height: 16 * scale }} strokeWidth={2.5} />
        <Wifi style={{ width: 16 * scale, height: 16 * scale }} strokeWidth={2.5} />
        <BatteryFull style={{ width: 22 * scale, height: 22 * scale }} strokeWidth={2} />
      </span>
    </div>
  )
}

function Skeleton() {
  return (
    <div aria-hidden className="flex flex-col gap-3 p-4">
      <div className="h-8 w-2/5 animate-pulse rounded-full bg-muted" />
      <div className="h-28 animate-pulse rounded-card bg-muted" />
      <div className="h-36 animate-pulse rounded-card bg-muted [animation-delay:150ms]" />
      <div className="h-24 animate-pulse rounded-card bg-muted [animation-delay:300ms]" />
    </div>
  )
}

function ChatBubbles({ message, side, visible }: { message: StoryMessage; side: 'left' | 'right'; visible: boolean }) {
  return (
    <div
      data-visible={visible}
      data-side={side}
      className={cn('landing-chat flex w-[min(62vw,264px)] flex-col gap-2', side === 'left' ? 'items-end' : 'items-start')}
      style={{ '--from-x': side === 'left' ? '-28px' : '28px' } as React.CSSProperties}
    >
      <div className="landing-chat-out liquid-glass rounded-[20px] rounded-br-md px-4 py-2.5">
        <p className="text-body-lg font-medium text-foreground">{message.texto}</p>
        <p className="mt-0.5 flex items-center justify-end gap-1 text-[11px] text-muted-foreground">
          {CLOCK}
          <CheckCheck className="size-3.5 text-brand-ink" aria-hidden />
        </p>
      </div>
      <div className="landing-chat-in relative flex max-w-full items-start gap-2 rounded-[20px] rounded-bl-md border border-border bg-card/80 px-3 py-2.5 shadow-lg backdrop-blur-md">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/mango-logo-light.svg" alt="" aria-hidden className="size-6 shrink-0 dark:hidden" />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/mango-logo-dark.svg" alt="" aria-hidden className="hidden size-6 shrink-0 dark:block" />
        <span className="landing-typing absolute left-11 top-1/2 flex -translate-y-1/2 gap-1" aria-hidden>
          <span className="size-1.5 rounded-full bg-muted-foreground" />
          <span className="size-1.5 rounded-full bg-muted-foreground" />
          <span className="size-1.5 rounded-full bg-muted-foreground" />
        </span>
        <p className="landing-reply pt-0.5 text-body-md text-foreground">{message.respuesta}</p>
      </div>
    </div>
  )
}

export function LandingStory() {
  const t = useTranslations('inicio')
  const messages = t.raw('historiaMensajes') as StoryMessage[]
  const captions = [t('historiaPaso0'), t('historiaPaso1'), t('historiaPaso2'), t('historiaPaso3')]
  const rootRef = useRef<HTMLElement>(null)
  const phoneRef = useRef<HTMLDivElement>(null)
  const frameRef = useRef<HTMLIFrameElement>(null)
  const stepRef = useRef(0)
  const postTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [step, setStep] = useState(0)
  const [src, setSrc] = useState<string | null>(null)
  const [loaded, setLoaded] = useState(false)
  const [scale, setScale] = useState(0.72)

  // How many of the story's expenses the dashboard shows: one per step past the intro.
  const post = useCallback(
    (count: number) => {
      frameRef.current?.contentWindow?.postMessage(
        {
          type: 'mango:story',
          entries: messages.slice(0, count).map((message, index) => ({
            id: `landing-${index}`,
            categoryId: message.categoria,
            description: message.descripcion,
            amount: message.monto,
          })),
        },
        window.location.origin,
      )
    },
    [messages],
  )

  const goTo = useCallback(
    (next: number) => {
      const previous = stepRef.current
      if (next === previous) return
      stepRef.current = next
      setStep(next)
      if (postTimerRef.current) clearTimeout(postTimerRef.current)
      if (next < previous) {
        post(next)
        return
      }
      postTimerRef.current = setTimeout(() => {
        post(next)
        phoneRef.current?.animate(
          [{ boxShadow: 'var(--landing-phone-shadow), 0 0 0 0 var(--landing-pulse)' }, { boxShadow: 'var(--landing-phone-shadow), 0 0 0 18px transparent' }],
          { duration: 900, easing: 'cubic-bezier(0.23, 1, 0.32, 1)' },
        )
      }, REPLY_DELAY_MS)
    },
    [post],
  )

  useEffect(() => {
    function onMessage(event: MessageEvent) {
      if (event.origin !== window.location.origin || event.source !== frameRef.current?.contentWindow) return
      if (event.data?.type === 'mango:ready') post(stepRef.current)
    }
    window.addEventListener('message', onMessage)
    return () => {
      window.removeEventListener('message', onMessage)
      if (postTimerRef.current) clearTimeout(postTimerRef.current)
    }
  }, [post])

  // The dashboard loads as the phone comes into view, so its own entrance plays on screen.
  useEffect(() => {
    const root = rootRef.current
    if (!root) return
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return
        setSrc('/demo?embed=1')
        observer.disconnect()
      },
      { rootMargin: '0px 0px -20% 0px' },
    )
    observer.observe(root)
    return () => observer.disconnect()
  }, [])

  useEffect(() => {
    function measure() {
      const byHeight = (window.innerHeight - (window.innerWidth >= 768 ? 250 : 200)) / (SCREEN_HEIGHT + STATUS_BAR)
      const byWidth = (window.innerWidth - 72) / SCREEN_WIDTH
      setScale(Math.max(0.5, Math.min(0.86, byHeight, byWidth)))
    }
    measure()
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  }, [])

  // The pin reads the latest `goTo` through a ref: rebuilding the pin when the texts change (a
  // language switch) would put it after the pace chart's, whose start then ignores this spacer.
  const goToRef = useRef(goTo)
  useEffect(() => {
    goToRef.current = goTo
  }, [goTo])

  useLayoutEffect(() => {
    const media = gsap.matchMedia()
    media.add({ motion: '(prefers-reduced-motion: no-preference)', reduced: '(prefers-reduced-motion: reduce)' }, (context) => {
      if (context.conditions?.reduced) {
        goToRef.current(STEP_AT.length)
        return
      }
      gsap.fromTo(
        phoneRef.current,
        { rotateX: 28, scale: 0.84, y: 60 },
        { rotateX: 0, scale: 1, y: 0, ease: 'none', scrollTrigger: { trigger: rootRef.current, start: 'top bottom', end: 'top top', scrub: 0.6 } },
      )
      // While the phone is pinned, a swipe or a wheel gesture moves one step, however long it was:
      // a long fling would otherwise run the whole story in a second. A step jumps the scroll to
      // that step's place, so the scroll position still decides what shows.
      let anchor = 0
      let holdUntil = 0
      let lastInput = 0
      let lastStep = 0
      let lastDrag = 0
      let lastClick = 0
      const holdAt = (y: number) => {
        anchor = y
        holdUntil = performance.now() + MOMENTUM_HOLD_MS
        window.scrollTo(0, y)
      }
      // iOS keeps a fling's momentum going without touch events: the page is held in place a beat.
      const onScroll = () => {
        if (performance.now() < holdUntil && window.scrollY !== anchor) window.scrollTo(0, anchor)
      }
      const onDrag = () => {
        lastDrag = performance.now()
      }
      const onClick = () => {
        lastClick = performance.now()
      }
      const advance = (direction: 1 | -1) => {
        const now = performance.now()
        // One step per gesture: the events of a drag, or a wheel's inertia, come without a pause.
        const fresh = now - lastInput > GESTURE_GAP_MS
        lastInput = now
        if (!fresh || now - lastStep < STEP_HOLD_MS) return
        lastStep = now
        const next = stepRef.current + direction
        if (next < 0 || next > STEP_AT.length) {
          observer.disable()
          window.scrollTo(0, next < 0 ? pin.start - 2 : pin.end + 2)
          return
        }
        holdAt(next === 0 ? pin.start + 1 : pin.start + (pin.end - pin.start) * (STEP_AT[next - 1] + 0.02))
      }
      const observer = Observer.create({
        target: window,
        type: 'wheel,touch',
        wheelSpeed: -1,
        tolerance: 10,
        preventDefault: true,
        allowClicks: true,
        onUp: () => advance(1),
        onDown: () => advance(-1),
      })
      observer.disable()

      const pin = ScrollTrigger.create({
        trigger: rootRef.current,
        start: 'top top',
        end: () => `+=${window.innerHeight * 2.45}`,
        pin: true,
        invalidateOnRefresh: true,
        // It sits above the pace chart's pin, so it measures first (see `LandingPace`).
        refreshPriority: 2,
        onUpdate: (self) => {
          goToRef.current(stepAt(self.progress))
        },
        onToggle: (self) => {
          if (!self.isActive) {
            observer.disable()
            return
          }
          observer.enable()
          // The gesture that brought the page here doesn't count as a step.
          lastInput = performance.now()
          // Arriving on a swipe or a wheel, the story starts at its edge and the momentum stops. A
          // pixel inside: right on the edge, the pin counts as left.
          // A tap on the logo scrolls through smoothly: it isn't held.
          const now = performance.now()
          if (now - lastDrag < 2500 && lastDrag > lastClick) holdAt(self.direction > 0 ? self.start + 1 : self.end - 1)
        },
      })
      window.addEventListener('scroll', onScroll)
      window.addEventListener('touchmove', onDrag, { passive: true, capture: true })
      window.addEventListener('wheel', onDrag, { passive: true, capture: true })
      window.addEventListener('click', onClick, { capture: true })
      ScrollTrigger.refresh()
      return () => {
        observer.kill()
        window.removeEventListener('scroll', onScroll)
        window.removeEventListener('touchmove', onDrag, { capture: true })
        window.removeEventListener('wheel', onDrag, { capture: true })
        window.removeEventListener('click', onClick, { capture: true })
      }
    })
    return () => media.revert()
  }, [])

  function onFrameLoad(event: React.SyntheticEvent<HTMLIFrameElement>) {
    const root = event.currentTarget.contentDocument?.documentElement
    root?.style.setProperty('scrollbar-width', 'none')
    // The phone shows the top of the dashboard only: neither wheel, touch nor keys scroll it.
    root?.style.setProperty('overflow', 'hidden')
    setLoaded(true)
  }

  const screenWidth = SCREEN_WIDTH * scale
  const screenHeight = (SCREEN_HEIGHT + STATUS_BAR) * scale
  const radius = 50 * scale

  return (
    <section ref={rootRef} aria-label={t('historiaDescripcion')} className="relative h-svh overflow-x-clip">
      <div className="mx-auto flex h-full max-w-6xl flex-col items-center px-gutter pt-20 md:pt-24">
        <div className="relative grid h-16 w-full max-w-4xl place-items-center text-center md:h-16">
          {captions.map((caption, index) => (
            <p
              key={caption}
              aria-hidden={index !== step}
              data-active={index === step}
              className="landing-caption col-start-1 row-start-1 text-balance font-display text-[26px] font-bold leading-tight tracking-[-0.03em] text-foreground md:whitespace-nowrap md:text-[38px]"
            >
              {caption}
            </p>
          ))}
        </div>

        <div className="relative mt-4 [perspective:1400px] md:mt-6">
          <div
            ref={phoneRef}
            className="landing-phone relative"
            style={{ padding: BEZEL, borderRadius: radius + BEZEL, transformStyle: 'preserve-3d' }}
          >
            <div
              className="relative overflow-hidden bg-background"
              style={{ width: screenWidth, height: screenHeight, borderRadius: radius }}
            >
              <StatusBar scale={scale} />
              <div
                aria-hidden
                className="absolute left-1/2 z-10 -translate-x-1/2 rounded-full bg-black"
                style={{ top: 11 * scale, width: 120 * scale, height: 34 * scale }}
              />
              <div className="relative" style={{ height: SCREEN_HEIGHT * scale }}>
                <div className={cn('absolute inset-0 transition-opacity duration-500', loaded ? 'opacity-0' : 'opacity-100')}>
                  <Skeleton />
                </div>
                {src ? (
                  <iframe
                    ref={frameRef}
                    src={src}
                    title={t('historiaDescripcion')}
                    tabIndex={-1}
                    aria-hidden
                    onLoad={onFrameLoad}
                    className={cn(
                      'pointer-events-none absolute left-0 top-0 origin-top-left border-0 bg-transparent transition-opacity duration-700',
                      loaded ? 'opacity-100' : 'opacity-0',
                    )}
                    style={{ width: SCREEN_WIDTH, height: SCREEN_HEIGHT, transform: `scale(${scale})` }}
                  />
                ) : null}
                {/* iOS Safari can still hand a touch to an iframe with `pointer-events: none`. */}
                <div aria-hidden className="absolute inset-0" />
              </div>
            </div>
          </div>

          {messages.map((message, index) => {
            const side = index % 2 === 0 ? 'left' : 'right'
            return (
              <div
                key={message.texto}
                // On a phone the chats sit over the screen, so only the latest one stays, under the margin.
                data-latest={step === index + 1}
                className={cn(
                  'landing-chat-slot absolute top-[48%] z-20 md:top-[var(--slot-top)]',
                  side === 'left' ? 'md:right-[calc(100%+2.5rem)]' : 'md:left-[calc(100%+2.5rem)]',
                )}
                style={{ '--slot-top': `${[20, 44, 66][index]}%` } as React.CSSProperties}
              >
                <ChatBubbles message={message} side={side} visible={step > index} />
                <span
                  aria-hidden
                  data-visible={step > index}
                  data-side={side}
                  className={cn('landing-wire hidden md:block', side === 'left' ? 'left-full' : 'right-full')}
                />
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
