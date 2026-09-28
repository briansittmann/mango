"use client";

import { useActionState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { requestCode, type RequestCodeState } from "./actions";

/** The e-mail step: requests the code and hands the address to `LoginSteps` once it is `sent`. */
export function LoginForm({ linkError, defaultEmail, onSent }: { linkError: boolean; defaultEmail?: string; onSent: (email: string) => void }) {
  const t = useTranslations("acceso");
  const [state, formAction, pending] = useActionState<RequestCodeState, FormData>(requestCode, { status: "idle" });

  useEffect(() => {
    if (state.status === "sent" && state.email) onSent(state.email);
  }, [state, onSent]);

  return (
    <form action={formAction} className="flex w-full max-w-sm flex-col gap-stack rounded-card border border-border bg-card px-5 pt-7 pb-5">
      <h1 className="mb-2 text-center text-headline-lg">{t("titulo")}</h1>
      <label htmlFor="email" className="text-label-ui text-muted-foreground">
        {t("email")}
      </label>
      <input
        id="email"
        name="email"
        type="email"
        required
        autoComplete="email"
        defaultValue={defaultEmail}
        className="field-focus h-target rounded-lg bg-muted px-3 text-body-lg text-foreground outline-none"
      />
      <Button type="submit" size="lg" disabled={pending} className="h-target w-full text-body-lg font-semibold">
        {t("enviarCodigo")}
      </Button>
      {state.status === "error" && <p role="alert" className="text-body-sm text-destructive-ink">{t("errorEnvio")}</p>}
      {state.status === "rate_limited" && <p role="alert" className="text-body-sm text-destructive-ink">{t("demasiadosPedidos")}</p>}
      {state.status === "idle" && linkError && <p role="alert" className="text-body-sm text-destructive-ink">{t("enlaceInvalido")}</p>}
    </form>
  );
}
