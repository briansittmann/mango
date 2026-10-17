import { useEffect, useState, type FormEvent, type RefObject } from 'react'
import { Check, Clock, Loader2, MessageCircle, Trash2, Unlink } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { Collapsible } from '@/components/atoms/collapsible'
import { BasicsFields, basicsValid, type BasicsDraft } from '@/components/molecules/basics-fields'
import { SegmentedControl } from '@/components/molecules/segmented-control'
import { LinkCode, useLinkPolling, WhatsAppLinkAction, WhatsAppQr } from '@/components/molecules/whatsapp-link'
import { usePhone } from '@/components/hooks/use-desktop'
import { SheetShell } from '@/components/organisms/sheet-shell'
import { cn } from '@/lib/utils'
import type { DashboardData } from '@/lib/data/dashboard'
import type { PaymentMethod } from '@/lib/data/payment-method'
import type { ProfileBasics } from '@/lib/data/profile'
// A pure formatter over the stored number, not data access (add-whatsapp-linking D8).
// eslint-disable-next-line @typescript-eslint/no-restricted-imports
import { formatPhone } from '@/lib/data/phone'

type AccountSheetProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** The account menu's own anchor (the avatar or the sidebar card): the menu is gone by the time the sheet opens. */
  opener?: RefObject<HTMLElement | null>
  user: DashboardData['user']
  onSave: (basics: ProfileBasics) => Promise<void>
  /** "Medio de pago por defecto" (D13): written after the basics, only when it changed; absent hides the control. */
  onSaveDefault?: (method: PaymentMethod | null) => Promise<void>
  /** "Vincular WhatsApp" with no live code: requests one (D9); absent on the demo (the action is disabled). */
  onRequestLink?: () => Promise<{ code: string }>
  /** The page re-reads the account while the sheet waits for the chat's message. */
  onRefresh?: () => void
  /** "Desvincular": drops the linked number so another can be linked; absent when the page cannot. */
  onUnlink?: () => Promise<void>
  /** Deletes the account for good; absent when the page cannot (the row is then hidden). */
  onDelete?: () => Promise<void>
}

type DefaultChoice = PaymentMethod | 'ninguno'

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
export function AccountSheet({
  open,
  onOpenChange,
  opener,
  user,
  onSave,
  onSaveDefault,
  onRequestLink,
  onRefresh,
  onUnlink,
  onDelete,
}: AccountSheetProps) {
  const t = useTranslations('cuenta')
  const tMedio = useTranslations('medioPago')
  const [wasOpen, setWasOpen] = useState(open)
  const [draft, setDraft] = useState<BasicsDraft>(() => draftOf(user))
  const [snapshot, setSnapshot] = useState(draft)
  const storedDefault: DefaultChoice = user.defaultPaymentMethod ?? 'ninguno'
  const [defaultChoice, setDefaultChoice] = useState<DefaultChoice>(storedDefault)
  // The WhatsApp section (D9): the code the page loaded or the one just requested, and whether
  // the person opened the chat from here (then the sheet reads "Esperando tu mensaje").
  const [linkCode, setLinkCode] = useState<string | null>(user.whatsapp?.code ?? null)
  const [opened, setOpened] = useState(false)
  // "Desvincular" opens a confirmation in place; the spinner holds until the re-read shows no channel.
  const [confirmingUnlink, setConfirmingUnlink] = useState(false)
  const [unlinking, setUnlinking] = useState(false)
  const [unlinkError, setUnlinkError] = useState(false)
  const [wasLinked, setWasLinked] = useState(user.whatsapp?.linked ?? null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(false)
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState(false)

  if (open !== wasOpen) {
    setWasOpen(open)
    if (open) {
      const next = draftOf(user)
      setDraft(next)
      setSnapshot(next)
      setDefaultChoice(storedDefault)
      setLinkCode(user.whatsapp?.code ?? null)
      setOpened(false)
      setConfirmingUnlink(false)
      setUnlinking(false)
      setUnlinkError(false)
      setSaving(false)
      setError(false)
      setConfirmingDelete(false)
      setDeleting(false)
      setDeleteError(false)
    }
  }

  const whatsapp = user.whatsapp ?? { number: null, code: null, linked: null }
  // The channel went away (an unlink landed): the section starts over, ready to link another number.
  if (whatsapp.linked !== wasLinked) {
    setWasLinked(whatsapp.linked)
    if (!whatsapp.linked) {
      setUnlinking(false)
      setConfirmingUnlink(false)
      setOpened(false)
      setLinkCode(null)
    }
  }
  // A phone opens the chat with the link; a tablet or a computer scans the QR, which is already waiting.
  const onPhone = usePhone()
  const showsQr = !onPhone && whatsapp.number != null
  const linkPhase: 'idle' | 'waiting' | 'linked' = whatsapp.linked
    ? 'linked'
    : opened || (linkCode != null && (!whatsapp.number || showsQr))
      ? 'waiting'
      : 'idle'

  // The code is requested as the sheet opens, so "Vincular WhatsApp" is the `wa.me` link from the
  // first tap: iOS only opens the app on the gesture itself, not after a round trip.
  useEffect(() => {
    if (!open || whatsapp.linked || !whatsapp.number || linkCode != null || !onRequestLink) return
    let cancelled = false
    onRequestLink()
      .then((result) => {
        if (!cancelled) setLinkCode(result.code)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [open, whatsapp.linked, whatsapp.number, linkCode, onRequestLink])

  // While the sheet waits for the chat's message, a return to the tab re-reads the account.
  useEffect(() => {
    if (!open || linkPhase !== 'waiting' || !onRefresh) return
    const refresh = () => {
      if (document.visibilityState !== 'hidden') onRefresh()
    }
    document.addEventListener('visibilitychange', refresh)
    window.addEventListener('focus', refresh)
    return () => {
      document.removeEventListener('visibilitychange', refresh)
      window.removeEventListener('focus', refresh)
    }
  }, [open, linkPhase, onRefresh])

  // The QR is scanned with another device: the sheet re-reads the account on a timer.
  useLinkPolling(open && linkPhase === 'waiting' && showsQr && onRefresh != null, () => onRefresh?.())

  const basicsDirty = JSON.stringify(draft) !== JSON.stringify(snapshot)
  const defaultDirty = defaultChoice !== storedDefault
  const isDirty = basicsDirty || defaultDirty
  const valid = basicsValid(draft)
  const busy = saving || deleting || unlinking

  async function confirmUnlink() {
    if (unlinking || !onUnlink) return
    setUnlinking(true)
    setUnlinkError(false)
    try {
      await onUnlink()
      onRefresh?.()
    } catch {
      setUnlinkError(true)
      setUnlinking(false)
    }
  }

  // The redirect replaces the page on success, so the spinner only clears on a failure.
  async function confirmDelete() {
    if (deleting || !onDelete) return
    setDeleting(true)
    setDeleteError(false)
    try {
      await onDelete()
    } catch {
      setDeleteError(true)
      setDeleting(false)
    }
  }

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (saving || !valid || !draft.country) return
    setSaving(true)
    setError(false)
    try {
      // Two writes, each only when its part changed (D13): a retry after the second failed
      // rewrites the same basics, which is harmless.
      if (basicsDirty || !defaultDirty) {
        await onSave({
          name: draft.name.trim(),
          country: draft.country,
          currency: draft.currency,
          timezone: draft.timezone,
          cycleDay: user.cycleDay ?? 1,
          amountFormat: draft.amountFormat,
        })
      }
      if (defaultDirty && onSaveDefault) await onSaveDefault(defaultChoice === 'ninguno' ? null : defaultChoice)
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
      busy={busy}
      isDirty={isDirty}
      // No field takes focus on open, as the edit sheets do: a focused name would raise the
      // keyboard on a phone, and an unattached ref lands focus (and its ring) on "Cancelar".
      initialFocus={false}
      anchored
      opener={opener}
      title={t('titulo')}
      leading={
        <button
          type="button"
          onClick={() => onOpenChange(false)}
          disabled={busy}
          className="pressable -ml-2 min-h-target rounded-full px-2 text-body-lg text-foreground disabled:opacity-50"
        >
          {t('cancelar')}
        </button>
      }
      trailing={
        <button
          type="submit"
          form="account-sheet-form"
          disabled={!valid || busy}
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
        <BasicsFields idPrefix="account" value={draft} onChange={setDraft} storedTimezone={user.timezone} cycleDay="hidden" disabled={busy} />
        {user.hasMovements ? <p className="px-inset pb-2 text-body-sm text-muted-foreground">{t('monedasMezcladas')}</p> : null}
        <p data-cycle-day className="relative flex min-h-row items-center px-inset text-body-lg text-foreground before:absolute before:left-4 before:right-0 before:top-0 before:h-px before:bg-border">
          {t('diaInicio', { dia: user.cycleDay ?? 1 })}
        </p>
        {onSaveDefault ? (
          // The drawer's swipe would take the pointer and the segments would never get the click.
          <div data-default-payment data-base-ui-swipe-ignore className="relative flex flex-col gap-2 px-inset py-3 before:absolute before:left-4 before:right-0 before:top-0 before:h-px before:bg-border">
            <span id="account-default-payment" className="text-body-lg text-foreground">
              {tMedio('porDefecto')}
            </span>
            <SegmentedControl<DefaultChoice>
              label={tMedio('porDefecto')}
              value={defaultChoice}
              onChange={setDefaultChoice}
              options={[
                { value: 'ninguno', label: tMedio('ninguno') },
                { value: 'efectivo', label: tMedio('efectivo') },
                { value: 'tarjeta', label: tMedio('tarjeta') },
              ]}
            />
          </div>
        ) : null}

        {/* The WhatsApp section (`dashboard-ui` → *Account avatar and menu*, D9): the channel's
            state, the link, the code and the optional number for Meta's recipient list. */}
        <section data-whatsapp-section aria-labelledby="account-whatsapp-title" className="mx-inset mt-6 flex flex-col gap-3">
          <h3 id="account-whatsapp-title" className="px-1 text-body-sm text-muted-foreground">
            {t('whatsapp.titulo')}
          </h3>
          <div data-link-state={linkPhase} className="flex items-start gap-3 rounded-[18px] bg-foreground/[0.04] px-4 py-3">
            <span
              className={cn(
                'grid size-9 shrink-0 place-items-center rounded-full',
                linkPhase === 'linked' ? 'bg-brand/[0.16] text-brand-ink' : 'bg-foreground/[0.06] text-muted-foreground',
              )}
            >
              {linkPhase === 'linked' ? (
                <Check aria-hidden className="size-5 animate-segment-pop motion-reduce:animate-none" />
              ) : linkPhase === 'waiting' ? (
                <Clock aria-hidden className="size-5" />
              ) : (
                <MessageCircle aria-hidden className="size-5" />
              )}
            </span>
            <div key={linkPhase} className="min-w-0 flex-1 transition-opacity duration-200 ease-[ease] starting:opacity-0 motion-reduce:transition-none">
              <p role="status" className="text-body-lg font-semibold text-foreground">
                {linkPhase === 'linked' ? t('whatsapp.estadoVinculado') : linkPhase === 'waiting' ? t('whatsapp.estadoEsperando') : t('whatsapp.estadoSinVincular')}
              </p>
              <p className="text-body-sm text-muted-foreground">
                {linkPhase === 'linked' && whatsapp.linked
                  ? formatPhone(whatsapp.linked)
                  : linkPhase === 'waiting'
                    ? t('whatsapp.estadoEsperandoLinea')
                    : t('whatsapp.estadoSinVincularLinea')}
              </p>
            </div>
          </div>
          {linkPhase !== 'linked' ? (
            <>
              {showsQr && whatsapp.number ? (
                <WhatsAppQr
                  number={whatsapp.number}
                  code={linkCode}
                  labels={{ titulo: t('whatsapp.qrTitulo'), linea: t('whatsapp.qrLinea'), abrirAqui: t('whatsapp.qrAbrirAqui'), qr: t('whatsapp.qr') }}
                  className="rounded-[18px] border-0 bg-foreground/[0.04]"
                />
              ) : (
                <WhatsAppLinkAction
                  number={whatsapp.number}
                  code={linkCode}
                  onRequestCode={onRequestLink}
                  onCodeReady={setLinkCode}
                  onOpened={() => setOpened(true)}
                  label={t('whatsapp.vincular')}
                  disabled={busy || !onRequestLink}
                />
              )}
              {linkCode != null || !whatsapp.number ? (
                <LinkCode number={whatsapp.number} code={linkCode} labels={{ codigo: t('whatsapp.codigo'), sinNumero: t('whatsapp.sinNumero', { codigo: linkCode ?? '······' }) }} className="px-1" />
              ) : null}
            </>
          ) : null}
          {linkPhase === 'linked' && onUnlink ? (
            <div>
              {/* Like "Eliminar cuenta": the row opens the confirmation in place, a slip is one tap from "Mejor no". */}
              <button
                type="button"
                onClick={() => setConfirmingUnlink((value) => !value)}
                disabled={busy}
                aria-expanded={confirmingUnlink}
                aria-controls="account-unlink-confirm"
                className={cn(
                  'pressable flex min-h-row w-full items-center gap-3 rounded-[18px] px-4 text-left text-body-lg text-foreground transition-[background-color,border-radius] duration-300 ease-out disabled:opacity-50 motion-reduce:transition-none',
                  confirmingUnlink ? 'rounded-b-none bg-foreground/[0.08]' : 'bg-foreground/[0.04] hover:bg-foreground/[0.08]',
                )}
              >
                <Unlink aria-hidden className="size-5 text-muted-foreground" />
                <span className="flex-1 font-medium">{t('whatsapp.desvincular')}</span>
              </button>
              <Collapsible id="account-unlink-confirm" open={confirmingUnlink}>
                <div className="rounded-b-[18px] bg-foreground/[0.08] px-4 pb-4 pt-1">
                  <p className="text-body-lg font-semibold text-foreground">
                    {t('whatsapp.desvincularTitulo', { numero: whatsapp.linked ? formatPhone(whatsapp.linked) : '' })}
                  </p>
                  <p className="mt-1 text-body-sm text-muted-foreground">{t('whatsapp.desvincularDetalle')}</p>
                  {unlinkError ? (
                    <p role="alert" className="mt-2 text-body-sm font-medium text-destructive-ink">
                      {t('whatsapp.errorDesvincular')}
                    </p>
                  ) : null}
                  <div className="mt-4 flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setConfirmingUnlink(false)}
                      disabled={unlinking}
                      className="pressable flex h-11 items-center justify-center rounded-[16px] px-4 text-body-md font-medium text-foreground transition-colors hover:bg-foreground/[0.06] disabled:opacity-50"
                    >
                      {t('whatsapp.desvincularCancelar')}
                    </button>
                    <button
                      type="button"
                      onClick={() => void confirmUnlink()}
                      disabled={unlinking}
                      aria-busy={unlinking || undefined}
                      className={cn(
                        'relative flex h-11 flex-1 items-center justify-center overflow-hidden whitespace-nowrap bg-foreground text-body-md font-semibold text-background transition-[flex,width,border-radius,scale] duration-300 ease-out focus-visible:outline-2 focus-visible:outline-offset-2 active:scale-[0.98] disabled:opacity-100 motion-reduce:transition-none',
                        unlinking ? 'w-11 flex-none rounded-[22px]' : 'rounded-[16px]',
                      )}
                    >
                      <span className={cn('transition-opacity duration-150 motion-reduce:transition-none', unlinking && 'opacity-0')}>
                        {t('whatsapp.desvincularConfirmar')}
                      </span>
                      {unlinking ? <Loader2 aria-hidden className="absolute inset-0 m-auto size-5 animate-spin" /> : null}
                    </button>
                  </div>
                </div>
              </Collapsible>
            </div>
          ) : null}
        </section>
        {onDelete ? (
          <div className="mx-inset mt-6">
            {/* The row opens the confirmation in place; the sheet stays, so a slip is one tap from "Mejor no". */}
            <button
              type="button"
              onClick={() => setConfirmingDelete((value) => !value)}
              disabled={busy}
              aria-expanded={confirmingDelete}
              aria-controls="account-delete-confirm"
              className={cn(
                'pressable group flex min-h-row w-full items-center gap-3 rounded-[18px] px-4 text-left text-body-lg transition-[background-color,color,border-radius] duration-300 ease-out disabled:opacity-50 motion-reduce:transition-none',
                confirmingDelete
                  ? 'rounded-b-none bg-destructive/[0.1] text-destructive-ink'
                  : 'bg-destructive/[0.06] text-destructive-ink hover:bg-destructive/[0.12]',
              )}
            >
              <Trash2
                aria-hidden
                className={cn(
                  'size-5 transition-[rotate,scale] duration-500 ease-bounce group-hover:-rotate-6 motion-reduce:transition-none',
                  confirmingDelete && 'rotate-[-8deg] scale-110',
                )}
              />
              <span className="flex-1 font-medium">{t('eliminarCuenta')}</span>
            </button>
            <Collapsible id="account-delete-confirm" open={confirmingDelete}>
              <div className="rounded-b-[18px] bg-destructive/[0.1] px-4 pb-4 pt-1">
                <p className="text-body-lg font-semibold text-destructive-ink">{t('eliminarTitulo')}</p>
                <p className="mt-1 text-body-sm text-destructive-ink/80">{t('eliminarDetalle')}</p>
                {deleteError ? (
                  <p role="alert" className="mt-2 text-body-sm font-medium text-destructive-ink">
                    {t('errorEliminar')}
                  </p>
                ) : null}
                <div className="mt-4 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setConfirmingDelete(false)}
                    disabled={deleting}
                    className="pressable flex h-11 items-center justify-center rounded-[16px] px-4 text-body-md font-medium text-foreground transition-colors hover:bg-foreground/[0.06] disabled:opacity-50"
                  >
                    {t('eliminarCancelar')}
                  </button>
                  {/* Folds into a round spinner that stays until the redirect replaces the page, like "Cerrar sesion". */}
                  <button
                    type="button"
                    onClick={confirmDelete}
                    disabled={deleting}
                    aria-busy={deleting || undefined}
                    className={cn(
                      'relative flex h-11 flex-1 items-center justify-center overflow-hidden whitespace-nowrap bg-destructive-fill text-body-md font-semibold text-destructive-fill-foreground transition-[flex,width,border-radius,box-shadow,scale] duration-300 ease-out focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-destructive active:scale-[0.98] disabled:opacity-100 motion-reduce:transition-none',
                      deleting
                        ? 'w-11 flex-none rounded-[22px]'
                        : 'rounded-[16px] shadow-[0_8px_20px_-8px_color-mix(in_oklab,var(--destructive)_60%,transparent)] hover:shadow-[0_10px_24px_-8px_color-mix(in_oklab,var(--destructive)_80%,transparent)]',
                    )}
                  >
                    <span className={cn('transition-opacity duration-150 motion-reduce:transition-none', deleting && 'opacity-0')}>
                      {t('eliminarConfirmar')}
                    </span>
                    <Loader2
                      aria-hidden
                      className={cn(
                        'absolute inset-0 m-auto size-5 animate-spin transition-opacity duration-200 motion-reduce:transition-none',
                        deleting ? 'opacity-100 delay-150' : 'opacity-0',
                      )}
                    />
                  </button>
                </div>
              </div>
            </Collapsible>
          </div>
        ) : null}
      </form>
    </SheetShell>
  )
}
