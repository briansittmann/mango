'use client'

import { useId, useLayoutEffect, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { RevealText } from '@/components/ui/reveal-text'
import { RevealTitle } from '@/components/ui/reveal-title'

gsap.registerPlugin(ScrollTrigger)

// A food budget of 400 over a 30-day month: [day, spent so far].
const SPENDING = [[1, 0], [5, 160], [10, 310], [15, 380], [20, 440], [25, 490], [30, 530]] as const
const BUDGET = 400
const CHART_HEIGHT = 380
const AXIS_DAYS = [1, 10, 20, 30]

// Monotone cubic through the points, so the curve never overshoots between them.
function spendingCurve(x: (day: number) => number, y: (value: number) => number) {
  const slopes = SPENDING.map(([day, value], index) => {
    const previous = SPENDING[Math.max(0, index - 1)]
    const next = SPENDING[Math.min(SPENDING.length - 1, index + 1)]
    const before = index === 0 ? (next[1] - value) / (next[0] - day) : (value - previous[1]) / (day - previous[0])
    const after = index === SPENDING.length - 1 ? before : (next[1] - value) / (next[0] - day)
    return (2 * before * after) / (before + after)
  })
  return SPENDING.reduce((path, [day, value], index) => {
    if (!index) return `M ${x(day)} ${y(value)}`
    const [previousDay, previousValue] = SPENDING[index - 1]
    const third = (day - previousDay) / 3
    return `${path} C ${x(previousDay + third)} ${y(previousValue + slopes[index - 1] * third)}, ${x(day - third)} ${y(value - slopes[index] * third)}, ${x(day)} ${y(value)}`
  }, '')
}

export function LandingPace() {
  const t = useTranslations('inicio')
  const root = useRef<HTMLElement>(null)
  const panel = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(900)
  const id = useId().replace(/:/g, '')
  const compact = width < 600
  const inset = compact ? 20 : 40
  const x = (day: number) => inset + ((day - 1) / 29) * (width - inset * 2)
  const y = (value: number) => 282 - (value / 560) * 184
  const curve = spendingCurve(x, y)
  const signalLeft = Math.max(inset, x(10) - 100)

  useLayoutEffect(() => {
    const node = panel.current
    if (!node) return
    const measure = () => setWidth(Math.round(node.clientWidth))
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(node)
    return () => observer.disconnect()
  }, [])

  useLayoutEffect(() => {
    const media = gsap.matchMedia(root)
    media.add('(prefers-reduced-motion: no-preference)', () => {
      gsap.set('.pace-reveal', { attr: { width: 0 } })
      gsap.set('.pace-marker', { attr: { x1: inset, x2: inset } })
      gsap.set('.pace-signal, .pace-bank, .pace-bracket', { autoAlpha: 0 })
      gsap.set('.pace-signal', { scale: 0.92, filter: 'blur(6px)', transformOrigin: '50% 0%' })
      gsap
        .timeline({
          defaults: { ease: 'none' },
          scrollTrigger: {
            trigger: root.current,
            start: 'top top',
            end: () => `+=${window.innerHeight * 1.8}`,
            pin: true,
            scrub: 0.5,
            invalidateOnRefresh: true,
            // Below the story's pin: measured after it, so its start includes that pin's spacer.
            refreshPriority: 1,
          },
        })
        .to('.pace-reveal', { attr: { width: width - inset * 2 + 2 }, duration: 0.88 }, 0)
        .to('.pace-marker', { attr: { x1: width - inset, x2: width - inset }, duration: 0.88 }, 0)
        .to('.pace-signal', { autoAlpha: 1, scale: 1, filter: 'blur(0px)', duration: 0.06, ease: 'power2.out' }, (9 / 29) * 0.88)
        .to('.pace-bank', { autoAlpha: 1, duration: 0.05 }, 0.88)
        .to('.pace-bracket', { autoAlpha: 1, duration: 0.06 }, 0.94)
      // Rebuilt on a resize: every pin below or above has to be measured again with it.
      ScrollTrigger.refresh()
    })
    return () => media.revert()
  }, [width, inset])

  return (
    <section ref={root} aria-labelledby={`${id}-heading`} className="flex min-h-svh items-center justify-center px-gutter py-16">
      <div className="flex w-full max-w-[920px] flex-col gap-8">
        <div className="mx-auto max-w-2xl text-center">
          <RevealTitle
            id={`${id}-heading`}
            text={t('ritmoTitulo')}
            className="text-balance font-display text-[32px] font-bold leading-[1.05] tracking-[-0.035em] text-foreground md:text-[52px]"
          />
          <RevealText text={t('ritmoTexto')} delay={0.3} className="mx-auto mt-4 max-w-xl text-pretty text-body-lg text-muted-foreground" />
        </div>
        <figure>
          <div ref={panel} className="liquid-glass relative overflow-hidden rounded-[28px] tabular-nums">
            <svg viewBox={`0 0 ${width} ${CHART_HEIGHT}`} className="block h-[380px] w-full" role="img" aria-labelledby={`${id}-title ${id}-description`}>
              <title id={`${id}-title`}>{t('ritmoGrafico')}</title>
              <desc id={`${id}-description`}>{t('ritmoGraficoDescripcion')}</desc>
              <defs>
                <clipPath id={`${id}-reveal`}>
                  <rect className="pace-reveal" x={inset - 1} y="0" width={width - inset * 2 + 2} height="300" />
                </clipPath>
                <clipPath id={`${id}-within`}>
                  <rect x="0" y={y(BUDGET)} width={width} height={300 - y(BUDGET)} />
                </clipPath>
                <clipPath id={`${id}-over`}>
                  <rect x="0" y="0" width={width} height={y(BUDGET)} />
                </clipPath>
                <linearGradient id={`${id}-fill`} x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0%" stopColor="var(--brand)" stopOpacity="0.28" />
                  <stop offset="100%" stopColor="var(--brand)" stopOpacity="0" />
                </linearGradient>
              </defs>
              <line x1={inset} x2={width - inset} y1={282} y2={282} className="stroke-border" />
              <line x1={inset} x2={width - inset} y1={y(BUDGET)} y2={y(BUDGET)} className="stroke-muted-foreground" strokeDasharray="5 6" strokeOpacity={0.55} />
              <text x={inset} y={y(BUDGET) - 12} className="fill-muted-foreground text-[13px]">
                {t('ritmoPresupuesto')}
              </text>
              <line x1={x(1)} y1={y(0)} x2={x(30)} y2={y(BUDGET)} className="stroke-muted-foreground" strokeDasharray="3 6" strokeOpacity={0.35} />
              <line className="pace-marker stroke-muted-foreground" strokeOpacity={0.3} x1={x(30)} x2={x(30)} y1="98" y2="288" />
              <g clipPath={`url(#${id}-reveal)`}>
                <path d={`${curve} L ${x(30)} 282 L ${x(1)} 282 Z`} fill={`url(#${id}-fill)`} clipPath={`url(#${id}-within)`} />
                <path d={curve} className="fill-none stroke-brand" strokeWidth={2.5} strokeLinecap="round" clipPath={`url(#${id}-within)`} />
                <path d={curve} className="fill-none stroke-destructive-ink" strokeWidth={2.5} strokeLinecap="round" clipPath={`url(#${id}-over)`} />
              </g>
              {AXIS_DAYS.map((day) => (
                <text key={day} x={x(day)} y="309" textAnchor="middle" className="fill-muted-foreground text-[13px]">
                  {day}
                </text>
              ))}
              <g className="pace-signal" aria-hidden>
                <line x1={x(10)} x2={x(10)} y1={y(310)} y2={compact ? 118 : 201} className="stroke-muted-foreground" strokeOpacity={0.45} />
                <circle cx={x(10)} cy={y(310)} r="9" className="fill-brand" opacity={0.2} />
                <circle cx={x(10)} cy={y(310)} r="4" className="fill-brand" />
              </g>
              <g className="pace-bank" aria-hidden>
                <line x1={x(30)} x2={x(30)} y1={compact ? 201 : 94} y2={y(530)} className="stroke-muted-foreground" strokeOpacity={0.45} />
                <circle cx={x(30)} cy={y(530)} r="3.5" className="fill-destructive-ink" />
              </g>
              <g className="pace-bracket">
                <path d={`M ${x(10)} 326 v 7 H ${x(30)} v -7`} className="fill-none stroke-brand" strokeOpacity={0.7} />
                <text x={(x(10) + x(30)) / 2} y="358" textAnchor="middle" className="fill-brand-ink text-[13px] font-medium">
                  {t('ritmoVentana')}
                </text>
              </g>
            </svg>
            <div
              aria-hidden
              className="pace-signal absolute flex w-[200px] flex-col gap-0.5 rounded-2xl border border-brand/30 bg-card/90 p-3 shadow-lg backdrop-blur-md"
              style={{ left: signalLeft, top: compact ? 20 : 201 }}
            >
              <span className="flex items-center gap-1.5 text-label-ui text-brand-ink">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/mango-logo-light.svg" alt="" className="size-4 dark:hidden" />
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/mango-logo-dark.svg" alt="" className="hidden size-4 dark:block" />
                {t('ritmoMango')}
              </span>
              <strong className="font-display text-headline-md text-foreground">{t('ritmoSenal')}</strong>
              <span className="text-body-sm text-muted-foreground">{t('ritmoSenalDetalle')}</span>
            </div>
            <div
              aria-hidden
              className="pace-bank absolute flex w-[190px] flex-col gap-0.5 rounded-2xl border border-border bg-card/90 p-3 backdrop-blur-md"
              style={{ right: inset, top: compact ? 201 : 20 }}
            >
              <span className="text-label-ui text-muted-foreground">{t('ritmoBanco')}</span>
              <strong className="font-display text-headline-md text-destructive-ink">{t('ritmoExceso')}</strong>
            </div>
          </div>
        </figure>
      </div>
    </section>
  )
}
