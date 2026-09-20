'use client'

// React Bits — Counter (https://reactbits.dev/c/components/counter), vendored.
//
// Kept as close to the published source as possible. The deltas, all of them needed by
// `AnimatedAmount`:
//   - a place may be any literal string, not only `'.'`, so a locale's group and decimal
//     separators can both appear in the same counter;
//   - `hideLeadingZeros` drops the columns above the current magnitude instead of painting them
//     as zeros;
//   - `from` seeds the springs somewhere other than the current value, which is what makes the
//     counter animate on mount instead of appearing already settled;
//   - the separator branch lives in its own component, so the digit branch's hooks are never
//     skipped.

import { motion, useSpring, useTransform, type MotionValue } from 'motion/react'
import type React from 'react'
import { useEffect } from 'react'

import './counter.css'

/** A digit column, given as the power of ten it shows, or a literal glyph such as `'.'` or `','`. */
export type PlaceValue = number | string

interface NumberProps {
  mv: MotionValue<number>
  number: number
  height: number
}

function Number({ mv, number, height }: NumberProps) {
  const y = useTransform(mv, (latest) => {
    const placeValue = latest % 10
    const offset = (10 + number - placeValue) % 10
    let memo = offset * height
    if (offset > 5) {
      memo -= 10 * height
    }
    return memo
  })

  return (
    <motion.span className="counter-number" style={{ y }}>
      {number}
    </motion.span>
  )
}

function normalizeNearInteger(num: number): number {
  const nearest = Math.round(num)
  const tolerance = 1e-9 * Math.max(1, Math.abs(num))
  return Math.abs(num - nearest) < tolerance ? nearest : num
}

function getValueRoundedToPlace(value: number, place: number): number {
  const scaled = value / place
  return Math.floor(normalizeNearInteger(scaled))
}

interface SeparatorProps {
  glyph: string
  height: number
  hidden?: boolean
  style?: React.CSSProperties
}

function Separator({ glyph, height, hidden, style }: SeparatorProps) {
  return (
    <span className={`counter-digit counter-separator${hidden ? ' counter-hidden' : ''}`} style={{ height, ...style }}>
      {glyph}
    </span>
  )
}

interface DigitProps {
  place: number
  value: number
  from: number
  height: number
  hidden?: boolean
  digitStyle?: React.CSSProperties
}

function Digit({ place, value, from, height, hidden, digitStyle }: DigitProps) {
  const valueRoundedToPlace = getValueRoundedToPlace(value, place)
  const animatedValue = useSpring(getValueRoundedToPlace(from, place))

  useEffect(() => {
    animatedValue.set(valueRoundedToPlace)
  }, [animatedValue, valueRoundedToPlace])

  return (
    <span className={`counter-digit${hidden ? ' counter-hidden' : ''}`} style={{ height, ...digitStyle }}>
      {Array.from({ length: 10 }, (_, i) => (
        <Number key={i} mv={animatedValue} number={i} height={height} />
      ))}
    </span>
  )
}

interface CounterProps {
  value: number
  /** Where the springs start on mount. Defaults to `value`, which settles with no animation. */
  from?: number
  fontSize?: number
  padding?: number
  /**
   * An array of place values that determines which digit positions
   * should be displayed. For decimal places, use "." to represent
   * the decimal point. Leave this prop empty to enable automatic
   * detection based on the current value.
   */
  places?: PlaceValue[]
  /** Drop the columns the current value does not reach, instead of showing them as leading zeros. */
  hideLeadingZeros?: boolean
  gap?: number
  borderRadius?: number
  horizontalPadding?: number
  textColor?: string
  fontWeight?: React.CSSProperties['fontWeight']
  containerStyle?: React.CSSProperties
  counterStyle?: React.CSSProperties
  digitStyle?: React.CSSProperties
  gradientHeight?: number
  gradientFrom?: string
  gradientTo?: string
  topGradientStyle?: React.CSSProperties
  bottomGradientStyle?: React.CSSProperties
}

export function Counter({
  value,
  from,
  fontSize = 100,
  padding = 0,
  places = [...value.toString()].map((ch, i, a) => {
    if (ch === '.') {
      return '.'
    }
    const dotIndex = a.indexOf('.')
    const isInteger = dotIndex === -1

    const exponent = isInteger ? a.length - i - 1 : i < dotIndex ? dotIndex - i - 1 : -(i - dotIndex)

    return 10 ** exponent
  }),
  hideLeadingZeros = false,
  gap = 8,
  borderRadius = 4,
  horizontalPadding = 8,
  textColor = 'inherit',
  fontWeight = 'inherit',
  containerStyle,
  counterStyle,
  digitStyle,
  gradientHeight = 16,
  gradientFrom = 'black',
  gradientTo = 'transparent',
  topGradientStyle,
  bottomGradientStyle,
}: CounterProps) {
  const height = fontSize + padding

  const defaultCounterStyle: React.CSSProperties = {
    fontSize,
    gap,
    borderRadius,
    paddingLeft: horizontalPadding,
    paddingRight: horizontalPadding,
    color: textColor,
    fontWeight,
    direction: 'ltr',
  }

  const defaultTopGradientStyle: React.CSSProperties = {
    height: gradientHeight,
    background: `linear-gradient(to bottom, ${gradientFrom}, ${gradientTo})`,
  }

  const defaultBottomGradientStyle: React.CSSProperties = {
    height: gradientHeight,
    background: `linear-gradient(to top, ${gradientFrom}, ${gradientTo})`,
  }

  // A column is above the value's magnitude when the value cannot reach it; a separator is when the
  // nearest column to its left is.
  const aboveMagnitude: boolean[] = []
  let anyShown = false
  for (const place of places) {
    if (!hideLeadingZeros) {
      aboveMagnitude.push(false)
      continue
    }
    if (typeof place === 'string') {
      aboveMagnitude.push(!anyShown)
      continue
    }
    const above = place >= 10 && Math.abs(value) < place
    anyShown = anyShown || !above
    aboveMagnitude.push(above)
  }

  return (
    <span className="counter-container" style={containerStyle}>
      <span className="counter-counter" style={{ ...defaultCounterStyle, ...counterStyle }}>
        {places.map((place, index) =>
          typeof place === 'string' ? (
            <Separator key={index} glyph={place} height={height} hidden={aboveMagnitude[index]} style={digitStyle} />
          ) : (
            <Digit
              // Keyed by the power of ten, not by position: a column that gains a neighbour to its
              // left keeps its spring instead of remounting and rolling up from `from` again.
              key={place}
              place={place}
              value={value}
              from={from ?? value}
              height={height}
              hidden={aboveMagnitude[index]}
              digitStyle={digitStyle}
            />
          ),
        )}
      </span>
      <span className="gradient-container">
        <span className="top-gradient" style={topGradientStyle ?? defaultTopGradientStyle} />
        <span className="bottom-gradient" style={bottomGradientStyle ?? defaultBottomGradientStyle} />
      </span>
    </span>
  )
}
