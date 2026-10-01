import { useTranslations } from 'next-intl'
import { BasicsFields, type BasicsDraft } from '@/components/molecules/basics-fields'

type BasicsStepProps = {
  value: BasicsDraft
  onChange: (next: BasicsDraft) => void
  storedTimezone: string
  namePlaceholder?: string
  /** Anything keyed to the cycle locks the day (D6). */
  locked: boolean
  disabled?: boolean
  error?: string | null
}

/** Step 2 (`onboarding` → *Basics*): the fields on one grouped surface; "Continuar" is the template's. */
export function BasicsStep({ value, onChange, storedTimezone, namePlaceholder, locked, disabled, error }: BasicsStepProps) {
  const t = useTranslations('onboarding')

  return (
    <div className="flex flex-col gap-4">
      <h1 className="font-display text-headline-lg text-foreground">{t('datos.titulo')}</h1>
      <div className="rounded-card border bg-card">
        <BasicsFields
          idPrefix="basics"
          value={value}
          onChange={onChange}
          storedTimezone={storedTimezone}
          namePlaceholder={namePlaceholder}
          cycleDay={locked ? 'locked' : 'editable'}
          disabled={disabled}
        />
      </div>
      {error ? (
        <p role="alert" className="text-body-sm text-destructive-ink">
          {error}
        </p>
      ) : null}
    </div>
  )
}
