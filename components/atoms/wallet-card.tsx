import { motion, type MotionValue } from 'motion/react'
import type { CSSProperties, ReactNode } from 'react'
import type { CategoryColor } from '@/lib/data/dashboard'
import { cn } from '@/lib/utils'

type WalletCardProps = {
  name: string
  color: CategoryColor
  /** The committed total, already formatted, at the end of the top band. */
  total: ReactNode
  /** One line at the bottom ("2 gastos fijos"); only the card seen whole shows it. */
  footer?: ReactNode
  /** The sheen's position while a finger tilts the card (`wallet-widget.tsx`); CSS moves it on hover. */
  sheen?: MotionValue<string>
  className?: string
}

/**
 * A card face (`card-wallet` → *The card face*): CSS only, in a payment card's proportions. The top
 * 56px band holds the name and the total, the part of every card the wallet's stack leaves in view.
 */
export function WalletCard({ name, color, total, footer, sheen, className }: WalletCardProps) {
  return (
    <div
      data-wallet-card={color}
      className={cn('wallet-card flex flex-col text-left', className)}
      style={{ '--card-from': `var(--card-from-${color})`, '--card-to': `var(--card-to-${color})` } as CSSProperties}
    >
      <motion.span aria-hidden className="wallet-card-sheen" style={sheen ? { backgroundPosition: sheen } : undefined} />
      <div className="flex h-14 shrink-0 items-center justify-between gap-3 px-5">
        <span data-wallet-card-name className="min-w-0 truncate text-body-lg font-semibold">
          {name}
        </span>
        <span data-wallet-card-total className="shrink-0 font-display text-headline-sm tabular-nums">
          {total}
        </span>
      </div>
      <div aria-hidden className="wallet-card-chip ml-5 mt-2" />
      {footer ? (
        <span data-wallet-card-footer className="mt-auto px-5 pb-4 text-body-sm font-medium">
          {footer}
        </span>
      ) : null}
    </div>
  )
}
