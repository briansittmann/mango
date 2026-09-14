import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

type MenuRowProps = {
  icon: ReactNode
  label: string
  children?: ReactNode
  onClick?: () => void
  disabled?: boolean
}

export function MenuRow({ icon, label, children, onClick, disabled }: MenuRowProps) {
  const content = (
    <>
      {icon}
      <span className="flex-1 text-left text-sm text-foreground">{label}</span>
      {children}
    </>
  )

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        className="flex min-h-12 w-full items-center gap-3 rounded-lg px-1 py-2 transition-colors hover:bg-muted disabled:pointer-events-none disabled:opacity-40"
      >
        {content}
      </button>
    )
  }

  return <div className={cn('flex min-h-12 items-center gap-3 px-1 py-2', disabled && 'opacity-40')}>{content}</div>
}
