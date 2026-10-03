import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Button } from "@/components/ui/button";
import { loadOnboardingData } from "@/lib/data/supabase/onboarding";
import { findCurrentUsuario } from "@/lib/data/supabase/user";
import { supabaseServer } from "@/lib/supabase/server";
import { signOut } from "@/app/dashboard/actions";
import { SupabaseOnboarding } from "./supabase-onboarding";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("onboarding");
  return { title: t("pasos.1"), robots: { index: false, follow: false } };
}

/** `/onboarding` (D1): session → row → completed accounts go to the dashboard → the pending step. */
export default async function OnboardingPage() {
  const client = await supabaseServer();
  const { data: auth } = await client.auth.getClaims();
  if (!auth?.claims) redirect("/login");

  const usuario = await findCurrentUsuario(client);
  if (!usuario) {
    const t = await getTranslations("acceso");
    return (
      <main className="flex flex-1 flex-col items-center justify-center gap-6 px-4 text-center">
        <p className="max-w-sm text-sm">{t("cuentaSinVincular")}</p>
        <form action={signOut}>
          <Button type="submit" variant="outline" size="lg">
            {t("cerrarSesion")}
          </Button>
        </form>
      </main>
    );
  }
  if (usuario.onboarding_completo) redirect("/dashboard");

  // The number people write to, digits only (`add-whatsapp-linking` D6); without it the closing
  // step shows the code with the line to send it by hand.
  const data = await loadOnboardingData(client, usuario, process.env.WHATSAPP_PHONE_NUMBER || null);

  return (
    <main className="flex flex-1 flex-col">
      <SupabaseOnboarding data={data} />
    </main>
  );
}
