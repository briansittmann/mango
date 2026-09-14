import { useTranslations } from 'next-intl'

export function DemoNotice() {
  const t = useTranslations('demo')

  return (
    <p role="status" className="bg-warning/15 text-foreground border-b border-warning/30 px-4 py-2 text-center text-sm">
      {t('aviso')}
    </p>
  )
}
