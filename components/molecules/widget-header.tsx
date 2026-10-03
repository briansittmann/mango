import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

type WidgetHeaderProps = {
  title: string
  /** The `id` of the title, for a widget's `aria-labelledby`. */
  titleId?: string
  /** One line under the title in the metadata size: a comparison, a week name, a total. */
  caption?: ReactNode
  /** Controls at the end of the row (week navigation). */
  children?: ReactNode
  className?: string
}

/** The header every chart widget shares (design D6): title · caption · trailing controls. */
export function WidgetHeader({ title, titleId, caption, children, className }: WidgetHeaderProps) {
  return (
    <div className={cn('flex items-start justify-between gap-3', className)}>
      <div className="min-w-0 flex-1">
        <h3 id={titleId} className="font-display text-headline-sm text-foreground">
          {title}
        </h3>
        {caption ? <div className="mt-0.5 flex min-w-0 flex-wrap items-center gap-x-1.5 text-label-ui text-muted-foreground">{caption}</div> : null}
      </div>
      {children ? <div className="flex shrink-0 items-center gap-1">{children}</div> : null}
    </div>
  )
}
