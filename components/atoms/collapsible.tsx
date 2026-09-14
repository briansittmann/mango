import { cn } from '@/lib/utils'

type CollapsibleProps = {
  open: boolean
  id?: string
  className?: string
  children: React.ReactNode
}

export function Collapsible({ open, id, className, children }: CollapsibleProps) {
  return (
    <div
      id={id}
      className={cn(
        'grid transition-[grid-template-rows] duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] motion-reduce:transition-none',
        open ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]',
        className,
      )}
    >
      <div className="min-h-0 overflow-hidden" inert={!open}>
        {children}
      </div>
    </div>
  )
}
