import { cookies, headers } from "next/headers";
import { getRequestConfig } from "next-intl/server";

const LOCALES = ["es", "en"] as const;
type Locale = (typeof LOCALES)[number];

function isLocale(value: string | undefined): value is Locale {
  return LOCALES.includes(value as Locale);
}

export default getRequestConfig(async () => {
  const cookieStore = await cookies();
  const cookieLocale = cookieStore.get("locale")?.value;
  // Without a chosen language, English unless the browser asks for Spanish first: the language
  // here is the one a new account keeps (mail, bot), so a Spanish speaker must not land in English.
  const browserLocale = (await headers()).get("accept-language")?.trim().toLowerCase().startsWith("es") ? "es" : "en";
  const locale = isLocale(cookieLocale) ? cookieLocale : browserLocale;

  return {
    locale,
    timeZone: "UTC",
    messages: (await import(`../messages/${locale}.json`)).default,
  };
});
