import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";

// Where a person writes to get or delete their data. The address has to exist before this ships.
const CONTACT_EMAIL = "hola@usemango.dev";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("metadatos");
  return { title: t("tituloPrivacidad") };
}

export default async function PrivacyPage() {
  const t = await getTranslations("privacidad");
  const sections = t.raw("secciones") as { titulo: string; texto: string }[];

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-gutter pb-24 pt-10">
      <Link href="/" className="text-body-md text-muted-foreground transition-colors hover:text-foreground">
        ← {t("volver")}
      </Link>
      <h1 className="mt-10 font-display text-[36px] font-extrabold leading-[1.02] tracking-[-0.04em] text-foreground md:text-[48px]">{t("titulo")}</h1>
      <p className="mt-4 text-pretty text-body-lg text-muted-foreground">{t("intro")}</p>
      <p className="mt-2 text-body-sm text-muted-foreground">{t("actualizado")}</p>
      {sections.map((section) => (
        <section key={section.titulo} className="mt-10">
          <h2 className="font-display text-headline-md text-foreground">{section.titulo}</h2>
          <p className="mt-2 text-pretty text-body-lg text-muted-foreground">
            {section.texto.includes("{correo}")
              ? section.texto.split("{correo}").flatMap((part, index) =>
                  index === 0
                    ? [part]
                    : [
                        <a key={index} href={`mailto:${CONTACT_EMAIL}`} className="text-foreground underline underline-offset-4">
                          {CONTACT_EMAIL}
                        </a>,
                        part,
                      ],
                )
              : section.texto}
          </p>
        </section>
      ))}
    </main>
  );
}
