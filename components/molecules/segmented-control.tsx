'use client'

import { Radio } from '@base-ui/react/radio'
import { RadioGroup } from '@base-ui/react/radio-group'
import { cn } from '@/lib/utils'

type SegmentedControlProps<T extends string> = {
  /** The group's accessible name. */
  label: string
  options: readonly { value: T; label: string }[]
  value: T
  onChange: (value: T) => void
  className?: string
}

/**
 * A single choice over equal segments (`transaction-list` → *Filter by kind*, design D6): Base UI's
 * radio group gives the semantics and the roving arrow keys, and the look is the theme toggle's
 * track and thumb. Equal columns keep the thumb's move a pure `translate`.
 */
export function SegmentedControl<T extends string>({ label, options, value, onChange, className }: SegmentedControlProps<T>) {
  const index = Math.max(0, options.findIndex((option) => option.value === value))

  return (
    <RadioGroup
      aria-label={label}
      value={value}
      onValueChange={(next) => onChange(next as T)}
      className={cn('segment-track group relative grid rounded-full p-1', className)}
      style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}
    >
      <span
        aria-hidden
        className="segment-thumb absolute inset-y-1 left-1 rounded-full transition-[translate,scale] duration-500 ease-spring group-active:scale-[0.96] motion-reduce:transition-none"
        style={{ width: `calc((100% - 0.5rem) / ${options.length})`, translate: `${index * 100}%` }}
      />
      {options.map((option) => (
        <Radio.Root
          key={option.value}
          value={option.value}
          data-segment={option.value}
          className={cn(
            'relative grid min-h-target cursor-pointer select-none place-items-center rounded-full px-2 text-body-md font-medium transition-colors duration-150 ease-out outline-none focus-visible:outline-2 focus-visible:-outline-offset-2',
            option.value === value ? 'text-foreground' : 'text-muted-foreground hover-fine:hover:text-foreground',
          )}
        >
          <span className="truncate">{option.label}</span>
        </Radio.Root>
      ))}
    </RadioGroup>
  )
}
