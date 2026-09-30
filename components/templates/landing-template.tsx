'use client'

import { useEffect, useLayoutEffect, useRef, useState, useTransition, type CSSProperties, type PointerEvent } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useLocale, useTranslations } from 'next-intl'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { SplitText } from 'gsap/SplitText'
import { ArrowRight, CheckCheck } from 'lucide-react'
import { LandingFeatures } from '@/components/organisms/landing-features'
import { LandingPace } from '@/components/organisms/landing-pace'
import { LandingStory } from '@/components/organisms/landing-story'
import { useDarkTheme } from '@/components/theme/dynamic-background'
import { DotField } from '@/components/ui/dot-field'
import { RevealText } from '@/components/ui/reveal-text'
import { RevealTitle } from '@/components/ui/reveal-title'
import { ScrambledText } from '@/components/ui/scrambled-text'
import { cn } from '@/lib/utils'

gsap.registerPlugin(SplitText)

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
    <span className="nav-logo -me-1.5 inline-flex">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/mango-logo-light.svg" alt="" aria-hidden className="size-[2.6rem] dark:hidden" />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/mango-logo-dark.svg" alt="" aria-hidden className="hidden size-[2.6rem] dark:block" />
    </span>
  )
}

// A wave of the button's own ink spreads from where it was pressed.
function ripple(event: PointerEvent<HTMLElement>) {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return
  const button = event.currentTarget
  const { left, top, width, height } = button.getBoundingClientRect()
  const size = Math.hypot(width, height) * 2
  const wave = document.createElement('span')
  wave.className = 'press-ripple'
  Object.assign(wave.style, {
    width: `${size}px`,
    height: `${size}px`,
    left: `${event.clientX - left - size / 2}px`,
    top: `${event.clientY - top - size / 2}px`,
  })
  button.append(wave)
  gsap.fromTo(wave, { scale: 0, opacity: 0.4 }, { scale: 1, opacity: 0, duration: 0.75, ease: 'power2.out', onComplete: () => wave.remove() })
}

// The demo button's glow and edge follow the pointer.
function spotlight(event: PointerEvent<HTMLElement>) {
  const { left, top } = event.currentTarget.getBoundingClientRect()
  event.currentTarget.style.setProperty('--x', `${event.clientX - left}px`)
  event.currentTarget.style.setProperty('--y', `${event.clientY - top}px`)
}

function Actions({ delay = 0, className }: { delay?: number; className?: string }) {
  const t = useTranslations('inicio')
  const root = useRef<HTMLDivElement>(null)
  const demo = t('verDemo')

  // Buttons spring up from below, one after the other, the first time they come into view.
  useLayoutEffect(() => {
    const media = gsap.matchMedia(root)
    media.add('(prefers-reduced-motion: no-preference)', () => {
      gsap.from(root.current!.children, {
        y: 28,
        scale: 0.7,
        autoAlpha: 0,
        duration: 1.1,
        ease: 'elastic.out(1, 0.65)',
        stagger: 0.12,
        delay,
        scrollTrigger: { trigger: root.current, start: 'top 95%', once: true, refreshPriority: -1 },
      })
    })
    return () => media.revert()
  }, [delay])

  return (
    <div ref={root} className={cn('flex flex-wrap items-center justify-center gap-3', className)}>
      <Link
        href="/login"
        onPointerDown={ripple}
        className="landing-cta group relative inline-flex h-12 items-center gap-2 overflow-hidden rounded-full bg-primary px-6 text-body-lg font-semibold text-primary-foreground"
      >
        {t('empezar')}
        <ArrowRight className="size-4 transition-transform duration-300 ease-spring group-hover:translate-x-1" aria-hidden />
      </Link>
      <Link
        href="/demo"
        onPointerMove={spotlight}
        className="landing-demo liquid-glass pressable inline-flex h-12 items-center rounded-full px-6 text-body-lg font-medium text-foreground"
      >
        <span className="sr-only">{demo}</span>
        <span aria-hidden className="text-roll">
          {[...demo].map((char, index) => (
            <span key={index} style={{ '--i': index } as CSSProperties}>
              {char === ' ' ? NBSP : char}
            </span>
          ))}
        </span>
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
  const header = useRef<HTMLElement>(null)

  // Each piece arrives its own way: the mango rolls in, the wordmark rises letter by letter, the
  // language switch opens from its centre, and "Entrar" slides in and catches a green shine.
  useLayoutEffect(() => {
    const media = gsap.matchMedia(header)
    media.add('(prefers-reduced-motion: no-preference)', () => {
      const wordmark = SplitText.create('.nav-wordmark', { type: 'chars', mask: 'chars', charsClass: 'nav-char' })
      gsap
        .timeline({ delay: 0.05, onComplete: () => wordmark.revert() })
        .from('.nav-logo', { scale: 0, rotate: -200, x: -24, duration: 1.1, ease: 'back.out(1.8)' })
        .from(wordmark.chars, { yPercent: 115, duration: 0.8, ease: 'expo.out', stagger: 0.045 }, 0.25)
        .from('.nav-locales', { clipPath: 'inset(0 50% 0 50% round 999px)', scale: 0.8, duration: 0.9, ease: 'expo.inOut' }, 0.2)
        .from('.nav-locales button', { opacity: 0, y: 8, filter: 'blur(4px)', duration: 0.5, ease: 'power3.out', stagger: 0.08 }, 0.6)
        .from('.nav-entrar', { x: 32, opacity: 0, filter: 'blur(10px)', duration: 0.9, ease: 'expo.out' }, 0.4)
        .fromTo('.nav-entrar .nav-shine', { backgroundPosition: '100% 0' }, { backgroundPosition: '0% 0', duration: 1.2, ease: 'power2.inOut' }, 0.95)
      return () => wordmark.revert()
    })
    return () => media.revert()
  }, [])

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
    <header ref={header} className="fixed inset-x-0 top-0 z-50">
      <div aria-hidden className={cn('glass-bar absolute inset-0 transition-opacity duration-500', scrolled ? 'opacity-100' : 'opacity-0')} />
      <nav className="relative mx-auto flex h-[3.42rem] max-w-6xl items-center justify-between px-gutter">
        <Link href="/" className="-ms-1.5 flex items-center font-display text-[19px]/[25px] font-semibold tracking-[-0.015em] text-foreground">
          <Logo />
          <span className="nav-wordmark">{t('titulo')}</span>
        </Link>
        <div className="flex items-center gap-2">
          <div role="radiogroup" aria-label={t('idioma')} className={cn('nav-locales segment-track flex rounded-full p-1', pending && 'opacity-60')}>
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
          <Link href="/login" onPointerDown={ripple} className="nav-entrar pressable relative overflow-hidden rounded-full px-3 py-2 text-body-md font-medium text-foreground">
            <span className="nav-shine">{t('entrar')}</span>
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
        <span key={index} className="-mx-[0.06em] -mb-[0.14em] inline-block overflow-hidden px-[0.06em] pb-[0.22em] align-bottom">
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
      gsap.from('.hero-word', { yPercent: 110, rotate: 4, filter: 'blur(12px)', opacity: 0, duration: 1.1, ease: 'expo.out', stagger: 0.055, delay: 0.15 })
    })
    return () => media.revert()
  }, [])

  return (
    <section ref={root} className="relative flex min-h-[calc(100svh-4rem)] flex-col items-center justify-center px-gutter pb-10 pt-28 text-center">
      <h1 className="max-w-6xl font-display text-[44px] font-extrabold leading-[0.98] tracking-[-0.045em] text-foreground sm:text-[64px] lg:text-[80px]">
        <SplitWords text={t('heroTitulo1')} />
        <SplitWords text={t('heroTitulo2')} />
      </h1>
      <RevealText text={t('heroTexto')} delay={0.55} className="mx-auto mt-7 max-w-xl text-pretty text-body-lg text-muted-foreground md:text-[18px] md:leading-7" />
      <Actions delay={0.9} className="mt-9" />
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
        <RevealTitle
          id="landing-escribe"
          text={t('escribeTitulo')}
          className="text-balance font-display text-[32px] font-bold leading-[1.05] tracking-[-0.035em] text-foreground md:text-[52px]"
        />
        <RevealText text={t('escribeTexto')} delay={0.3} className="mx-auto mt-4 max-w-xl text-pretty text-body-lg text-muted-foreground" />
      </div>
      <div aria-hidden className="landing-marquee mt-4 -mb-8 flex overflow-x-clip flex-col gap-3 py-8 md:mt-8">
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
      <RevealTitle
        text={t('cierreTitulo')}
        className="max-w-3xl text-balance font-display text-[36px] font-extrabold leading-[1.02] tracking-[-0.04em] text-foreground md:text-[64px]"
      />
      <RevealText text={t('cierreTexto')} delay={0.4} className="mx-auto mt-5 max-w-md text-pretty text-body-lg text-muted-foreground" />
      <Actions delay={0.7} className="mt-9" />
    </section>
  )
}

export function LandingTemplate({ changeLanguage }: LandingTemplateProps) {
  const t = useTranslations('inicio')
  const locale = useLocale()
  const dark = useDarkTheme()
  const dots = dark ? DOTS.dark : DOTS.light

  // Another language re-wraps every heading: the pins below them start somewhere else now.
  useEffect(() => {
    ScrollTrigger.refresh()
  }, [locale])

  return (
    <div className="landing vivid-background relative flex-1">
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
        <p>
          {t.rich('pie', {
            nombre: (chunks) => (
              <a href="https://briansittmann.dev" target="_blank" rel="noopener" className="rounded-sm transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring">
                <ScrambledText text={String(chunks)} scrambleChars="01" duration={3.8} speed={1.2} />
              </a>
            ),
          })}
        </p>
      </footer>
    </div>
  )
}
