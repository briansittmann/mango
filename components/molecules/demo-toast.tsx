import { Info } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { cn } from '@/lib/utils'

type DemoToastProps = {
  open: boolean
}

export function DemoToast({ open }: DemoToastProps) {
  const t = useTranslations('demo')

  return (
    <>
      <p role="status" className="sr-only">
        {open ? t('accionNoDisponible') : ''}
      </p>
      <div
        aria-hidden
        className={cn(
          'pointer-events-none fixed inset-x-0 bottom-[max(1rem,env(safe-area-inset-bottom))] z-40 flex justify-center transition-[opacity,translate] motion-reduce:translate-y-0 motion-reduce:transition-[opacity]',
          open ? 'translate-y-0 opacity-100 duration-500 ease-spring' : 'translate-y-3 opacity-0 duration-200 ease-out',
        )}
      >
        <span className="inline-flex items-center gap-2 rounded-full bg-foreground px-4 py-2.5 text-body-sm font-medium text-background">
          <Info aria-hidden className="size-4" />
          {t('accionNoDisponible')}
        </span>
      </div>
    </>
  )
}
