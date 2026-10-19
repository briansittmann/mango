import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { ForceDarkTheme } from "@/components/theme/force-dark-theme";
import { StarBorder } from "@/components/ui/star-border";
import { safeNext } from "@/lib/auth/next";
import { supabaseServer } from "@/lib/supabase/server";
import { LoginSteps } from "./login-steps";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("metadatos");
  return { title: t("tituloLogin"), robots: { index: false, follow: false } };
}

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const { error, email, next: nextParam } = await searchParams;
  // Where to land after signing in, only a path on this origin (`web-access` → *Sign-in returns to where it was sent from*).
  const next = safeNext(nextParam);

  const supabase = await supabaseServer();
  const { data } = await supabase.auth.getClaims();
  if (data?.claims) redirect(next ?? "/dashboard");

  const address = typeof email === "string" && email.includes("@") ? email : null;

  return (
    <main className="vivid-background flex flex-1 flex-col items-center justify-center gap-6 px-4">
      <ForceDarkTheme />
      <StarBorder className="w-full max-w-sm">
        <LoginSteps initialEmail={address} linkError={error === "enlace"} googleError={error === "google"} next={next} />
      </StarBorder>
    </main>
  );
}
