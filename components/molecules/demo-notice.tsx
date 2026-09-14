'use client'

import { useState } from 'react'
import { FlaskConical, X } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { cn } from '@/lib/utils'

export function DemoNotice() {
  const t = useTranslations('demo')
  const [dismissed, setDismissed] = useState(false)

  return (
    <div
      className={cn(
        'grid transition-all duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]',
        dismissed ? 'grid-rows-[0fr] scale-95 opacity-0' : 'grid-rows-[1fr] opacity-100',
      )}
    >
      <div className={cn('min-h-0', dismissed && 'overflow-hidden')} inert={dismissed}>
        <div className="pt-3">
          <div role="status" className="liquid-glass flex items-center gap-3 rounded-full py-1 pl-1.5 pr-0.5">
            <span className="grid size-8 shrink-0 place-items-center rounded-full bg-warning/20 text-[color-mix(in_oklab,var(--warning)_70%,var(--foreground))]">
              <FlaskConical aria-hidden className="size-4" />
            </span>
            <p className="min-w-0 flex-1 truncate text-body-md text-foreground">{t('aviso')}</p>
            <button
              type="button"
              onClick={() => setDismissed(true)}
              aria-label={t('cerrarAviso')}
              className="grid size-9 shrink-0 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-foreground/[0.06] hover:text-foreground"
            >
              <X aria-hidden className="size-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
