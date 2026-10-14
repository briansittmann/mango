import { useId } from 'react'
import { useTranslations } from 'next-intl'
import { cn } from '@/lib/utils'

export type Scope = 'only' | 'onward'
/** A fixed row's delete can also reach every month, the earlier ones included (`unify-fixed-charge-sheet` D6). */
export type Reach = Scope | 'all'

type ScopeChoiceProps<S extends Reach> = {
  value: S | null
  onChange: (scope: S) => void
  /** The options in order; "Solo este mes" and "Desde este mes en adelante" by default. */
  options?: readonly S[]
  disabled?: boolean
  /** The fieldset's legend; "Aplicar el cambio" by default. */
  legend?: string
  /** A muted line under an option, e.g. what a delete "only this month" leaves behind. */
  hints?: Partial<Record<S, string>>
  /** Destructive colour on the options, for the delete step. */
  destructive?: boolean
}

/**
 * The one scope question of `add-forward-scoped-edits` (D6): "Solo este mes" / "Desde este mes en
 * adelante", a single choice with neither preselected. The category sheet (budget and delete) and
 * the entry sheet (a recurring row's save and delete) all ask it with this control.
 */
export function ScopeChoice<S extends Reach = Scope>({
  value,
  onChange,
  options = ['only', 'onward'] as unknown as readonly S[],
  disabled = false,
  legend,
  hints,
  destructive = false,
}: ScopeChoiceProps<S>) {
  const t = useTranslations('alcance')
  const name = useId()

  return (
    <fieldset className="pb-2">
      <legend className="float-left w-full px-inset pb-1 pt-2 text-body-sm text-muted-foreground">{legend ?? t('aplicar')}</legend>
      {options.map((option) => {
        const checked = value === option
        const hint = hints?.[option]
        return (
          <label
            key={option}
            className={cn(
              'clear-left flex min-h-row cursor-pointer items-center gap-3 px-inset text-body-lg has-[:focus-visible]:bg-muted',
              destructive ? 'text-destructive-ink hover:bg-destructive/[0.08]' : 'text-foreground hover:bg-muted',
            )}
          >
            <span className="flex min-w-0 flex-1 flex-col py-2">
              <span>{option === 'only' ? t('soloEsteMes') : option === 'onward' ? t('desdeEsteMes') : t('todosLosMeses')}</span>
              {hint ? <span className="text-body-sm text-muted-foreground">{hint}</span> : null}
            </span>
            <input
              type="radio"
              name={name}
              value={option}
              checked={checked}
              disabled={disabled}
              onChange={() => onChange(option)}
              className="sr-only"
            />
            <span
              aria-hidden
              className={cn(
                'grid size-5 shrink-0 place-items-center rounded-full border-2 transition-colors duration-150 ease-out motion-reduce:transition-none',
                checked ? (destructive ? 'border-destructive-ink' : 'border-primary') : 'border-muted-foreground/50',
              )}
            >
              <span
                className={cn(
                  'size-2.5 rounded-full transition-transform duration-200 ease-spring motion-reduce:transition-none',
                  destructive ? 'bg-destructive-ink' : 'bg-primary',
                  checked ? 'scale-100' : 'scale-0',
                )}
              />
            </span>
          </label>
        )
      })}
    </fieldset>
  )
}
