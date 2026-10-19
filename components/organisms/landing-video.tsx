'use client'

import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useLocale, useTranslations } from 'next-intl'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { Play } from 'lucide-react'
import { RevealTitle } from '@/components/ui/reveal-title'

gsap.registerPlugin(ScrollTrigger)

// The scrub counts as arrived a little before its end, so the play button doesn't wait for the last pixel.
const READY_AT = 0.92
const DURATION = '0:44'

// The promo in the page's language (the template remounts it on a switch, back to the poster). Nothing but the poster loads until a press: the video is
// ~3.6 MB, and only the visitor who wants it pays for it, in one language.
export function LandingVideo() {
  const t = useTranslations('inicio')
  const locale = useLocale()
  const rootRef = useRef<HTMLElement>(null)
  const cardRef = useRef<HTMLDivElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const [ready, setReady] = useState(false)
  const [state, setState] = useState<'idle' | 'loading' | 'playing'>('idle')

  // The card starts small under the title and grows with the scroll, reaching its full size as
  // the title and the card sit centred on screen. No pin: the page never stops to play it.
  useLayoutEffect(() => {
    const media = gsap.matchMedia()
    media.add({ motion: '(prefers-reduced-motion: no-preference)', reduced: '(prefers-reduced-motion: reduce)' }, (context) => {
      if (context.conditions?.reduced) {
        setReady(true)
        return
      }
      gsap.fromTo(
        cardRef.current,
        { scale: 0.56, transformOrigin: '50% 0%' },
        {
          scale: 1,
          ease: 'none',
          scrollTrigger: {
            trigger: rootRef.current,
            start: 'top bottom',
            end: 'center center',
            scrub: 0.6,
            onUpdate: (self) => setReady(self.progress >= READY_AT),
          },
        },
      )
    })
    return () => media.revert()
  }, [])

  // Scrolled away, it pauses: a voice going on under the FAQ is noise.
  useEffect(() => {
    const video = videoRef.current
    if (!video) return
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) video.pause()
    }, { threshold: 0.2 })
    observer.observe(video)
    return () => observer.disconnect()
  }, [])

  function play() {
    const video = videoRef.current
    if (!video) return
    setState('loading')
    video.play().catch(() => setState('idle'))
  }

  return (
    <section ref={rootRef} aria-labelledby="landing-video" className="flex flex-col items-center px-gutter py-16 md:py-20">
      <RevealTitle
        id="landing-video"
        text={t('videoTitulo')}
        className="text-balance text-center font-display text-[32px] font-bold leading-[1.05] tracking-[-0.035em] text-foreground md:text-[52px]"
      />
      <div
        ref={cardRef}
        data-ready={ready}
        className="landing-video relative mt-8 aspect-[9/16] w-[min(100%,calc(min(68svh,700px)*0.5625))] overflow-hidden rounded-[36px] md:mt-12 md:rounded-[44px]"
      >
        <video
          ref={videoRef}
          preload="none"
          poster={`/promo/mango-${locale}.jpg`}
          playsInline
          controls={state === 'playing'}
          aria-label={t('videoDescripcion')}
          onPlaying={() => setState('playing')}
          onEnded={() => setState('idle')}
          className="size-full object-cover"
        >
          <source src={`/promo/mango-${locale}.mp4`} type="video/mp4" />
        </video>
        {state !== 'playing' ? (
          <button
            type="button"
            onClick={play}
            aria-busy={state === 'loading'}
            // The whole card plays; the pill sits low, where the poster's end card leaves room.
            className="landing-video-play group absolute inset-0 flex items-end justify-center pb-[9%] focus-visible:outline-none"
          >
            <span className="landing-video-button liquid-glass flex h-12 items-center gap-2.5 rounded-full ps-2 pe-5 text-body-lg font-semibold text-white">
              <span className="grid size-8 place-items-center rounded-full bg-primary text-primary-foreground">
                {state === 'loading' ? (
                  <span aria-hidden className="size-4 animate-spin rounded-full border-2 border-current/30 border-t-current" />
                ) : (
                  <Play className="ms-0.5 size-4 fill-current transition-transform duration-300 ease-spring group-hover:scale-110" aria-hidden />
                )}
              </span>
              {t('videoVer')}
              <span className="font-normal text-white/60 tabular-nums">{DURATION}</span>
            </span>
          </button>
        ) : null}
      </div>
    </section>
  )
}
