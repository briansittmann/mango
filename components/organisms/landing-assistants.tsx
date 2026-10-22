'use client'

import { Fragment, useEffect, useId, useLayoutEffect, useRef, useState, type KeyboardEvent } from 'react'
import { useTranslations } from 'next-intl'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { ArrowRight, ArrowUp, Check, LoaderCircle } from 'lucide-react'
import { ChatGptLogo, ClaudeLogo } from '@/components/atoms/assistant-logos'
import { Money } from '@/components/atoms/money'
import { RevealText } from '@/components/ui/reveal-text'
import { RevealTitle } from '@/components/ui/reveal-title'
import { cn } from '@/lib/utils'

gsap.registerPlugin(ScrollTrigger)

const CURRENCY = 'EUR'
// Once an answer has landed it stays this long before the next conversation starts.
const HOLD_S = 4.5

type Assistant = 'claude' | 'chatgpt'
type Copy = { pregunta: string; respuesta: string; filas: { nombre: string; detalle?: string }[]; cierre: string }
type Conversation = { assistant: Assistant; tools: string[]; card: 'breakdown' | 'logged' | 'compare'; amounts: number[]; colors: string[] }

const NAMES: Record<Assistant, string> = { claude: 'Claude', chatgpt: 'ChatGPT' }

// Who answers, which of the MCP server's tools it calls and the figures of its card; the words live
// in `inicio.asistentesConversaciones`. Figures follow `/demo`: 783,20 € free after the story's
// three expenses, December projected at 870 €, the gym at 40 €.
const CONVERSATIONS: Conversation[] = [
  {
    assistant: 'claude',
    tools: ['get_summary'],
    card: 'breakdown',
    amounts: [820, 310, 130],
    colors: ['var(--cat-azul_apagado)', 'var(--cat-naranja_calido)', 'var(--cat-violeta_metalico)'],
  },
  {
    assistant: 'chatgpt',
    tools: ['add_movement', 'add_movement'],
    card: 'logged',
    amounts: [42, 11.8],
    colors: ['var(--cat-violeta_metalico)', 'var(--cat-celeste)'],
  },
  { assistant: 'claude', tools: ['list_fixed_charges', 'get_summary'], card: 'compare', amounts: [870, 910], colors: [] },
]

function Mark({ assistant, className }: { assistant: Assistant; className?: string }) {
  return assistant === 'claude' ? <ClaudeLogo className={className} /> : <ChatGptLogo className={className} />
}

function MangoMark({ className }: { className?: string }) {
  return (
    <>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/mango-logo-light.svg" alt="" aria-hidden className={cn(className, 'dark:hidden')} />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/mango-logo-dark.svg" alt="" aria-hidden className={cn(className, 'hidden dark:block')} />
    </>
  )
}

// Each word its own box, so the answer can arrive the way an assistant streams it.
function Words({ text }: { text: string }) {
  return text.split(' ').map((word, index) => (
    <Fragment key={index}>
      <span className="assistants-word inline-block">{word}</span>{' '}
    </Fragment>
  ))
}

// Mango between the two assistants. The wire to whichever is answering lights up and a spark runs
// out along it.
function Lockup({ active }: { active: Assistant }) {
  const t = useTranslations('inicio')
  return (
    <div role="img" aria-label={t('asistentesConexion')} className="assistants-lockup flex items-center">
      {/* Wrapped: the entrance tweens the wrapper, the lit state transitions the circle. */}
      <span className="grid">
        <span data-lit={active === 'claude'} className="assistants-peer liquid-glass grid size-14 place-items-center rounded-full">
          <ClaudeLogo className="size-7" />
        </span>
      </span>
      <span aria-hidden data-side="left" data-lit={active === 'claude'} className="assistants-wire" />
      <span className="liquid-glass grid size-[4.5rem] place-items-center rounded-full">
        <MangoMark className="size-11" />
      </span>
      <span aria-hidden data-side="right" data-lit={active === 'chatgpt'} className="assistants-wire" />
      <span className="grid">
        <span data-lit={active === 'chatgpt'} className="assistants-peer liquid-glass grid size-14 place-items-center rounded-full text-foreground">
          <ChatGptLogo className="size-7" />
        </span>
      </span>
    </div>
  )
}

function Card({ conversation, rows }: { conversation: Conversation; rows: Copy['filas'] }) {
  const { card, amounts, colors } = conversation
  if (card === 'breakdown') {
    const max = Math.max(...amounts)
    return (
      <ul data-card className="flex flex-col gap-3 rounded-2xl border border-border/70 bg-background/30 p-4">
        {rows.map((row, index) => (
          <li key={row.nombre} data-row className="flex flex-col gap-1.5">
            <span className="flex items-baseline justify-between gap-3 text-body-md">
              <span className="flex items-center gap-2 text-foreground">
                <span className="size-2 rounded-full" style={{ backgroundColor: colors[index] }} />
                {row.nombre}
              </span>
              <Money amount={amounts[index]} currency={CURRENCY} className="font-medium text-foreground" />
            </span>
            <span
              data-bar
              className="block h-1.5 origin-left rounded-full"
              style={{ width: `${(amounts[index] / max) * 100}%`, backgroundColor: colors[index] }}
            />
          </li>
        ))}
      </ul>
    )
  }
  if (card === 'logged') {
    return (
      <ul data-card className="flex flex-col divide-y divide-border/60 rounded-2xl border border-border/70 bg-background/30 px-4">
        {rows.map((row, index) => (
          <li key={row.nombre} data-row className="flex items-center gap-3 py-3">
            <span
              className="grid size-8 shrink-0 place-items-center rounded-full"
              style={{ backgroundColor: `color-mix(in oklab, ${colors[index]} 18%, transparent)`, boxShadow: `inset 0 0 0 1.5px ${colors[index]}` }}
            >
              <Check className="size-4 text-foreground" strokeWidth={2.6} aria-hidden />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-body-md font-medium text-foreground">{row.nombre}</span>
              <span className="block text-body-sm text-muted-foreground">{row.detalle}</span>
            </span>
            <Money amount={amounts[index]} currency={CURRENCY} className="text-body-md font-medium text-foreground" />
          </li>
        ))}
      </ul>
    )
  }
  return (
    <div data-card className="flex items-center gap-3 rounded-2xl border border-border/70 bg-background/30 p-4">
      <div data-row className="min-w-0 flex-1">
        <p className="text-body-sm text-muted-foreground">{rows[0].nombre}</p>
        <Money amount={amounts[0]} currency={CURRENCY} className="font-display text-headline-md text-muted-foreground" />
      </div>
      <ArrowRight data-row className="size-5 shrink-0 text-muted-foreground rtl:rotate-180" aria-hidden />
      <div data-row className="min-w-0 flex-1">
        <p className="text-body-sm text-muted-foreground">{rows[1].nombre}</p>
        <span className="flex flex-wrap items-baseline gap-x-2">
          <Money amount={amounts[1]} currency={CURRENCY} className="font-display text-headline-md text-brand-ink" />
          <Money amount={amounts[1] - amounts[0]} currency={CURRENCY} signDisplay="always" className="text-body-sm font-medium text-brand-ink" />
        </span>
      </div>
    </div>
  )
}

function Panel({ id, tabId, active, conversation, copy }: { id: string; tabId: string; active: boolean; conversation: Conversation; copy: Copy }) {
  const t = useTranslations('inicio')
  return (
    // Every panel takes the same cell, so the window is as tall as the longest conversation and the
    // page never moves when one replaces another.
    <div
      role="tabpanel"
      id={id}
      aria-labelledby={tabId}
      data-active={active}
      className={cn('col-start-1 row-start-1 flex flex-col gap-4', !active && 'invisible')}
    >
      <div className="flex justify-end">
        <p data-step="question" className="max-w-[85%] rounded-[20px] rounded-br-md bg-foreground/[0.08] px-4 py-2.5 text-body-md text-foreground">
          {copy.pregunta}
        </p>
      </div>
      <ul className="flex flex-col items-start gap-1.5">
        {conversation.tools.map((tool, index) => (
          <li
            key={index}
            data-step="tool"
            className="flex items-center gap-2 rounded-full border border-border/70 bg-background/30 py-1 pe-2.5 ps-1.5 text-body-sm"
          >
            <MangoMark className="size-5" />
            <span className="sr-only">{t('asistentesHerramienta', { herramienta: tool })}</span>
            <span aria-hidden className="font-medium text-foreground">
              {t('titulo')}
            </span>
            <code aria-hidden className="font-mono text-[12px] text-muted-foreground">
              {tool}
            </code>
            <span aria-hidden className="relative grid size-4 place-items-center">
              <LoaderCircle data-spin className="absolute size-4 text-muted-foreground opacity-0 motion-safe:animate-spin" />
              <Check data-done className="absolute size-4 text-brand-ink" strokeWidth={3} />
            </span>
          </li>
        ))}
      </ul>
      <div className="flex gap-3">
        {/* 28px against the answer's 20px first line: 4px up puts both centres on one line. */}
        <span data-step="avatar" className="-mt-1 grid size-7 shrink-0 place-items-center rounded-full bg-foreground/[0.07] text-foreground">
          <Mark assistant={conversation.assistant} className="size-4" />
        </span>
        <div className="flex min-w-0 flex-1 flex-col gap-3 text-body-md text-foreground">
          <p data-words="answer">
            <Words text={copy.respuesta} />
          </p>
          <Card conversation={conversation} rows={copy.filas} />
          <p data-words="closing">
            <Words text={copy.cierre} />
          </p>
        </div>
      </div>
    </div>
  )
}

export function LandingAssistants() {
  const t = useTranslations('inicio')
  const copies = t.raw('asistentesConversaciones') as Copy[]
  const baseId = useId().replace(/:/g, '')
  const root = useRef<HTMLElement>(null)
  const list = useRef<HTMLDivElement>(null)
  const highlight = useRef<HTMLSpanElement>(null)
  const body = useRef<HTMLDivElement>(null)
  const draft = useRef<HTMLSpanElement>(null)
  const placeholder = useRef<HTMLSpanElement>(null)
  const caret = useRef<HTMLSpanElement>(null)
  const send = useRef<HTMLSpanElement>(null)
  const timeline = useRef<gsap.core.Timeline | null>(null)
  const visible = useRef(false)
  const [active, setActive] = useState(0)
  // The conversations play one after another until someone picks one.
  const [autoplay, setAutoplay] = useState(true)
  const assistant = CONVERSATIONS[active].assistant
  const tabId = (index: number) => `${baseId}-tab-${index}`
  const panelId = (index: number) => `${baseId}-panel-${index}`

  function pick(index: number) {
    setAutoplay(false)
    if (index === active) timeline.current?.restart()
    setActive(index)
  }

  function onTabKey(event: KeyboardEvent<HTMLButtonElement>) {
    const last = CONVERSATIONS.length - 1
    const next = { ArrowRight: active + 1, ArrowDown: active + 1, ArrowLeft: active - 1, ArrowUp: active - 1, Home: 0, End: last }[event.key]
    if (next === undefined) return
    event.preventDefault()
    const index = next < 0 ? last : next > last ? 0 : next
    pick(index)
    document.getElementById(tabId(index))?.focus()
  }

  // The window rises in, the logos pop into their places and the questions slide in behind them,
  // the first time the section comes into view.
  useLayoutEffect(() => {
    const media = gsap.matchMedia(root)
    media.add('(prefers-reduced-motion: no-preference)', () => {
      const scrollTrigger = { trigger: root.current, start: 'top 70%', once: true, refreshPriority: -1 }
      gsap.from('.assistants-lockup > *', { scale: 0, opacity: 0, duration: 0.9, ease: 'back.out(1.8)', stagger: 0.07, scrollTrigger })
      gsap.from('.assistants-window', { y: 64, opacity: 0, filter: 'blur(12px)', duration: 1.1, ease: 'expo.out', scrollTrigger })
      gsap.from('.assistants-tab', { y: 18, opacity: 0, filter: 'blur(6px)', duration: 0.7, ease: 'power3.out', stagger: 0.08, delay: 0.35, scrollTrigger })
    })
    return () => media.revert()
  }, [])

  // The glass behind the selected question travels to it; on a phone the strip scrolls it into view.
  useLayoutEffect(() => {
    const strip = list.current
    const glass = highlight.current
    if (!strip || !glass) return
    let first = true
    const place = () => {
      const tab = strip.querySelector<HTMLElement>(`[aria-selected="true"]`)
      if (!tab) return
      const box = { x: tab.offsetLeft, y: tab.offsetTop, width: tab.offsetWidth, height: tab.offsetHeight, opacity: 1 }
      const still = first || matchMedia('(prefers-reduced-motion: reduce)').matches
      if (still) gsap.set(glass, box)
      else gsap.to(glass, { ...box, duration: 0.6, ease: 'expo.out', overwrite: true })
      first = false
    }
    place()
    const tab = strip.querySelector<HTMLElement>('[aria-selected="true"]')
    if (tab && strip.scrollWidth > strip.clientWidth) {
      strip.scrollTo({ left: tab.offsetLeft - (strip.clientWidth - tab.offsetWidth) / 2, behavior: 'smooth' })
    }
    const observer = new ResizeObserver(() => {
      first = true
      place()
    })
    observer.observe(strip)
    return () => observer.disconnect()
  }, [active])

  // The conversation plays out: the question types into the composer and is sent, Mango's tools
  // run, and the answer streams in with its card. The question's progress line fills meanwhile, and
  // at its end the next conversation starts.
  useLayoutEffect(() => {
    const panel = body.current?.querySelector<HTMLElement>('[data-active="true"]')
    if (!panel) return
    const question = copies[active].pregunta
    const media = gsap.matchMedia()
    media.add('(prefers-reduced-motion: no-preference)', () => {
      const q = gsap.utils.selector(panel)
      const typed = { chars: 0 }
      const typing = gsap.utils.clamp(0.7, 1.5, question.length * 0.024)
      const tl = gsap.timeline({
        paused: true,
        onComplete: () => {
          if (autoplay) setActive((index) => (index + 1) % CONVERSATIONS.length)
        },
      })
      tl.set(placeholder.current, { opacity: 0 }, 0.5)
        .set(caret.current, { opacity: 1 }, 0.5)
        .to(
          typed,
          {
            chars: question.length,
            duration: typing,
            ease: 'none',
            onUpdate: () => {
              if (draft.current) draft.current.textContent = question.slice(0, Math.round(typed.chars))
            },
          },
          0.5,
        )
        .to(send.current, { scale: 0.8, duration: 0.12, ease: 'power2.in' }, '+=0.2')
        .call(() => {
          if (draft.current) draft.current.textContent = ''
        })
        .set(placeholder.current, { opacity: 1 })
        .set(caret.current, { opacity: 0 })
        .to(send.current, { scale: 1, duration: 0.6, ease: 'elastic.out(1, 0.5)' })
        .fromTo(
          q('[data-step="question"]'),
          { opacity: 0, y: 28, scale: 0.9, filter: 'blur(8px)', transformOrigin: '100% 100%' },
          { opacity: 1, y: 0, scale: 1, filter: 'blur(0px)', duration: 0.6, ease: 'back.out(1.6)' },
          '<',
        )
      q('[data-step="tool"]').forEach((tool, index) => {
        tl.fromTo(tool, { opacity: 0, y: 10, filter: 'blur(6px)' }, { opacity: 1, y: 0, filter: 'blur(0px)', duration: 0.4, ease: 'power3.out' }, index ? '+=0.05' : '+=0.35')
          .fromTo(tool.querySelector('[data-spin]'), { opacity: 1 }, { opacity: 0, duration: 0.2 }, '+=0.7')
          .fromTo(tool.querySelector('[data-done]'), { opacity: 0, scale: 0 }, { opacity: 1, scale: 1, duration: 0.45, ease: 'back.out(2.4)' }, '<')
      })
      tl.fromTo(q('[data-step="avatar"]'), { opacity: 0, scale: 0.4, rotate: -40 }, { opacity: 1, scale: 1, rotate: 0, duration: 0.5, ease: 'back.out(2)' }, '+=0.1')
        .fromTo(
          q('[data-words="answer"] .assistants-word'),
          { opacity: 0, filter: 'blur(4px)' },
          { opacity: 1, filter: 'blur(0px)', duration: 0.35, ease: 'power2.out', stagger: 0.04 },
          '-=0.25',
        )
        .fromTo(q('[data-card]'), { opacity: 0, y: 14, scale: 0.97 }, { opacity: 1, y: 0, scale: 1, duration: 0.5, ease: 'power3.out' }, '-=0.1')
        .fromTo(q('[data-row]'), { opacity: 0, y: 8 }, { opacity: 1, y: 0, duration: 0.45, ease: 'power3.out', stagger: 0.12 }, '-=0.3')
      if (CONVERSATIONS[active].card === 'breakdown') {
        tl.fromTo(q('[data-bar]'), { scaleX: 0 }, { scaleX: 1, duration: 0.9, ease: 'expo.out', stagger: 0.12 }, '<')
      }
      tl.fromTo(
        q('[data-words="closing"] .assistants-word'),
        { opacity: 0, filter: 'blur(4px)' },
        { opacity: 1, filter: 'blur(0px)', duration: 0.35, ease: 'power2.out', stagger: 0.04 },
        '-=0.2',
      ).to({}, { duration: HOLD_S })
      const progress = list.current?.querySelector(`#${tabId(active)} [data-progress]`)
      if (autoplay && progress) tl.fromTo(progress, { scaleX: 0 }, { scaleX: 1, duration: tl.duration(), ease: 'none' }, 0)

      timeline.current = tl
      if (visible.current) tl.play()
      return () => {
        tl.kill()
        timeline.current = null
        if (draft.current) draft.current.textContent = ''
      }
    })
    return () => media.revert()
    // `t` changes with the language, which re-renders the panels this reads.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, autoplay, t])

  // Plays only while the window is on screen, and picks up where it stopped.
  useEffect(() => {
    const window = body.current?.closest('.assistants-window')
    if (!window) return
    const observer = new IntersectionObserver(
      ([entry]) => {
        visible.current = entry.isIntersecting
        if (entry.isIntersecting) timeline.current?.play()
        else timeline.current?.pause()
      },
      { threshold: 0.45 },
    )
    observer.observe(window)
    return () => observer.disconnect()
  }, [])

  return (
    <section ref={root} aria-labelledby="landing-asistentes" className="mx-auto grid w-full max-w-6xl grid-cols-[minmax(0,1fr)] items-center gap-12 px-gutter py-24 md:py-32 lg:grid-cols-12">
      <div className="flex flex-col items-center text-center lg:col-span-5 lg:items-start lg:text-start">
        <Lockup active={assistant} />
        <RevealTitle
          id="landing-asistentes"
          text={t('asistentesTitulo')}
          className="mt-9 max-w-xl text-balance font-display text-[32px] font-bold leading-[1.05] tracking-[-0.035em] text-foreground md:text-[52px] lg:text-[44px]"
        />
        <RevealText text={t('asistentesTexto')} delay={0.3} className="mt-4 max-w-xl text-pretty text-body-lg text-muted-foreground" />
        <div
          ref={list}
          role="tablist"
          aria-label={t('asistentesEjemplos')}
          className="assistants-tabs relative -mx-gutter mt-8 flex snap-x snap-mandatory gap-2 self-stretch overflow-x-auto px-gutter pb-1 lg:mx-0 lg:flex-col lg:overflow-visible lg:px-0"
        >
          <span ref={highlight} aria-hidden className="liquid-glass pointer-events-none absolute left-0 top-0 rounded-2xl opacity-0" />
          {CONVERSATIONS.map((conversation, index) => (
            <button
              key={index}
              type="button"
              role="tab"
              id={tabId(index)}
              aria-selected={index === active}
              aria-controls={panelId(index)}
              aria-label={`${NAMES[conversation.assistant]}: ${copies[index].pregunta}`}
              tabIndex={index === active ? 0 : -1}
              onClick={() => pick(index)}
              onKeyDown={onTabKey}
              className={cn(
                'assistants-tab relative flex w-[min(78vw,20rem)] shrink-0 snap-center items-start gap-3 overflow-hidden rounded-2xl px-4 py-3.5 text-start transition-colors duration-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring lg:w-full',
                index === active ? 'text-foreground' : 'text-muted-foreground hover:text-foreground',
              )}
            >
              <span className={cn('mt-0.5 shrink-0 transition-opacity duration-300', index === active ? 'opacity-100' : 'opacity-60')}>
                <Mark assistant={conversation.assistant} className="size-5" />
              </span>
              <span className="text-body-md font-medium">
                {copies[index].pregunta}
              </span>
              <span aria-hidden data-progress className="absolute inset-x-4 bottom-0 h-0.5 origin-left scale-x-0 rounded-full bg-brand" />
            </button>
          ))}
        </div>
        <p className="mt-6 max-w-md text-pretty text-body-sm text-muted-foreground">{t('asistentesNota')}</p>
      </div>

      <div className="lg:col-span-7">
        <div className="assistants-window liquid-glass flex flex-col overflow-hidden rounded-[28px]">
          <div className="flex items-center justify-between gap-3 border-b border-border/60 px-5 py-3.5">
            <span className="flex items-center gap-2.5 font-display text-body-lg font-semibold text-foreground">
              <span key={assistant} className="assistants-swap grid size-8 place-items-center rounded-full bg-foreground/[0.07]">
                <Mark assistant={assistant} className="size-[18px]" />
              </span>
              <span key={`${assistant}-name`} className="assistants-swap-text">
                {NAMES[assistant]}
              </span>
            </span>
            <span className="flex items-center gap-2 rounded-full border border-brand/30 bg-brand/10 px-2.5 py-1 text-label-ui text-brand-ink">
              <span aria-hidden className="assistants-live size-1.5 rounded-full bg-brand" />
              {t('asistentesConectado')}
            </span>
          </div>
          <div ref={body} className="grid px-5 py-6">
            {CONVERSATIONS.map((conversation, index) => (
              <Panel key={index} id={panelId(index)} tabId={tabId(index)} active={index === active} conversation={conversation} copy={copies[index]} />
            ))}
          </div>
          <div aria-hidden className="px-4 pb-4">
            <div className="flex items-center gap-2 rounded-full border border-border/70 bg-background/40 py-1.5 pe-1.5 ps-4">
              <span className="relative min-w-0 flex-1 truncate text-body-md">
                <span ref={placeholder} className="text-muted-foreground">
                  {t('asistentesEscribir')}
                </span>
                <span className="absolute inset-0 flex items-center overflow-hidden whitespace-nowrap text-foreground">
                  <span ref={draft} />
                  <span ref={caret} className="opacity-0">
                    <span className="assistants-caret ms-px inline-block h-[1.1em] w-[1.5px] translate-y-[0.15em] bg-brand" />
                  </span>
                </span>
              </span>
              <span ref={send} className="grid size-8 shrink-0 place-items-center rounded-full bg-foreground text-background">
                <ArrowUp className="size-4" strokeWidth={2.5} />
              </span>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
