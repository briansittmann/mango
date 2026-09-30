'use client'

import { useEffect, useLayoutEffect, useRef, useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useLocale, useTranslations } from 'next-intl'
import { gsap } from 'gsap'
import { ArrowRight, CheckCheck } from 'lucide-react'
import { LandingFeatures } from '@/components/organisms/landing-features'
import { LandingPace } from '@/components/organisms/landing-pace'
import { LandingStory } from '@/components/organisms/landing-story'
import { useDarkTheme } from '@/components/theme/dynamic-background'
import { DotField } from '@/components/ui/dot-field'
import { cn } from '@/lib/utils'

type LandingTemplateProps = {
  changeLanguage: (locale: 'es' | 'en') => Promise<void>
}

const NBSP = '\u00A0'

const LOCALES = [
  { value: 'es', label: 'ES' },
  { value: 'en', label: 'EN' },
] as const

// Dots in the foreground colour drifting into the brand's, so the field reads as texture, not green.
const DOTS = {
  dark: { from: 'rgba(242, 245, 242, 0.22)', to: 'rgba(132, 204, 22, 0.32)', glow: 'rgba(132, 204, 22, 0.16)' },
  light: { from: 'rgba(13, 17, 14, 0.2)', to: 'rgba(20, 144, 82, 0.3)', glow: 'rgba(20, 144, 82, 0.1)' },
}

function Logo() {
  return (
    <>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/mango-logo-light.svg" alt="" aria-hidden className="size-9 dark:hidden" />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/mango-logo-dark.svg" alt="" aria-hidden className="hidden size-9 dark:block" />
    </>
  )
}

function Actions({ className }: { className?: string }) {
  const t = useTranslations('inicio')
  return (
    <div className={cn('flex flex-wrap items-center justify-center gap-3', className)}>
      <Link
        href="/login"
        className="landing-cta group inline-flex h-12 items-center gap-2 rounded-full bg-foreground px-6 text-body-lg font-semibold text-background"
      >
        {t('empezar')}
        <ArrowRight className="size-4 transition-transform duration-300 ease-spring group-hover:translate-x-1" aria-hidden />
      </Link>
      <Link href="/demo" className="liquid-glass pressable inline-flex h-12 items-center rounded-full px-6 text-body-lg font-medium text-foreground">
        {t('verDemo')}
      </Link>
    </div>
  )
}

function Nav({ changeLanguage }: LandingTemplateProps) {
  const t = useTranslations('inicio')
  const locale = useLocale()
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  function pick(next: 'es' | 'en') {
    if (next === locale) return
    startTransition(async () => {
      await changeLanguage(next)
      router.refresh()
    })
  }

  return (
    <header className="fixed inset-x-0 top-0 z-50">
      <div aria-hidden className={cn('glass-bar absolute inset-0 transition-opacity duration-500', scrolled ? 'opacity-100' : 'opacity-0')} />
      <nav className="relative mx-auto flex h-16 max-w-6xl items-center justify-between px-gutter">
        <Link href="/" className="landing-rise flex items-center gap-2 font-display text-headline-md text-foreground">
          <Logo />
          {t('titulo')}
        </Link>
        <div className="landing-rise flex items-center gap-2 [animation-delay:80ms]">
          <div role="radiogroup" aria-label={t('idioma')} className={cn('segment-track flex rounded-full p-1', pending && 'opacity-60')}>
            {LOCALES.map(({ value, label }) => (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={locale === value}
                onClick={() => pick(value)}
                className={cn(
                  'rounded-full px-2.5 py-1 text-label-ui transition-colors',
                  locale === value ? 'segment-thumb text-foreground' : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {label}
              </button>
            ))}
          </div>
          <Link href="/login" className="pressable rounded-full px-3 py-2 text-body-md font-medium text-foreground">
            {t('entrar')}
          </Link>
        </div>
      </nav>
    </header>
  )
}

function SplitWords({ text, className }: { text: string; className?: string }) {
  return (
    <span className={cn('block', className)}>
      {text.split(' ').map((word, index) => (
        <span key={index} className="inline-block overflow-hidden pb-[0.08em] align-bottom">
          <span className="hero-word inline-block">{word}</span>
          {NBSP}
        </span>
      ))}
    </span>
  )
}

function Hero() {
  const t = useTranslations('inicio')
  const root = useRef<HTMLElement>(null)

  useLayoutEffect(() => {
    const media = gsap.matchMedia(root)
    media.add('(prefers-reduced-motion: no-preference)', () => {
      gsap
        .timeline({ delay: 0.15 })
        .from('.hero-word', { yPercent: 110, rotate: 4, filter: 'blur(12px)', opacity: 0, duration: 1.1, ease: 'expo.out', stagger: 0.055 })
        .from('.hero-fade', { y: 24, opacity: 0, filter: 'blur(8px)', duration: 0.9, ease: 'power3.out', stagger: 0.1 }, '-=0.7')
    })
    return () => media.revert()
  }, [])

  return (
    <section ref={root} className="relative flex min-h-[calc(100svh-4rem)] flex-col items-center justify-center px-gutter pb-10 pt-28 text-center">
      <h1 className="max-w-6xl font-display text-[44px] font-extrabold leading-[0.98] tracking-[-0.045em] text-foreground sm:text-[64px] lg:text-[80px]">
        <SplitWords text={t('heroTitulo1')} />
        <SplitWords text={t('heroTitulo2')} className="text-muted-foreground" />
      </h1>
      <p className="hero-fade mx-auto mt-7 max-w-xl text-pretty text-body-lg text-muted-foreground md:text-[18px] md:leading-7">{t('heroTexto')}</p>
      <Actions className="hero-fade mt-9" />
    </section>
  )
}

function Examples() {
  const t = useTranslations('inicio')
  const examples = t.raw('ejemplos') as string[]
  const rows = [examples.slice(0, 6), examples.slice(6)]
  return (
    <section aria-labelledby="landing-escribe" className="py-24 md:py-32">
      <div className="mx-auto max-w-2xl px-gutter text-center">
        <h2 id="landing-escribe" className="text-balance font-display text-[32px] font-bold leading-[1.05] tracking-[-0.035em] text-foreground md:text-[52px]">
          {t('escribeTitulo')}
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-pretty text-body-lg text-muted-foreground">{t('escribeTexto')}</p>
      </div>
      <div aria-hidden className="landing-marquee mt-12 flex flex-col gap-3 md:mt-16">
        {rows.map((row, index) => (
          <div key={index} className="flex w-max gap-3" data-direction={index % 2 === 0 ? 'left' : 'right'}>
            {[...row, ...row, ...row, ...row].map((example, position) => (
              <span key={position} className="liquid-glass flex items-center gap-2 rounded-full px-5 py-3 text-body-lg font-medium text-foreground">
                {example}
                <CheckCheck className="size-4 text-brand-ink" />
              </span>
            ))}
          </div>
        ))}
      </div>
    </section>
  )
}

function Closing() {
  const t = useTranslations('inicio')
  return (
    <section className="flex flex-col items-center px-gutter py-28 text-center md:py-40">
      <h2 className="max-w-3xl text-balance font-display text-[36px] font-extrabold leading-[1.02] tracking-[-0.04em] text-foreground md:text-[64px]">
        {t('cierreTitulo')}
      </h2>
      <p className="mx-auto mt-5 max-w-md text-pretty text-body-lg text-muted-foreground">{t('cierreTexto')}</p>
      <Actions className="mt-9" />
    </section>
  )
}

export function LandingTemplate({ changeLanguage }: LandingTemplateProps) {
  const t = useTranslations('inicio')
  const dark = useDarkTheme()
  const dots = dark ? DOTS.dark : DOTS.light

  return (
    <div className="landing relative flex-1">
      <DotField
        gradientFrom={dots.from}
        gradientTo={dots.to}
        glowColor={dots.glow}
        className="landing-dots pointer-events-none fixed inset-x-0 top-0 -z-10 h-lvh"
      />
      <Nav changeLanguage={changeLanguage} />
      <main>
        <Hero />
        <LandingStory />
        <Examples />
        <LandingPace />
        <LandingFeatures />
        <Closing />
      </main>
      <footer className="mx-auto flex max-w-6xl flex-col items-center gap-2 px-gutter pb-10 text-center text-body-sm text-muted-foreground">
        <p>{t('descripcion')}</p>
        <p>{t('pie')}</p>
      </footer>
    </div>
  )
}
