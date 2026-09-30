'use client'

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { BatteryFull, CheckCheck, Signal, Wifi } from 'lucide-react'
import { cn } from '@/lib/utils'

gsap.registerPlugin(ScrollTrigger)

type StoryMessage = { texto: string; descripcion: string; categoria: string; monto: number; respuesta: string }

// The phone shows `/demo` at an iPhone's CSS size, scaled to fit the stage.
const SCREEN_WIDTH = 390
const SCREEN_HEIGHT = 844
const STATUS_BAR = 47
const BEZEL = 10
const CLOCK = '9:41'
// Step thresholds along the pinned scroll: the intro, then one message each.
const STEP_AT = [0.14, 0.36, 0.58]
// The last stretch of the pin scrolls the dashboard down to its categories.
const INNER_SCROLL_FROM = 0.76
const INNER_SCROLL_DISTANCE = 430
// The reply lands this long after its message: the margin drops with it, not before.
const REPLY_DELAY_MS = 1100

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

  useLayoutEffect(() => {
    const media = gsap.matchMedia()
    media.add({ motion: '(prefers-reduced-motion: no-preference)', reduced: '(prefers-reduced-motion: reduce)' }, (context) => {
      if (context.conditions?.reduced) {
        goTo(messages.length)
        return
      }
      gsap.fromTo(
        phoneRef.current,
        { rotateX: 28, scale: 0.84, y: 60 },
        { rotateX: 0, scale: 1, y: 0, ease: 'none', scrollTrigger: { trigger: rootRef.current, start: 'top bottom', end: 'top top', scrub: 0.6 } },
      )
      ScrollTrigger.create({
        trigger: rootRef.current,
        start: 'top top',
        end: () => `+=${window.innerHeight * 3.2}`,
        pin: true,
        invalidateOnRefresh: true,
        onUpdate: (self) => {
          goTo(stepAt(self.progress))
          const inner = gsap.utils.clamp(0, 1, (self.progress - INNER_SCROLL_FROM) / (1 - INNER_SCROLL_FROM))
          frameRef.current?.contentWindow?.scrollTo(0, gsap.parseEase('power2.inOut')(inner) * INNER_SCROLL_DISTANCE)
        },
      })
    })
    return () => media.revert()
  }, [goTo, messages.length])

  function onFrameLoad(event: React.SyntheticEvent<HTMLIFrameElement>) {
    event.currentTarget.contentDocument?.documentElement.style.setProperty('scrollbar-width', 'none')
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
                  side === 'left' ? '-left-5 md:left-auto md:right-[calc(100%+2.5rem)]' : '-right-5 md:left-[calc(100%+2.5rem)] md:right-auto',
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
