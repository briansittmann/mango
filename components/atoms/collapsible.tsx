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
        'grid transition-[grid-template-rows,opacity] duration-200 ease-drawer motion-reduce:transition-none',
        open ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0',
        className,
      )}
    >
      <div className="min-h-0 overflow-hidden" inert={!open}>
        {children}
      </div>
    </div>
  )
}
