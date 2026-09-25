import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";

// Child segments replace openGraph and twitter whole, so an indexable page that sets its own url rebuilds both here.
export async function socialMetadata(path: string, title?: string): Promise<Metadata> {
  const locale = await getLocale();
  const t = await getTranslations("metadatos");
  const fullTitle = title ? t("plantillaTitulo").replace("%s", title) : t("nombre");

  return {
    openGraph: {
      title: fullTitle,
      description: t("descripcion"),
      url: path,
      siteName: t("nombre"),
      locale: locale === "en" ? "en_US" : "es_ES",
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: fullTitle,
      description: t("descripcion"),
    },
  };
}
