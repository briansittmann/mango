import { Switch as BaseSwitch } from '@base-ui/react/switch'
import { cn } from '@/lib/utils'

type SwitchProps = {
  checked: boolean
  onCheckedChange: (checked: boolean) => void
  disabled?: boolean
  id?: string
  'aria-label'?: string
  'aria-labelledby'?: string
  className?: string
}

function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

export function Switch({ checked, onCheckedChange, disabled, id, className, ...aria }: SwitchProps) {
  function handleCheckedChange(next: boolean) {
    if (!prefersReducedMotion()) {
      try {
        navigator.vibrate?.(10)
      } catch {}
    }
    onCheckedChange(next)
  }

  return (
    <BaseSwitch.Root
      id={id}
      checked={checked}
      onCheckedChange={handleCheckedChange}
      disabled={disabled}
      {...aria}
      className={cn(
        'group pressable relative inline-flex size-target shrink-0 items-center justify-center rounded-full [--press-scale:0.96] disabled:pointer-events-none disabled:opacity-50',
        className,
      )}
    >
      <span
        aria-hidden
        className="relative h-6 w-11 rounded-full bg-muted transition-colors duration-200 ease-spring group-data-checked:bg-brand motion-reduce:transition-none"
      >
        <BaseSwitch.Thumb className="absolute left-0.5 top-0.5 size-5 rounded-full bg-card shadow-sm transition-transform duration-200 ease-spring group-data-checked:translate-x-5 motion-reduce:transition-none" />
      </span>
    </BaseSwitch.Root>
  )
}
