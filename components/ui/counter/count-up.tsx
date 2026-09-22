'use client'

import { animate, useInView, useMotionValue } from 'motion/react'
import { useCallback, useEffect, useRef } from 'react'

type CountUpProps = {
  to: number
  from?: number
  direction?: 'up' | 'down'
  delay?: number
  duration?: number
  className?: string
  startWhen?: boolean
  separator?: string
  /** Replaces the built-in formatting: money counters format per locale and currency. */
  format?: (value: number) => string
  onStart?: () => void
  onEnd?: () => void
}

export default function CountUp({
  to,
  from = 0,
  direction = 'up',
  delay = 0,
  duration = 2,
  className = '',
  startWhen = true,
  separator = '',
  format,
  onStart,
  onEnd,
}: CountUpProps) {
  const ref = useRef<HTMLSpanElement>(null)
  const motionValue = useMotionValue(direction === 'down' ? to : from)

  const isInView = useInView(ref, { once: true, margin: '0px' })

  const getDecimalPlaces = (num: number) => {
    const str = num.toString()

    if (str.includes('.')) {
      const decimals = str.split('.')[1]

      if (parseInt(decimals) !== 0) {
        return decimals.length
      }
    }

    return 0
  }

  const maxDecimals = Math.max(getDecimalPlaces(from), getDecimalPlaces(to))

  const formatValue = useCallback(
    (latest: number) => {
      if (format) return format(latest)

      const hasDecimals = maxDecimals > 0

      const options = {
        useGrouping: !!separator,
        minimumFractionDigits: hasDecimals ? maxDecimals : 0,
        maximumFractionDigits: hasDecimals ? maxDecimals : 0,
      }

      const formattedNumber = Intl.NumberFormat('en-US', options).format(latest)

      return separator ? formattedNumber.replace(/,/g, separator) : formattedNumber
    },
    [maxDecimals, separator, format],
  )

  useEffect(() => {
    if (ref.current) {
      ref.current.textContent = formatValue(direction === 'down' ? to : from)
    }
  }, [from, to, direction, formatValue])

  useEffect(() => {
    if (isInView && startWhen) {
      if (typeof onStart === 'function') onStart()

      // A tween, not a spring: the spring's tail kept the last digits crawling long after `duration`.
      const controls = animate(motionValue, direction === 'down' ? from : to, {
        duration,
        delay,
        ease: [0.16, 1, 0.3, 1],
      })

      const durationTimeoutId = setTimeout(
        () => {
          if (typeof onEnd === 'function') onEnd()
        },
        delay * 1000 + duration * 1000,
      )

      return () => {
        controls.stop()
        clearTimeout(durationTimeoutId)
      }
    }
  }, [isInView, startWhen, motionValue, direction, from, to, delay, onStart, onEnd, duration])

  useEffect(() => {
    const unsubscribe = motionValue.on('change', (latest) => {
      if (ref.current) {
        ref.current.textContent = formatValue(latest)
      }
    })

    return () => unsubscribe()
  }, [motionValue, formatValue])

  return <span className={className} ref={ref} />
}
