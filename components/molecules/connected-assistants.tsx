import { useEffect, useRef, useState } from 'react'
import { Bot, Check, Copy, Loader2 } from 'lucide-react'
import { useFormatter, useTranslations } from 'next-intl'
import { Collapsible } from '@/components/atoms/collapsible'
import { cn } from '@/lib/utils'
import type { ConnectedApp } from '@/lib/data/profile'
import { SITE_URL } from '@/lib/metadata'

const MCP_URL = `${SITE_URL}/api/mcp`

type ConnectedAssistantsProps = {
  /** The sheet's open state: the list loads each time it opens, never with the dashboard. */
  open: boolean
  timeZone: string
  disabled?: boolean
  onList: () => Promise<ConnectedApp[]>
  onDisconnect: (clientId: string) => Promise<void>
}

/**
 * "Claude y ChatGPT" in the account sheet (`dashboard-ui` → *Connected assistants in the account
 * sheet*, add-mcp-server D11): the server URL to copy, where to paste it, and the assistants the
 * account approved, each with "Desconectar" behind a confirmation in place, like "Desvincular".
 */
export function ConnectedAssistants({ open, timeZone, disabled = false, onList, onDisconnect }: ConnectedAssistantsProps) {
  const t = useTranslations('mcp.cuenta')
  const format = useFormatter()
  const [apps, setApps] = useState<ConnectedApp[] | null>(null)
  const [loadError, setLoadError] = useState(false)
  const [copied, setCopied] = useState(false)
  const [confirming, setConfirming] = useState<string | null>(null)
  const [disconnecting, setDisconnecting] = useState<string | null>(null)
  const [removing, setRemoving] = useState<string | null>(null)
  const [failed, setFailed] = useState<string | null>(null)
  const [announcement, setAnnouncement] = useState('')
  const [wasOpen, setWasOpen] = useState(open)
  const urlRef = useRef<HTMLInputElement>(null)
  const copiedTimer = useRef<ReturnType<typeof setTimeout>>(undefined)

  // Each opening starts over with a fresh list, as the sheet resets its fields.
  if (open !== wasOpen) {
    setWasOpen(open)
    if (open) {
      setApps(null)
      setLoadError(false)
      setConfirming(null)
      setFailed(null)
      setAnnouncement('')
    }
  }

  useEffect(() => {
    if (!open) return
    let cancelled = false
    onList()
      .then((list) => {
        if (!cancelled) setApps(list)
      })
      .catch(() => {
        if (!cancelled) setLoadError(true)
      })
    return () => {
      cancelled = true
    }
  }, [open, onList])

  useEffect(() => () => clearTimeout(copiedTimer.current), [])

  async function copy() {
    try {
      await navigator.clipboard.writeText(MCP_URL)
    } catch {
      // No clipboard (an insecure origin, a denied permission): the URL is selected to copy by hand.
      urlRef.current?.select()
      return
    }
    setCopied(true)
    clearTimeout(copiedTimer.current)
    copiedTimer.current = setTimeout(() => setCopied(false), 2000)
  }

  async function disconnect(app: ConnectedApp) {
    if (disconnecting) return
    setDisconnecting(app.clientId)
    setFailed(null)
    try {
      await onDisconnect(app.clientId)
      // The row folds away first, then leaves the list (Collapsible's 200 ms).
      setRemoving(app.clientId)
      setAnnouncement(t('desconectadoAnuncio', { app: app.name }))
      setTimeout(() => {
        setApps((list) => list?.filter((item) => item.clientId !== app.clientId) ?? null)
        setRemoving(null)
        setConfirming(null)
      }, 250)
    } catch {
      setFailed(app.clientId)
    } finally {
      setDisconnecting(null)
    }
  }

  return (
    <section data-assistants-section aria-labelledby="account-assistants-title" className="mx-inset mt-6 flex flex-col gap-3">
      <h3 id="account-assistants-title" className="px-1 text-body-sm text-muted-foreground">
        {t('titulo')}
      </h3>
      <div className="flex flex-col gap-3 rounded-[18px] bg-foreground/[0.04] px-4 py-3">
        <label htmlFor="account-mcp-url" className="text-body-lg font-semibold text-foreground">
          {t('url')}
        </label>
        <div className="flex items-center gap-2">
          <input
            ref={urlRef}
            id="account-mcp-url"
            readOnly
            value={MCP_URL}
            onFocus={(event) => event.currentTarget.select()}
            className="h-11 min-w-0 flex-1 truncate rounded-[12px] bg-background px-3 font-mono text-body-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
          <button
            type="button"
            onClick={() => void copy()}
            disabled={disabled}
            className="pressable flex h-11 shrink-0 items-center gap-1.5 rounded-[16px] bg-foreground px-4 text-body-md font-semibold text-background disabled:opacity-50"
          >
            {copied ? (
              // A quick confirmation, not a celebration: it can be pressed many times (AUDIT.md §2).
              <Check aria-hidden className="size-4 transition-[scale,opacity] duration-200 ease-out starting:scale-90 starting:opacity-0 motion-reduce:transition-none" />
            ) : (
              <Copy aria-hidden className="size-4" />
            )}
            <span>{copied ? t('copiado') : t('copiar')}</span>
          </button>
        </div>
        <ul className="flex flex-col gap-1 text-body-sm text-muted-foreground">
          <li>{t.rich('enClaude', { strong: (chunks) => <strong className="font-medium text-foreground">{chunks}</strong> })}</li>
          <li>{t.rich('enChatgpt', { strong: (chunks) => <strong className="font-medium text-foreground">{chunks}</strong> })}</li>
        </ul>
      </div>

      <span role="status" className="sr-only">
        {copied ? t('copiadoAnuncio') : announcement}
      </span>

      {loadError ? (
        <p role="alert" className="px-1 text-body-sm font-medium text-destructive-ink">
          {t('errorCargar')}
        </p>
      ) : apps === null ? (
        <p className="flex items-center gap-2 px-1 text-body-sm text-muted-foreground">
          <Loader2 aria-hidden className="size-4 animate-spin motion-reduce:animate-none" />
          {t('cargando')}
        </p>
      ) : apps.length === 0 ? (
        <p data-no-assistants className="px-1 text-body-sm text-muted-foreground">
          {t('ninguno')}
        </p>
      ) : (
        <ul aria-label={t('conectados')} className="flex flex-col">
          {apps.map((app) => {
            const confirmOpen = confirming === app.clientId
            const busy = disconnecting === app.clientId
            const confirmId = `assistant-confirm-${app.clientId}`
            return (
              <li key={app.clientId} data-assistant={app.name}>
                <Collapsible open={removing !== app.clientId}>
                  <div className="pb-2">
                    <div className={cn('flex min-h-row items-center gap-3 rounded-[18px] px-4 transition-[background-color,border-radius] duration-300 ease-out motion-reduce:transition-none', confirmOpen ? 'rounded-b-none bg-foreground/[0.08]' : 'bg-foreground/[0.04]')}>
                      <span className="grid size-9 shrink-0 place-items-center rounded-full bg-foreground/[0.06] text-muted-foreground">
                        <Bot aria-hidden className="size-5" />
                      </span>
                      <div className="min-w-0 flex-1 py-2">
                        <p className="truncate text-body-lg font-medium text-foreground">{app.name}</p>
                        <p className="text-body-sm text-muted-foreground">
                          {t('conectadoEl', { fecha: format.dateTime(new Date(app.connectedAt), { day: 'numeric', month: 'short', timeZone }) })}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setConfirming(confirmOpen ? null : app.clientId)}
                        disabled={disabled || disconnecting != null}
                        aria-expanded={confirmOpen}
                        aria-controls={confirmId}
                        aria-label={t('desconectarApp', { app: app.name })}
                        className="pressable -mr-2 flex h-11 items-center rounded-full px-3 text-body-md font-medium text-destructive-ink transition-colors hover:bg-destructive/[0.08] disabled:opacity-50"
                      >
                        {t('desconectar')}
                      </button>
                    </div>
                    <Collapsible id={confirmId} open={confirmOpen}>
                      <div className="rounded-b-[18px] bg-foreground/[0.08] px-4 pb-4 pt-1">
                        <p className="text-body-lg font-semibold text-foreground">{t('desconectarTitulo', { app: app.name })}</p>
                        <p className="mt-1 text-body-sm text-muted-foreground">{t('desconectarDetalle', { app: app.name })}</p>
                        {failed === app.clientId ? (
                          <p role="alert" className="mt-2 text-body-sm font-medium text-destructive-ink">
                            {t('errorDesconectar')}
                          </p>
                        ) : null}
                        <div className="mt-4 flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setConfirming(null)}
                            disabled={busy}
                            className="pressable flex h-11 items-center justify-center rounded-[16px] px-4 text-body-md font-medium text-foreground transition-colors hover:bg-foreground/[0.06] disabled:opacity-50"
                          >
                            {t('desconectarCancelar')}
                          </button>
                          <button
                            type="button"
                            onClick={() => void disconnect(app)}
                            disabled={busy}
                            aria-busy={busy || undefined}
                            className={cn(
                              'relative flex h-11 flex-1 items-center justify-center overflow-hidden whitespace-nowrap bg-foreground text-body-md font-semibold text-background transition-[flex,width,border-radius,scale] duration-300 ease-out focus-visible:outline-2 focus-visible:outline-offset-2 active:scale-[0.98] disabled:opacity-100 motion-reduce:transition-none',
                              busy ? 'w-11 flex-none rounded-[22px]' : 'rounded-[16px]',
                            )}
                          >
                            <span className={cn('transition-opacity duration-150 motion-reduce:transition-none', busy && 'opacity-0')}>{t('desconectarConfirmar')}</span>
                            {busy ? <Loader2 aria-hidden className="absolute inset-0 m-auto size-5 animate-spin" /> : null}
                          </button>
                        </div>
                      </div>
                    </Collapsible>
                  </div>
                </Collapsible>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
