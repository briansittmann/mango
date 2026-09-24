"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { sendMagicLink, type SendMagicLinkState } from "./actions";

export function LoginForm({ linkError }: { linkError: boolean }) {
  const t = useTranslations("acceso");
  const [state, formAction, pending] = useActionState<SendMagicLinkState, FormData>(sendMagicLink, { status: "idle" });

  return (
    <form action={formAction} className="flex w-full max-w-sm flex-col gap-3">
      <label htmlFor="email" className="text-sm font-medium">
        {t("email")}
      </label>
      <input
        id="email"
        name="email"
        type="email"
        required
        autoComplete="email"
        className="h-9 rounded-lg border border-border bg-background px-3 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
      />
      <Button type="submit" size="lg" disabled={pending}>
        {t("enviarEnlace")}
      </Button>
      {state.status === "sent" && <p role="status" className="text-sm">{t("enlaceEnviado")}</p>}
      {state.status === "error" && <p role="alert" className="text-sm text-destructive">{t("errorEnvio")}</p>}
      {state.status === "idle" && linkError && <p role="alert" className="text-sm text-destructive">{t("enlaceInvalido")}</p>}
    </form>
  );
}
