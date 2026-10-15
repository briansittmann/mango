import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";

/** The production origin: the pages' `metadataBase` and the bot's dashboard link. */
export const SITE_URL = "https://www.usemango.dev";

// Child segments replace openGraph and twitter whole, so an indexable page that sets its own url rebuilds both here.
// Link previews follow the URL, not a cookie: in English the url carries `?lang=en` (read by proxy.ts), so a
// crawler that follows og:url lands on the English page and image too.
export async function socialMetadata(path: string, title?: string): Promise<Metadata> {
  const locale = await getLocale();
  const t = await getTranslations("metadatos");
  const fullTitle = title ? t("plantillaTitulo").replace("%s", title) : t("nombre");
  const image = { url: `/og-${locale === "en" ? "en" : "es"}.jpg`, width: 1200, height: 630, alt: t("imagenAlt") };

  return {
    openGraph: {
      title: fullTitle,
      description: t("descripcion"),
      url: locale === "en" ? `${path}?lang=en` : path,
      siteName: t("nombre"),
      locale: locale === "en" ? "en_US" : "es_ES",
      type: "website",
      images: [image],
    },
    twitter: {
      card: "summary_large_image",
      title: fullTitle,
      description: t("descripcion"),
      images: [image],
    },
  };
}
