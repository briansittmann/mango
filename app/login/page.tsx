import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { supabaseServer } from "@/lib/supabase/server";
import { LoginForm } from "./login-form";

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const supabase = await supabaseServer();
  const { data } = await supabase.auth.getClaims();
  if (data?.claims) redirect("/dashboard");

  const t = await getTranslations("acceso");
  const { error } = await searchParams;

  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-6 px-4">
      <h1 className="text-2xl font-semibold tracking-tight">{t("titulo")}</h1>
      <LoginForm linkError={error === "enlace"} />
    </main>
  );
}
