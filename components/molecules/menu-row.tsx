import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

type MenuRowProps = {
  icon: ReactNode
  label: string
  children?: ReactNode
  onClick?: () => void
  disabled?: boolean
}

const rowClassName =
  'relative flex min-h-12 w-full items-center gap-3 px-4 py-3 before:absolute before:left-4 before:right-0 before:top-0 before:h-px before:bg-border first:before:hidden'

export function MenuRow({ icon, label, children, onClick, disabled }: MenuRowProps) {
  const content = (
    <>
      {icon}
      <span className="flex-1 text-left text-body-md text-foreground">{label}</span>
      {children}
    </>
  )

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        className={cn(rowClassName, 'disabled:pointer-events-none disabled:opacity-40')}
      >
        {content}
      </button>
    )
  }

  return <div className={cn(rowClassName, disabled && 'opacity-40')}>{content}</div>
}
