import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { ForceDarkTheme } from "@/components/theme/force-dark-theme";
import { supabaseServer } from "@/lib/supabase/server";
import { LoginSteps } from "./login-steps";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("metadatos");
  return { title: t("tituloLogin"), robots: { index: false, follow: false } };
}

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const supabase = await supabaseServer();
  const { data } = await supabase.auth.getClaims();
  if (data?.claims) redirect("/dashboard");

  const { error, email } = await searchParams;
  const address = typeof email === "string" && email.includes("@") ? email : null;

  return (
    <main className="vivid-background flex flex-1 flex-col items-center justify-center gap-6 px-4">
      <ForceDarkTheme />
      <LoginSteps initialEmail={address} linkError={error === "enlace"} />
    </main>
  );
}
