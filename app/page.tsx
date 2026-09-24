import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { buttonVariants } from "@/components/ui/button";

export default async function Home() {
  const t = await getTranslations("inicio");

  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-8 px-4">
      <h1 className="text-3xl font-semibold tracking-tight">{t("titulo")}</h1>
      <div className="flex gap-3">
        <Link href="/demo" className={buttonVariants({ variant: "outline", size: "lg" })}>
          {t("demo")}
        </Link>
        <Link href="/login" className={buttonVariants({ size: "lg" })}>
          {t("entrar")}
        </Link>
      </div>
    </main>
  );
}
