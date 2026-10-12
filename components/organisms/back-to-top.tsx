'use client'

import { ChevronUp } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useEffect, useState } from 'react'

// The landing's scroll hint, turned around: once the desktop page reaches its end, a glass button
// in the corner keeps an arrow rising, and a press takes the page back to the top.
export function BackToTop({ hidden, onPress }: { hidden: boolean; onPress: () => void }) {
  const t = useTranslations('escritorio')
  const [atEnd, setAtEnd] = useState(false)

  useEffect(() => {
    const update = () =>
      setAtEnd(
        window.scrollY > window.innerHeight * 0.5 &&
          window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 160,
      )
    update()
    window.addEventListener('scroll', update, { passive: true })
    window.addEventListener('resize', update)
    // Opening or closing cards changes the page's height without a scroll.
    const observer = new ResizeObserver(update)
    observer.observe(document.body)
    return () => {
      window.removeEventListener('scroll', update)
      window.removeEventListener('resize', update)
      observer.disconnect()
    }
  }, [])

  const visible = atEnd && !hidden
  return (
    <button
      type="button"
      aria-label={t('volverArriba')}
      aria-hidden={!visible}
      tabIndex={visible ? 0 : -1}
      data-visible={visible}
      data-back-to-top=""
      onClick={onPress}
      className="back-to-top liquid-glass pressable fixed end-8 bottom-8 z-40 grid size-12 place-items-center overflow-hidden rounded-full text-brand"
    >
      <ChevronUp className="back-to-top-arrow size-5" strokeWidth={2.4} aria-hidden />
    </button>
  )
}
