import { cn } from '@/lib/utils'

type FieldRowProps = {
  label: string
  htmlFor: string
  tall?: boolean
  children: React.ReactNode
}

export function FieldRow({ label, htmlFor, tall, children }: FieldRowProps) {
  return (
    <div
      className={cn(
        'relative flex items-center gap-3 px-inset before:absolute before:left-4 before:right-0 before:top-0 before:h-px before:bg-border first:before:hidden',
        tall ? 'min-h-14' : 'min-h-row',
      )}
    >
      <label htmlFor={htmlFor} className="flex-1 text-body-lg text-foreground">
        {label}
      </label>
      <div className="relative shrink-0">{children}</div>
    </div>
  )
}
