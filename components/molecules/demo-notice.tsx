'use client'

import { useState } from 'react'
import { FlaskConical, X } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { Collapsible } from '@/components/atoms/collapsible'

export function DemoNotice() {
  const t = useTranslations('demo')
  const [dismissed, setDismissed] = useState(false)

  return (
    <Collapsible open={!dismissed} className="pt-3">
      <div role="status" className="flex items-center gap-3 rounded-inner bg-muted py-1 pl-1.5 pr-0.5">
        <span className="grid size-8 shrink-0 place-items-center rounded-full bg-warning/20 text-[color-mix(in_oklab,var(--warning)_70%,var(--foreground))]">
          <FlaskConical aria-hidden className="size-4" />
        </span>
        <p className="min-w-0 flex-1 truncate text-body-sm text-foreground">{t('aviso')}</p>
        <button
          type="button"
          onClick={() => setDismissed(true)}
          aria-label={t('cerrarAviso')}
          className="pressable grid size-target shrink-0 place-items-center rounded-full text-muted-foreground [--press-scale:0.9]"
        >
          <X aria-hidden className="size-4" />
        </button>
      </div>
    </Collapsible>
  )
}
