import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { ForceDarkTheme } from "@/components/theme/force-dark-theme";
import { Button } from "@/components/ui/button";
import { StarBorder } from "@/components/ui/star-border";
import { findCurrentUsuario } from "@/lib/data/supabase/user";
import { supabaseServer } from "@/lib/supabase/server";
import { ConsentCard } from "./consent-card";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("mcp.consentimiento");
  return { title: t("tituloPagina"), robots: { index: false, follow: false } };
}

/**
 * Where Supabase Auth sends a person when Claude or ChatGPT asks to connect (`mcp-server` → *Consent
 * page*, add-mcp-server D9): session → request → account → the card with "Permitir" / "Cancelar".
 */
export default async function ConsentPage({ searchParams }: PageProps<"/oauth/consent">) {
  const t = await getTranslations("mcp.consentimiento");
  const { authorization_id } = await searchParams;
  const id = typeof authorization_id === "string" && authorization_id.length > 0 ? authorization_id : null;
  if (!id) return <Notice title={t("vencidoTitulo")} body={t("vencido")} />;

  const supabase = await supabaseServer();
  const { data: auth } = await supabase.auth.getClaims();
  if (!auth?.claims) {
    redirect(`/login?next=${encodeURIComponent(`/oauth/consent?authorization_id=${encodeURIComponent(id)}`)}`);
  }

  const { data, error } = await supabase.auth.oauth.getAuthorizationDetails(id);
  if (error || !data) return <Notice title={t("vencidoTitulo")} body={t("vencido")} />;
  // Already approved for this client: Supabase answers the redirect straight away.
  if (!("authorization_id" in data)) redirect(data.redirect_url);

  const usuario = await findCurrentUsuario(supabase);
  if (!usuario?.onboarding_completo) {
    return (
      <Notice title={t("sinTerminarTitulo")} body={t("sinTerminar")}>
        <Button render={<Link href="/onboarding" />} nativeButton={false} size="lg" className="h-target w-full text-body-lg font-semibold">
          {t("terminarConfiguracion")}
        </Button>
      </Notice>
    );
  }

  return (
    <Shell>
      <ConsentCard
        authorizationId={data.authorization_id}
        clientName={data.client.name || t("asistenteSinNombre")}
        host={hostOf(data.redirect_uri)}
        email={data.user.email}
        scopes={data.scope.split(" ").filter(Boolean)}
      />
    </Shell>
  );
}

function hostOf(uri: string): string {
  try {
    return new URL(uri).host;
  } catch {
    return uri;
  }
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="vivid-background flex flex-1 flex-col items-center justify-center gap-6 px-4 py-10">
      <ForceDarkTheme />
      <StarBorder className="w-full max-w-sm">{children}</StarBorder>
    </main>
  );
}

function Notice({ title, body, children }: { title: string; body: string; children?: React.ReactNode }) {
  return (
    <Shell>
      <div className="consent-enter flex flex-col gap-stack rounded-card border border-border bg-card px-5 pt-7 pb-5 text-center">
        {/* eslint-disable-next-line @next/next/no-img-element -- a static SVG, no optimisation to gain */}
        <img src="/mango-logo-dark.svg" alt="" className="mx-auto size-14" />
        <h1 className="text-headline-md">{title}</h1>
        <p className="text-body-md text-muted-foreground">{body}</p>
        {children}
      </div>
    </Shell>
  );
}
