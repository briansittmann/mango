import { useRef, useState, type FormEvent } from 'react'
import { Loader2 } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { BasicsFields, basicsValid, type BasicsDraft } from '@/components/molecules/basics-fields'
import { SheetShell } from '@/components/organisms/sheet-shell'
import { cn } from '@/lib/utils'
import type { DashboardData } from '@/lib/data/dashboard'
import type { ProfileBasics } from '@/lib/data/profile'

type AccountSheetProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  user: DashboardData['user']
  onSave: (basics: ProfileBasics) => Promise<void>
}

function draftOf(user: DashboardData['user']): BasicsDraft {
  return {
    name: user.name,
    country: user.country ?? null,
    currency: user.currency,
    timezone: user.timezone,
    cycleDay: String(user.cycleDay ?? 1),
    // The sheet edits the stored format; the page shows the one in effect (`amountFormat`), which
    // equals it for Argentina, the only country where the control is shown.
    amountFormat: user.amountFormat ?? 'completo',
  }
}

/**
 * The "Cuenta" sheet (`dashboard-ui` → *Account avatar and menu*, D16): the basics step's fields
 * minus the cycle day, shown as a line, with the mixed-currency note when the account holds
 * movements. Saving goes through the profile operations with the onboarding's validation.
 */
export function AccountSheet({ open, onOpenChange, user, onSave }: AccountSheetProps) {
  const t = useTranslations('cuenta')
  const nameRef = useRef<HTMLInputElement>(null)
  const [wasOpen, setWasOpen] = useState(open)
  const [draft, setDraft] = useState<BasicsDraft>(() => draftOf(user))
  const [snapshot, setSnapshot] = useState(draft)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(false)

  if (open !== wasOpen) {
    setWasOpen(open)
    if (open) {
      const next = draftOf(user)
      setDraft(next)
      setSnapshot(next)
      setSaving(false)
      setError(false)
    }
  }

  const isDirty = JSON.stringify(draft) !== JSON.stringify(snapshot)
  const valid = basicsValid(draft)

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (saving || !valid || !draft.country) return
    setSaving(true)
    setError(false)
    try {
      await onSave({
        name: draft.name.trim(),
        country: draft.country,
        currency: draft.currency,
        timezone: draft.timezone,
        cycleDay: user.cycleDay ?? 1,
        amountFormat: draft.amountFormat,
      })
      onOpenChange(false)
    } catch {
      setError(true)
    } finally {
      setSaving(false)
    }
  }

  return (
    <SheetShell
      open={open}
      onOpenChange={onOpenChange}
      busy={saving}
      isDirty={isDirty}
      initialFocus={nameRef}
      anchored
      title={t('titulo')}
      leading={
        <button
          type="button"
          onClick={() => onOpenChange(false)}
          disabled={saving}
          className="pressable -ml-2 min-h-target rounded-full px-2 text-body-lg text-foreground disabled:opacity-50"
        >
          {t('cancelar')}
        </button>
      }
      trailing={
        <button
          type="submit"
          form="account-sheet-form"
          disabled={!valid || saving}
          aria-busy={saving || undefined}
          className={cn(
            'pressable relative -mr-2 flex min-h-target items-center justify-center overflow-hidden rounded-full px-2 text-body-lg font-semibold text-brand-ink disabled:opacity-50',
          )}
        >
          <span className={cn('transition-opacity duration-150 motion-reduce:transition-none', saving && 'opacity-0')}>{t('guardar')}</span>
          <Loader2
            aria-hidden
            className={cn('absolute inset-0 m-auto size-5 animate-spin transition-opacity duration-200 motion-reduce:transition-none', saving ? 'opacity-100 delay-150' : 'opacity-0')}
          />
        </button>
      }
    >
      <form id="account-sheet-form" onSubmit={submit} className="overflow-y-auto pb-4">
        {error ? (
          <div role="alert" className="mx-inset mt-3 rounded-inner bg-destructive/[0.08] px-4 py-3 text-body-md text-destructive-ink">
            {t('errorGuardar')}
          </div>
        ) : null}
        <BasicsFields idPrefix="account" value={draft} onChange={setDraft} storedTimezone={user.timezone} cycleDay="hidden" disabled={saving} />
        {user.hasMovements ? <p className="px-inset pb-2 text-body-sm text-muted-foreground">{t('monedasMezcladas')}</p> : null}
        <p data-cycle-day className="relative flex min-h-row items-center px-inset text-body-lg text-foreground before:absolute before:left-4 before:right-0 before:top-0 before:h-px before:bg-border">
          {t('diaInicio', { dia: user.cycleDay ?? 1 })}
        </p>
      </form>
    </SheetShell>
  )
}
