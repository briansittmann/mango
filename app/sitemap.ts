import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/metadata";

// The indexable pages; `?lang=en` is the English version of `/` and `/demo` (proxy.ts).
export default function sitemap(): MetadataRoute.Sitemap {
  const page = (path: string, en?: boolean) => ({
    url: `${SITE_URL}${path}`,
    ...(en ? { alternates: { languages: { es: `${SITE_URL}${path}?lang=es`, en: `${SITE_URL}${path}?lang=en` } } } : {}),
  });
  return [page("/", true), page("/demo", true), page("/privacidad")];
}
