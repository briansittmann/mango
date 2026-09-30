'use client'

import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { useFormatter, useLocale, useTranslations } from 'next-intl'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { Check } from 'lucide-react'
import { Money } from '@/components/atoms/money'
import { FreeMarginCard } from '@/components/organisms/free-margin-card'
import { RevealTitle } from '@/components/ui/reveal-title'
import { cn } from '@/lib/utils'

gsap.registerPlugin(ScrollTrigger)

const CURRENCY = 'EUR'
// The demo's free margin, then five projected cycles after it.
const PROJECTION = [783, 910, 870, 940, 1020, 990]
const PROJECTION_START = new Date(Date.UTC(2026, 9, 1))

function useInView<T extends Element>() {
  const ref = useRef<T>(null)
  const [inView, setInView] = useState(false)
  useEffect(() => {
    const node = ref.current
    if (!node) return
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return
        setInView(true)
        observer.disconnect()
      },
      { threshold: 0.4 },
    )
    observer.observe(node)
    return () => observer.disconnect()
  }, [])
  return [ref, inView] as const
}

function Tile({ title, text, className, children }: { title: string; text: string; className?: string; children: ReactNode }) {
  return (
    <article className={cn('landing-tile liquid-glass flex flex-col justify-between gap-8 rounded-[28px] p-6 md:p-8', className)}>
      <div>{children}</div>
      <div>
        <h3 className="font-display text-headline-md text-foreground">{title}</h3>
        <p className="mt-2 max-w-md text-pretty text-body-md text-muted-foreground">{text}</p>
      </div>
    </article>
  )
}

type StoryMessage = { descripcion: string; monto: number }

// The story's three expenses, landing one after another under the card that they lower.
function MarginVisual() {
  const t = useTranslations('inicio')
  const entries = t.raw('historiaMensajes') as StoryMessage[]
  const [ref, inView] = useInView<HTMLDivElement>()
  const spent = entries.reduce((sum, entry) => sum + entry.monto, 0)
  return (
    <div ref={ref} className="grid items-center gap-6 md:grid-cols-2">
      <FreeMarginCard amount={inView ? 864 - spent : 0} currency={CURRENCY} />
      <ul className="flex flex-col gap-2">
        {entries.map((entry, index) => (
          <li
            key={entry.descripcion}
            className="landing-entry flex items-center justify-between gap-3 rounded-2xl border border-border bg-card/60 px-4 py-3"
            data-visible={inView}
            style={{ transitionDelay: `${300 + index * 140}ms` }}
          >
            <span className="text-body-md text-foreground">{entry.descripcion}</span>
            <Money amount={-entry.monto} currency={CURRENCY} className="text-tabular-numeric-md text-muted-foreground" />
          </li>
        ))}
      </ul>
    </div>
  )
}

function FixedVisual() {
  const t = useTranslations('inicio')
  const rows = [
    { name: t('fijosAlquiler'), amount: 820, color: 'var(--cat-gris_oscuro)', detail: t('fijosDia', { dia: 1 }), charged: true },
    { name: t('fijosSeguro'), amount: 35, color: 'var(--cat-gris_oscuro)', detail: t('fijosCuota', { hechas: 4, total: 10 }), charged: true },
    { name: t('fijosGimnasio'), amount: 40, color: 'var(--cat-verde_profundo)', detail: t('fijosDia', { dia: 22 }), charged: false },
  ]
  return (
    <ul className="flex flex-col divide-y divide-border">
      {rows.map((row) => (
        <li key={row.name} className="flex items-center gap-3 py-3 first:pt-0">
          <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: row.color }} />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-body-md font-medium text-foreground">{row.name}</span>
            <span className="block text-body-sm text-muted-foreground">{row.detail}</span>
          </span>
          <Money amount={row.amount} currency={CURRENCY} className="text-tabular-numeric-md text-foreground" />
          <span
            className={cn(
              'grid size-5 place-items-center rounded-full',
              row.charged ? 'bg-brand text-primary-foreground' : 'border border-dashed border-muted-foreground',
            )}
          >
            {row.charged ? <Check className="size-3" strokeWidth={3} /> : null}
          </span>
        </li>
      ))}
    </ul>
  )
}

function ProjectionVisual() {
  const locale = useLocale()
  const [ref, inView] = useInView<HTMLDivElement>()
  const month = new Intl.DateTimeFormat(locale, { month: 'short', timeZone: 'UTC' })
  const max = Math.max(...PROJECTION)
  // From a floor below the smallest value, so the months' differences show.
  const floor = Math.min(...PROJECTION) * 0.6
  return (
    <div ref={ref} className="flex h-44 items-end gap-2.5">
      {PROJECTION.map((value, index) => {
        const date = new Date(PROJECTION_START)
        date.setUTCMonth(date.getUTCMonth() + index)
        return (
          <div key={index} className="flex h-full flex-1 flex-col items-center justify-end gap-2">
            <span
              data-visible={inView}
              className={cn('landing-entry text-label-ui', index === 0 ? 'text-brand-ink' : 'text-muted-foreground')}
              style={{ transitionDelay: `${400 + index * 70}ms` }}
            >
              <Money amount={value} currency={CURRENCY} />
            </span>
            <div
              className={cn('landing-bar w-full rounded-t-lg', index === 0 ? 'bg-brand' : 'bg-foreground/15')}
              style={{ height: `${((value - floor) / (max - floor)) * 70}%`, scale: inView ? '1 1' : '1 0', transitionDelay: `${index * 70}ms` }}
            />
            <span className="text-label-ui capitalize text-muted-foreground">{month.format(date).replace('.', '')}</span>
          </div>
        )
      })}
    </div>
  )
}

function BudgetRow({ name, color, spent, budget, note, noteClassName, inView, delay }: {
  name: string
  color: string
  spent: number
  budget: number
  note: string
  noteClassName: string
  inView: boolean
  delay: number
}) {
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <span className="flex items-center gap-2 text-body-lg font-medium text-foreground">
          <span className="size-2.5 rounded-full" style={{ backgroundColor: color }} />
          {name}
        </span>
        <span className="text-body-md text-muted-foreground">
          <Money amount={spent} currency={CURRENCY} className="font-medium text-foreground" />
          {' / '}
          <Money amount={budget} currency={CURRENCY} />
        </span>
      </div>
      <div className="mt-3 h-2.5 overflow-hidden rounded-full bg-muted">
        <div
          className="progress-fill h-full rounded-full"
          style={{ width: inView ? `${(spent / budget) * 100}%` : '0%', backgroundColor: color, transitionDelay: `${delay}ms` }}
        />
      </div>
      <p className={cn('mt-2 text-body-sm', noteClassName)}>{note}</p>
    </div>
  )
}

function BudgetVisual() {
  const t = useTranslations('inicio')
  const tCategoria = useTranslations('categoria')
  const format = useFormatter()
  const [ref, inView] = useInView<HTMLDivElement>()
  return (
    <div ref={ref} className="flex flex-col gap-5">
      <BudgetRow
        name={t('presupuestoComida')}
        color="var(--cat-naranja_calido)"
        spent={310}
        budget={400}
        note={tCategoria('disponibleSemanal', { monto: format.number(37, { style: 'currency', currency: CURRENCY, trailingZeroDisplay: 'stripIfInteger' }) })}
        noteClassName="text-brand-ink"
        inView={inView}
        delay={0}
      />
      <BudgetRow
        name={t('presupuestoOcio')}
        color="var(--cat-violeta_metalico)"
        spent={130}
        budget={150}
        note={tCategoria('nearLimit')}
        noteClassName="text-warning-ink"
        inView={inView}
        delay={150}
      />
    </div>
  )
}

export function LandingFeatures() {
  const t = useTranslations('inicio')
  const root = useRef<HTMLElement>(null)

  useLayoutEffect(() => {
    const media = gsap.matchMedia(root)
    media.add('(prefers-reduced-motion: no-preference)', () => {
      gsap.from('.landing-tile', {
        y: 48,
        opacity: 0,
        filter: 'blur(10px)',
        duration: 0.9,
        ease: 'power3.out',
        stagger: 0.1,
        scrollTrigger: { trigger: root.current, start: 'top 75%' },
      })
    })
    return () => media.revert()
  }, [])

  return (
    <section ref={root} aria-labelledby="landing-funciones" className="mx-auto w-full max-w-6xl px-gutter py-24 md:py-32">
      <RevealTitle
        id="landing-funciones"
        text={t('funcionesTitulo')}
        className="mx-auto max-w-2xl text-balance text-center font-display text-[32px] font-bold leading-[1.05] tracking-[-0.035em] text-foreground md:text-[52px]"
      />
      <div className="mt-12 grid gap-4 md:mt-16 md:grid-cols-6">
        <Tile title={t('margenTitulo')} text={t('margenTexto')} className="md:col-span-4">
          <MarginVisual />
        </Tile>
        <Tile title={t('fijosTitulo')} text={t('fijosTexto')} className="md:col-span-2">
          <FixedVisual />
        </Tile>
        <Tile title={t('proyeccionTitulo')} text={t('proyeccionTexto')} className="md:col-span-3">
          <ProjectionVisual />
        </Tile>
        <Tile title={t('presupuestoTitulo')} text={t('presupuestoTexto')} className="md:col-span-3">
          <BudgetVisual />
        </Tile>
      </div>
    </section>
  )
}
