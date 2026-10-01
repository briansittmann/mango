"use client";

import { useActionState, useEffect, useLayoutEffect, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { gsap } from "gsap";
import { Loader2 } from "lucide-react";
import { useDarkTheme } from "@/components/theme/dynamic-background";
import { Button } from "@/components/ui/button";
import ElectricLogo from "@/components/ui/electric-logo";
import { cn } from "@/lib/utils";
import type { RequestCodeResult } from "@/app/auth/request-code/route";
import { sendCode } from "./request-code";

type RequestCodeState = RequestCodeResult | { status: "idle"; email?: undefined };

/** The e-mail step: requests the code and hands the address to `LoginSteps` once it is `sent`. */
export function LoginForm({ linkError, defaultEmail, onSent }: { linkError: boolean; defaultEmail?: string; onSent: (email: string) => void }) {
  const t = useTranslations("acceso");
  const locale = useLocale();
  const dark = useDarkTheme();
  const [charge, setCharge] = useState(0);
  const formRef = useRef<HTMLFormElement>(null);
  const [state, formAction, pending] = useActionState<RequestCodeState, FormData>(
    (_prev, formData) => sendCode(String(formData.get("email") ?? ""), locale),
    { status: "idle" },
  );

  useEffect(() => {
    if (state.status === "sent" && state.email) onSent(state.email);
  }, [state, onSent]);

  // Entrance, as the code step's: each piece rises into focus after the one above it. The logo
  // lights up on its own.
  useLayoutEffect(() => {
    const media = gsap.matchMedia(formRef);
    // From here the tween holds them hidden, not the stylesheet (`.login-enter`).
    formRef.current!.dataset.entered = "";
    media.add("(prefers-reduced-motion: no-preference)", () => {
      gsap.from([...formRef.current!.children].filter((child) => !child.hasAttribute("data-logo")), {
        opacity: 0,
        y: 14,
        filter: "blur(8px)",
        duration: 0.55,
        ease: "power3.out",
        stagger: 0.08,
        delay: 0.1,
        clearProps: "opacity,transform,filter",
      });
    });
    return () => media.revert();
  }, []);

  return (
    <form ref={formRef} action={formAction} className="login-enter flex w-full max-w-sm flex-col gap-stack rounded-card border border-border bg-card px-5 pt-7 pb-5">
      <h1 className="mb-2 text-center text-headline-lg">{t("titulo")}</h1>
      {/* The canvas fades out toward its edges: its glow and dithering would otherwise outline a box. */}
      <div data-logo className="-mx-5 -my-8 h-72 [mask-image:radial-gradient(closest-side,black_70%,transparent)]">
        <ElectricLogo
          src="/mango-logo-dark.svg"
          color="#84CC16"
          glowColor="#5CBC0F"
          theme={dark ? "dark" : "light"}
          charge={charge}
          scale={0.7}
          intensity={0.9}
        />
      </div>
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
            // Sending charges the mango: the same surge as pressing it.
            else if (event.currentTarget.form?.checkValidity()) setCharge((count) => count + 1);
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
