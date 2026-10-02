import { useTranslations } from 'next-intl'
import { Avatar } from '@/components/atoms/avatar'
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
      {/* The screen enters in three beats: the title from the left, the avatar's pop, the fields
          from the right; "Continuar" follows once the fields have landed (the template's slot). */}
      <h1 className="onboarding-enter-left font-display text-headline-lg text-foreground">{t('datos.titulo')}</h1>
      {/* The account's avatar, large and live: it takes the initial of whatever the name field holds
          (the handle's while it is empty), so the person sees the account form as they type. It
          enters with the dashboard header's own pop (header-pop, 700 ms --ease-bounce) over a soft
          brand halo; each new initial pops in (segment-pop). Reduced motion shows both in place. */}
      {/* z-10: the fields' entrance animation gives them their own stacking context, so the halo is
          raised to spill onto their top edge. The blurred disc sits inside a box three times its
          size: Safari clips a `filter: blur` to the filtered element's own box while the step's
          layer animates, which showed the disc as a square; with the filter on the larger box the
          glow has room and the look is the original one. */}
      <div className="relative z-10 mx-auto my-2 grid place-items-center" data-onboarding-avatar>
        <span aria-hidden className="pointer-events-none absolute grid size-96 place-items-center blur-2xl">
          <span className="size-32 rounded-full bg-brand/20" />
        </span>
        <Avatar
          name={value.name || namePlaceholder || ''}
          photoUrl={null}
          size="lg"
          animateInitial
          className="relative animate-header-pop shadow-[0_12px_32px_-12px_var(--lift-shadow)] motion-reduce:animate-none"
        />
      </div>
      <div className="onboarding-enter-right rounded-card border bg-card">
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
