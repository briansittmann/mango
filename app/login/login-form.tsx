"use client";

import { useActionState, useEffect } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { RequestCodeResult } from "@/app/auth/request-code/route";
import { sendCode } from "./request-code";

type RequestCodeState = RequestCodeResult | { status: "idle"; email?: undefined };

/** The e-mail step: requests the code and hands the address to `LoginSteps` once it is `sent`. */
export function LoginForm({ linkError, defaultEmail, onSent }: { linkError: boolean; defaultEmail?: string; onSent: (email: string) => void }) {
  const t = useTranslations("acceso");
  const locale = useLocale();
  const [state, formAction, pending] = useActionState<RequestCodeState, FormData>(
    (_prev, formData) => sendCode(String(formData.get("email") ?? ""), locale),
    { status: "idle" },
  );

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
      <p className="text-body-sm text-muted-foreground">{t("primeraVez")}</p>
      {/* While the code is requested the button folds into a round spinner, as "Ir a mi mes" does
          on the code step; aria-disabled rather than disabled so it keeps its colour. */}
      <div className="flex justify-center">
        <Button
          type="submit"
          size="lg"
          aria-disabled={pending || undefined}
          aria-busy={pending || undefined}
          onClick={(event) => {
            if (pending) event.preventDefault();
          }}
          className={cn(
            "relative h-target overflow-hidden text-body-lg font-semibold transition-[width,border-radius,scale] duration-300 ease-out active:scale-95 motion-reduce:transition-none",
            pending ? "w-target rounded-full" : "w-full",
          )}
        >
          <span className={cn("transition-opacity duration-150 motion-reduce:transition-none", pending && "opacity-0")}>{t("enviarCodigo")}</span>
          <Loader2
            aria-hidden
            className={cn("absolute inset-0 m-auto size-5 animate-spin transition-opacity duration-200 motion-reduce:transition-none", pending ? "opacity-100 delay-150" : "opacity-0")}
          />
        </Button>
      </div>
      {state.status === "error" && <p role="alert" className="text-body-sm text-destructive-ink">{t("errorEnvio")}</p>}
      {state.status === "rate_limited" && <p role="alert" className="text-body-sm text-destructive-ink">{t("demasiadosPedidos")}</p>}
      {state.status === "idle" && linkError && <p role="alert" className="text-body-sm text-destructive-ink">{t("enlaceInvalido")}</p>}
    </form>
  );
}
