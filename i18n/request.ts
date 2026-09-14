import { cookies } from "next/headers";
import { getRequestConfig } from "next-intl/server";

const LOCALES = ["es", "en"] as const;
type Locale = (typeof LOCALES)[number];

function esLocale(value: string | undefined): value is Locale {
  return LOCALES.includes(value as Locale);
}

export default getRequestConfig(async () => {
  const cookieStore = await cookies();
  const cookieLocale = cookieStore.get("locale")?.value;
  const locale = esLocale(cookieLocale) ? cookieLocale : "es";

  return {
    locale,
    timeZone: "UTC",
    messages: (await import(`../messages/${locale}.json`)).default,
  };
});
