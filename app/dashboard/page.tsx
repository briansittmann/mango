import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { Button } from "@/components/ui/button";
import { resumenMensual } from "@/lib/data/supabase/dashboard";
import { findCurrentUsuario } from "@/lib/data/supabase/user";
import { supabaseServer } from "@/lib/supabase/server";
import { signOut } from "./actions";
import { SupabaseDashboard } from "./supabase-dashboard";

export default async function DashboardPage({ searchParams }: PageProps<"/dashboard">) {
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

  const { mes } = await searchParams;
  const { data, definitions } = await resumenMensual(client, usuario, mes);

  return <SupabaseDashboard data={data} definitions={definitions} />;
}
