import { useState, type MouseEvent } from 'react'
import { Loader2 } from 'lucide-react'
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
