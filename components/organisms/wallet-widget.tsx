'use client'

import { useRef, type ReactNode } from 'react'
import { motion, useMotionValue, useReducedMotion, useSpring, useTransform } from 'motion/react'
import { useTranslations } from 'next-intl'
import { useAmountFormatter } from '@/components/atoms/amount-format'
import { WalletCard } from '@/components/atoms/wallet-card'
import { useMediaQuery } from '@/components/hooks/use-desktop'
import { AddRow } from '@/components/molecules/add-row'
import { WidgetHeader } from '@/components/molecules/widget-header'
import { SpotlightCard } from '@/components/ui/spotlight-card'
import type { Card } from '@/lib/data/cards'

type Committed = { total: number; count: number }

type WalletWidgetProps = {
  cards: Card[]
  /** Each card's committed total in the shown cycle (`committedByCard`); a card absent from it carries nothing. */
  committed: Map<string, Committed>
  currency: string
  /** Opens a card's sheet; absent on a mount without card operations, where the wallet is read-only. */
  onOpen?: (card: Card, opener: HTMLElement) => void
  onAdd?: (opener: HTMLElement) => void
  /** The widget's grip (`widget-list.tsx`). */
  trailing?: ReactNode
}

const NOTHING: Committed = { total: 0, count: 0 }

/**
 * The "Tarjetas" widget (`card-wallet` → *The "Tarjetas" widget*): the user's cards as a stacked
 * wallet in creation order, each card's top band in view and the newest seen whole.
 */
export function WalletWidget({ cards, committed, currency, onOpen, onAdd, trailing }: WalletWidgetProps) {
  const t = useTranslations('tarjetas')
  const { money } = useAmountFormatter()

  return (
    <SpotlightCard className="overflow-hidden rounded-card border border-border bg-card p-inset" data-wallet-widget>
      <WidgetHeader title={t('titulo')}>{trailing}</WidgetHeader>
      {cards.length > 0 ? (
        <div className="wallet-stack mt-4">
          {cards.map((card, index) => {
            const { total, count } = committed.get(card.id) ?? NOTHING
            const amount = money(total, currency)
            const footer = index === cards.length - 1 ? t('gastosFijos', { n: count }) : undefined
            return onOpen ? (
              <WalletCardButton
                key={card.id}
                card={card}
                label={t('etiquetaTarjeta', { nombre: card.name, monto: amount })}
                total={amount}
                footer={footer}
                onOpen={(opener) => onOpen(card, opener)}
              />
            ) : (
              <div key={card.id} data-wallet-entry={card.id}>
                <WalletCard name={card.name} color={card.color} total={amount} footer={footer} />
              </div>
            )
          })}
        </div>
      ) : (
        <div
          data-wallet-empty
          className="mt-4 flex aspect-[1.586] items-center justify-center rounded-[18px] border-2 border-dashed border-border px-6 text-center text-body-md text-muted-foreground"
        >
          {t('vacio')}
        </div>
      )}
      {onAdd ? (
        <div className="-mx-inset -mb-inset mt-4">
          <AddRow label={t('anadir')} onClick={() => onAdd(document.activeElement as HTMLElement)} />
        </div>
      ) : null}
    </SpotlightCard>
  )
}

type WalletCardButtonProps = {
  card: Card
  label: string
  total: string
  footer?: string
  onOpen: (opener: HTMLElement) => void
}

/**
 * One card of the stack (design D6). A mouse tilts it with CSS on hover; a finger sliding sideways
 * tilts the face around its vertical axis with `motion`'s pan gesture, which moves nothing, and
 * springs it back on release. `touch-action: pan-y` leaves vertical slides to the page's scroll.
 * The click that ends a slide is ignored, so only a tap opens the sheet.
 */
function WalletCardButton({ card, label, total, footer, onOpen }: WalletCardButtonProps) {
  const reduced = useReducedMotion()
  const coarse = useMediaQuery('(pointer: coarse)')
  const tilt = coarse && !reduced
  const offset = useMotionValue(0)
  const rotateY = useSpring(useTransform(offset, [-120, 120], [-8, 8]), { stiffness: 300, damping: 25 })
  const sheen = useTransform(rotateY, [-8, 8], ['0% 50%', '100% 50%'])
  const panned = useRef(false)

  return (
    <button
      type="button"
      aria-label={label}
      data-wallet-entry={card.id}
      className="wallet-card-button"
      onPointerDown={() => {
        panned.current = false
      }}
      onClick={(event) => {
        if (panned.current) return
        onOpen(event.currentTarget)
      }}
    >
      <motion.div
        className="rounded-[18px]"
        style={tilt ? { rotateY, transformPerspective: 800, touchAction: 'pan-y' } : undefined}
        onPanStart={
          tilt
            ? () => {
                panned.current = true
              }
            : undefined
        }
        onPan={tilt ? (_, info) => offset.set(info.offset.x) : undefined}
        onPanEnd={tilt ? () => offset.set(0) : undefined}
      >
        <WalletCard name={card.name} color={card.color} total={total} footer={footer} sheen={tilt ? sheen : undefined} />
      </motion.div>
    </button>
  )
}
