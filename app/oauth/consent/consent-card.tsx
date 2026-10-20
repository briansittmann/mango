"use client";

import { useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { BadgeCheck, Eye, Loader2, PencilLine, ShieldX, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { hostKind } from "@/lib/mcp/hosts";
import { cn } from "@/lib/utils";
import { decideAuthorization } from "./actions";

const SCOPE_KEYS = {
  openid: "scopeOpenid",
  email: "scopeEmail",
  profile: "scopeProfile",
  phone: "scopePhone",
  offline_access: "scopeOfflineAccess",
} as const;

/**
 * The consent card (add-mcp-server D9): who asks, where it returns, which Mango account, what it can
 * do, and "Permitir" / "Cancelar". The host is shown because a registered name is self-declared:
 * claude.ai and chatgpt.com read as verified, this computer as a local app, and any other host gets
 * a warning at the top of the card (harden-security D5).
 * One answer at a time: the chosen button folds into a spinner and both ignore further presses.
 */
export function ConsentCard({
  authorizationId,
  clientName,
  host,
  email,
  scopes,
}: {
  authorizationId: string;
  clientName: string;
  host: string;
  email: string;
  scopes: string[];
}) {
  const t = useTranslations("mcp.consentimiento");
  const [pending, setPending] = useState<"allow" | "deny" | null>(null);
  const [failed, setFailed] = useState(false);
  const busy = useRef(false);

  const decide = async (approve: boolean) => {
    if (busy.current) return;
    busy.current = true;
    setFailed(false);
    setPending(approve ? "allow" : "deny");
    // On success the action redirects away; it only returns when it failed.
    const result = await decideAuthorization(authorizationId, approve).catch(() => ({ ok: false as const }));
    if (!result.ok) {
      busy.current = false;
      setPending(null);
      setFailed(true);
    }
  };

  const kind = hostKind(host);
  const strong = (chunks: React.ReactNode) => <strong className="font-medium text-foreground">{chunks}</strong>;
  const shared = scopes.map((scope) => (Object.hasOwn(SCOPE_KEYS, scope) ? t(SCOPE_KEYS[scope as keyof typeof SCOPE_KEYS]) : scope));

  return (
    <div className="consent-enter flex flex-col gap-stack rounded-card border border-border bg-card px-5 pt-7 pb-5">
      {/* eslint-disable-next-line @next/next/no-img-element -- a static SVG, no optimisation to gain */}
      <img src="/mango-logo-dark.svg" alt="" className="mx-auto size-14" />
      <div className="flex flex-col gap-2 text-center">
        <h1 className="text-headline-md">{t("titulo", { app: clientName })}</h1>
        <p className="text-body-md text-muted-foreground">{t.rich(kind === "local" ? "appLocal" : "vuelveA", { host, strong })}</p>
        {kind === "known" && (
          <p className="flex items-center justify-center gap-1.5 text-body-sm font-medium text-brand-ink">
            <BadgeCheck aria-hidden className="size-4 shrink-0" />
            {t("verificado")}
          </p>
        )}
      </div>

      {kind === "unknown" && (
        <p data-consent-warning className="flex gap-3 rounded-lg border border-warning/40 bg-warning/10 px-3 py-2.5 text-body-md">
          <TriangleAlert aria-hidden className="mt-0.5 size-5 shrink-0 text-warning-ink" />
          <span>{t.rich("aviso", { host, strong })}</span>
        </p>
      )}

      <dl className="rounded-lg bg-muted px-3 py-2 text-body-sm">
        <dt className="text-muted-foreground">{t("cuenta")}</dt>
        <dd className="truncate font-medium">{email}</dd>
      </dl>

      <ul className="flex flex-col gap-3 text-body-md">
        <Capability icon={Eye}>{t("puedeVer")}</Capability>
        <Capability icon={PencilLine}>{t("puedeCambiar")}</Capability>
        <Capability icon={ShieldX}>{t("nunca")}</Capability>
      </ul>

      {shared.length > 0 && <p className="text-body-sm text-muted-foreground">{t("comparte", { datos: shared.join(" · ") })}</p>}
      <p className="text-body-sm text-muted-foreground">{t("desconectar")}</p>

      {failed && (
        <p role="alert" className="text-body-sm text-destructive">
          {t("error")}
        </p>
      )}

      <div className="flex flex-col gap-2">
        <DecisionButton label={t("permitir")} pending={pending === "allow"} disabled={pending !== null} onClick={() => decide(true)} />
        <DecisionButton label={t("cancelar")} variant="ghost" pending={pending === "deny"} disabled={pending !== null} onClick={() => decide(false)} />
      </div>
    </div>
  );
}

function Capability({ icon: Icon, children }: { icon: typeof Eye; children: React.ReactNode }) {
  return (
    <li className="flex gap-3">
      <Icon aria-hidden className="mt-0.5 size-5 shrink-0 text-brand-ink" />
      <span>{children}</span>
    </li>
  );
}

/** The same fold into a round spinner as "Enviar código"; aria-disabled so it keeps its colour. */
function DecisionButton({
  label,
  variant = "default",
  pending,
  disabled,
  onClick,
}: {
  label: string;
  variant?: "default" | "ghost";
  pending: boolean;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <div className="flex justify-center">
      <Button
        type="button"
        size="lg"
        variant={variant}
        aria-disabled={disabled || undefined}
        aria-busy={pending || undefined}
        onClick={onClick}
        className={cn(
          "relative h-target overflow-hidden text-body-lg font-semibold transition-[width,border-radius,scale] duration-300 ease-out active:scale-95 motion-reduce:transition-none",
          pending ? "w-target rounded-full" : "w-full",
        )}
      >
        <span className={cn("transition-opacity duration-150 motion-reduce:transition-none", pending && "opacity-0")}>{label}</span>
        <Loader2
          aria-hidden
          className={cn(
            "absolute inset-0 m-auto size-5 animate-spin transition-opacity duration-200 motion-reduce:transition-none",
            pending ? "opacity-100 delay-150" : "opacity-0",
          )}
        />
      </Button>
    </div>
  );
}
