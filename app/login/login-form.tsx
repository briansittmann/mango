"use client";

import { useActionState, useEffect, useLayoutEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { gsap } from "gsap";
import { Loader2, Mail } from "lucide-react";
import { useDarkTheme } from "@/components/theme/dynamic-background";
import { GoogleG } from "@/components/atoms/google-g";
import { GlassBackButton } from "@/components/molecules/theme-pill";
import { Button } from "@/components/ui/button";
import ElectricLogo from "@/components/ui/electric-logo";
import { cn } from "@/lib/utils";
import type { RequestCodeResult } from "@/app/auth/request-code/route";
import { sendCode, startGoogle } from "./request-code";

type RequestCodeState = RequestCodeResult | { status: "idle"; email?: undefined };

// How a piece leaves the card: it softens, drops a little and fades, quicker than it came in.
const EXIT = { opacity: 0, y: 10, scale: 0.97, filter: "blur(6px)", duration: 0.28, ease: "power2.in" } as const;

const reducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** Brings back the pieces that left for Google, and the button to its place, when the sign-in did not go through. */
function restore(form: HTMLFormElement) {
  gsap.to(form.querySelectorAll(":scope > [data-not-google]"), { opacity: 1, y: 0, scale: 1, filter: "blur(0px)", duration: 0.35, ease: "power3.out", stagger: 0.04, clearProps: "opacity,transform,filter" });
  gsap.to(form.querySelector(":scope > [data-google-slot]"), { y: 0, duration: 0.35, ease: "power3.out", clearProps: "transform" });
}

const middle = (element: Element) => {
  const box = element.getBoundingClientRect();
  return box.top + box.height / 2;
};

/** The e-mail step: requests the code and hands the address to `LoginSteps` once it is `sent`. */
export function LoginForm({
  linkError,
  googleError,
  defaultEmail,
  onSent,
}: {
  linkError: boolean;
  googleError: boolean;
  defaultEmail?: string;
  onSent: (email: string) => void;
}) {
  const t = useTranslations("acceso");
  const router = useRouter();
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

  // "idle" until the button is used; "pending" while the redirect is prepared and the page leaves.
  const [google, setGoogle] = useState<"idle" | "pending" | "error">("idle");
  const googlePending = useRef(false);
  const onGoogle = async () => {
    if (googlePending.current) return;
    googlePending.current = true;
    setGoogle("pending");
    // The way not taken leaves while the button folds into its spinner and glides to where the "o"
    // was, the middle of the space the two ways leave.
    const form = formRef.current!;
    if (!reducedMotion()) {
      gsap.to(form.querySelectorAll(":scope > [data-not-google]"), { ...EXIT, stagger: 0.04 });
      const slot = form.querySelector(":scope > [data-google-slot]")!;
      const divider = form.querySelector(":scope > [data-divider]")!;
      gsap.to(slot, { y: middle(divider) - middle(slot), duration: 0.45, delay: 0.05, ease: "power3.inOut" });
    }
    const url = await startGoogle(locale);
    if (url) {
      window.location.assign(url);
      return;
    }
    googlePending.current = false;
    setGoogle("error");
    restore(form);
  };
  // Back from Google's screen, Safari and Firefox restore the page from the bfcache still pending.
  useEffect(() => {
    const onShow = (event: PageTransitionEvent) => {
      if (!event.persisted) return;
      googlePending.current = false;
      setGoogle("idle");
      restore(formRef.current!);
    };
    window.addEventListener("pageshow", onShow);
    return () => window.removeEventListener("pageshow", onShow);
  }, []);

  // Two ways in: Google, or "Continuar con email", which swaps them for the e-mail field. Coming
  // back from the code step ("Cambiar mail") opens straight on the field.
  const [mode, setMode] = useState<"choose" | "email">(defaultEmail ? "email" : "choose");
  // The mode the entrance last ran for: in development React runs the effect twice on mount, and
  // only a real change of mode is a switch.
  const shownMode = useRef<"choose" | "email" | null>(null);
  const switching = useRef(false);
  const heightBefore = useRef<number | null>(null);

  // The pieces of the way shown leave (blur, drop and fade, in order), then the card resizes to the
  // other way's pieces while they rise in.
  const switchTo = (next: "choose" | "email") => {
    if (switching.current || googlePending.current) return;
    const form = formRef.current!;
    if (reducedMotion()) return setMode(next);
    switching.current = true;
    gsap.to(form.querySelectorAll(":scope > [data-step]"), {
      ...EXIT,
      stagger: 0.04,
      onComplete: () => {
        heightBefore.current = form.offsetHeight;
        switching.current = false;
        setMode(next);
      },
    });
  };

  // Entrance, as the code step's: each piece rises into focus after the one above it. The logo
  // lights up on its own. Switching to the e-mail field replays it for the new pieces only.
  useLayoutEffect(() => {
    const media = gsap.matchMedia(formRef);
    const switched = shownMode.current !== null && shownMode.current !== mode;
    shownMode.current = mode;
    // From here the tween holds them hidden, not the stylesheet (`.login-enter`).
    formRef.current!.dataset.entered = "";
    if (switched) formRef.current!.querySelector<HTMLElement>(mode === "email" ? "#email" : "[data-google]")?.focus();
    media.add("(prefers-reduced-motion: no-preference)", () => {
      const form = formRef.current!;
      if (heightBefore.current !== null) {
        gsap.fromTo(form, { height: heightBefore.current, overflow: "hidden" }, { height: form.offsetHeight, duration: 0.45, ease: "power3.out", clearProps: "height,overflow" });
        heightBefore.current = null;
      }
      const pieces = switched ? form.querySelectorAll(":scope > [data-step]") : [...form.children].filter((child) => !child.hasAttribute("data-logo") && !child.hasAttribute("data-back"));
      gsap.from(pieces, {
        opacity: 0,
        y: 14,
        filter: "blur(8px)",
        duration: 0.55,
        ease: "power3.out",
        stagger: 0.08,
        delay: switched ? 0.08 : 0.1,
        clearProps: "opacity,transform,filter",
      });
    });
    return () => media.revert();
  }, [mode]);

  return (
    <form ref={formRef} action={formAction} className="login-enter flex w-full max-w-sm flex-col gap-stack rounded-card border border-border bg-card px-5 pt-7 pb-5">
      <span data-back>
        <GlassBackButton label={t("volver")} onClick={() => (mode === "email" ? switchTo("choose") : router.push("/"))} />
      </span>
      <h1 className="mb-6 text-center text-headline-lg">{t("titulo")}</h1>
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
      {mode === "choose" && (
        <>
          {/* Google's dark button (add-google-login D5) on the card's own surface, so it does not read
              as a block; border and label are Google's values. mt-8 gives back the room the logo's
              negative margin takes. */}
          <div data-step data-google-slot className="mt-8 flex justify-center">
            <Button
              data-google
              type="button"
              variant="ghost"
              size="lg"
              aria-disabled={google === "pending" || undefined}
              aria-busy={google === "pending" || undefined}
              onClick={onGoogle}
              className={cn(
                "relative h-target overflow-hidden border-[#8E918F] bg-card text-body-lg font-medium text-[#E3E3E3] transition-[width,border-radius,scale,background-color] duration-300 ease-out hover:bg-foreground/5 hover:text-[#E3E3E3] active:scale-95 motion-reduce:transition-none dark:hover:bg-foreground/5",
                google === "pending" ? "w-target rounded-full" : "w-full",
              )}
            >
              <span className={cn("flex items-center gap-3 transition-opacity duration-150 motion-reduce:transition-none", google === "pending" && "opacity-0")}>
                <GoogleG />
                {t("continuarConGoogle")}
              </span>
              <Loader2
                aria-hidden
                className={cn(
                  "absolute inset-0 m-auto size-5 animate-spin transition-opacity duration-200 motion-reduce:transition-none",
                  google === "pending" ? "opacity-100 delay-150" : "opacity-0",
                )}
              />
            </Button>
          </div>
          <div data-step data-not-google data-divider aria-hidden className="flex items-center gap-3 text-body-sm text-muted-foreground">
            <span className="h-px flex-1 bg-border" />
            {t("o")}
            <span className="h-px flex-1 bg-border" />
          </div>
          <div data-step data-not-google className="flex justify-center">
            <Button
              type="button"
              size="lg"
              onClick={() => switchTo("email")}
              className="h-target w-full gap-3 text-body-lg font-semibold transition-[scale] duration-300 ease-out active:scale-95 motion-reduce:transition-none"
            >
              <Mail aria-hidden className="size-5" />
              {t("continuarConEmail")}
            </Button>
          </div>
        </>
      )}
      {mode === "email" && (
        <>
          <label data-step htmlFor="email" className="text-label-ui text-muted-foreground">
            {t("email")}
          </label>
          <input
            data-step
            id="email"
            name="email"
            type="email"
            required
            autoComplete="email"
            defaultValue={defaultEmail}
            className="field-focus h-target rounded-lg bg-muted px-3 text-body-lg text-foreground outline-none"
          />
          <p data-step className="text-body-sm text-muted-foreground">{t("primeraVez")}</p>
          {/* While the code is requested the button folds into a round spinner, as "Ir a mi mes" does
              on the code step; aria-disabled rather than disabled so it keeps its colour. */}
          <div data-step className="flex justify-center">
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
        </>
      )}
      {state.status === "error" && <p role="alert" className="text-body-sm text-destructive-ink">{t("errorEnvio")}</p>}
      {state.status === "rate_limited" && <p role="alert" className="text-body-sm text-destructive-ink">{t("demasiadosPedidos")}</p>}
      {state.status === "idle" && linkError && <p role="alert" className="text-body-sm text-destructive-ink">{t("enlaceInvalido")}</p>}
      {(google === "error" || (google === "idle" && state.status === "idle" && googleError)) && (
        <p role="alert" className="text-body-sm text-destructive-ink">
          {t("errorGoogle")}
        </p>
      )}
    </form>
  );
}
