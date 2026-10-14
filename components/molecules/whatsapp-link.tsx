import { useEffect, useEffectEvent, useMemo, useState, type MouseEvent } from 'react'
import { Loader2, ScanLine } from 'lucide-react'
import { encode } from 'uqr'
import { cn } from '@/lib/utils'
import { linkMessage, whatsAppLink } from '@/lib/whatsapp/link'

export type WhatsAppLinkLabels = {
  vincular: string
  codigo: string
  /** The manual line, with `{codigo}` already interpolated: shown when no number is configured. */
  sinNumero: string
}

type WhatsAppLinkActionProps = {
  /** The number people write to (digits only); null when the deployment has none. */
  number: string | null
  /** The account's live code; null when none yet. */
  code: string | null
  /** Requests a code when `code` is null; absent (the demo) renders the action disabled. */
  onRequestCode?: () => Promise<{ code: string }>
  /** The person activated the link: the screen moves to "waiting". */
  onOpened?: () => void
  onCodeReady?: (code: string) => void
  label: string
  className?: string
  disabled?: boolean
}

const PRIMARY =
  'onboarding-button relative flex h-12 w-full items-center justify-center whitespace-nowrap rounded-[18px] bg-primary text-body-lg font-semibold text-primary-foreground outline-none focus-visible:outline-2 focus-visible:outline-offset-2'

/**
 * "Vincular WhatsApp" (`whatsapp-linking` → *"Vincular WhatsApp" opens the chat with the message
 * written*, D9): an anchor to `wa.me` with the real href, so iOS opens the app on the person's own
 * gesture; when there is no live code yet, a button that requests one and then swaps to the anchor.
 * Nothing is rendered without a number: the manual line (`LinkCode`) takes its place.
 */
export function WhatsAppLinkAction({ number, code, onRequestCode, onOpened, onCodeReady, label, className, disabled }: WhatsAppLinkActionProps) {
  const [requesting, setRequesting] = useState(false)
  if (!number) return null

  if (disabled || (!code && !onRequestCode)) {
    return (
      <button type="button" data-primary disabled className={cn(PRIMARY, 'opacity-50', className)}>
        {label}
      </button>
    )
  }

  if (!code) {
    async function request() {
      if (requesting || !onRequestCode) return
      setRequesting(true)
      try {
        const result = await onRequestCode()
        onCodeReady?.(result.code)
      } finally {
        setRequesting(false)
      }
    }
    return (
      <button type="button" data-primary onClick={() => void request()} aria-busy={requesting || undefined} className={cn(PRIMARY, className)}>
        <span className={cn('transition-opacity duration-150 motion-reduce:transition-none', requesting && 'opacity-0')}>{label}</span>
        {requesting ? <Loader2 aria-hidden className="absolute inset-0 m-auto size-5 animate-spin" /> : null}
      </button>
    )
  }

  function open(event: MouseEvent<HTMLAnchorElement>) {
    void event
    onOpened?.()
  }

  return (
    <a data-primary href={whatsAppLink(number, code)} target="_blank" rel="noopener" onClick={open} className={cn(PRIMARY, className)}>
      {label}
    </a>
  )
}

const LINK_POLL_MS = 4000
const LINK_POLL_LIMIT_MS = 10 * 60 * 1000

/**
 * While a QR waits to be scanned the tab never loses focus, so the re-read on focus never fires:
 * the account is re-read every 4 s instead, for at most 10 minutes.
 */
export function useLinkPolling(active: boolean, refresh: () => void) {
  // An event, so a `refresh` made anew on each render does not restart the timer (or its limit).
  const tick = useEffectEvent(refresh)
  useEffect(() => {
    if (!active) return
    const started = Date.now()
    const interval = setInterval(() => {
      if (Date.now() - started > LINK_POLL_LIMIT_MS) clearInterval(interval)
      else if (document.visibilityState !== 'hidden') tick()
    }, LINK_POLL_MS)
    return () => clearInterval(interval)
  }, [active])
}

type WhatsAppQrProps = {
  number: string
  /** The account's live code; null while it is requested (a blank square holds the place). */
  code: string | null
  labels: { titulo: string; linea: string; abrirAqui: string; qr: string }
  className?: string
}

/**
 * The link as a QR, for a tablet or a computer (whatsapp-linking): the phone's camera opens
 * WhatsApp with `vincular <código>` written. Generated here, never by a third-party service, since
 * it carries the code. Dark modules on white in both themes: cameras miss inverted codes. Below,
 * the same link for a WhatsApp installed on this device.
 */
export function WhatsAppQr({ number, code, labels, className }: WhatsAppQrProps) {
  const href = code ? whatsAppLink(number, code) : null
  const path = useMemo(() => {
    if (!href) return null
    const { data, size } = encode(href, { ecc: 'M', border: 0 })
    let d = ''
    data.forEach((row, y) => row.forEach((dark, x) => dark && (d += `M${x} ${y}h1v1h-1z`)))
    return { d, size }
  }, [href])

  return (
    <div data-whatsapp-qr className={cn('flex flex-col items-center gap-4 rounded-card border bg-card p-4 sm:flex-row sm:items-center sm:gap-5', className)}>
      <div className="grid size-44 shrink-0 place-items-center rounded-[18px] bg-white p-3 shadow-sm ring-1 ring-black/5">
        {path ? (
          <svg role="img" aria-label={labels.qr} viewBox={`0 0 ${path.size} ${path.size}`} shapeRendering="crispEdges" className="size-full transition-opacity duration-200 starting:opacity-0 motion-reduce:transition-none">
            <path d={path.d} fill="#000" />
          </svg>
        ) : (
          <Loader2 aria-hidden className="size-6 animate-spin text-neutral-400" />
        )}
      </div>
      <div className="flex min-w-0 flex-col items-center gap-1.5 text-center sm:items-start sm:text-left">
        <p className="flex items-center gap-2 text-body-lg font-semibold text-foreground">
          <ScanLine aria-hidden className="size-5 text-brand-ink" />
          {labels.titulo}
        </p>
        <p className="text-body-md text-muted-foreground">{labels.linea}</p>
        {href ? (
          <a href={href} target="_blank" rel="noopener" className="mt-1 text-body-md font-medium text-brand-ink underline-offset-4 outline-none hover:underline focus-visible:outline-2">
            {labels.abrirAqui}
          </a>
        ) : null}
      </div>
    </div>
  )
}

type LinkCodeProps = {
  number: string | null
  code: string | null
  labels: Pick<WhatsAppLinkLabels, 'codigo' | 'sinNumero'>
  className?: string
}

/**
 * The code beside the action, for typing by hand, and — without a configured number — the line
 * that says to send `vincular <código>` to Mango. Static: nothing here animates.
 */
export function LinkCode({ number, code, labels, className }: LinkCodeProps) {
  return (
    <div className={cn('flex flex-col gap-2', className)}>
      <p className="flex items-center gap-2 text-body-sm text-muted-foreground">
        <span>{labels.codigo}</span>
        <span data-link-code className="rounded-md bg-foreground/[0.06] px-2 py-0.5 font-mono text-body-md font-semibold tracking-[0.08em] text-foreground">
          {code ?? '······'}
        </span>
      </p>
      {!number ? (
        <p data-manual-line className="text-body-md text-foreground">
          {labels.sinNumero}
        </p>
      ) : null}
    </div>
  )
}

/** What the person's bubble reads in the chat preview: the message as it will be sent. */
export function previewMessage(code: string | null): string {
  return linkMessage(code ?? '······')
}
