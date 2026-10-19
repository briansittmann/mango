import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/metadata";

// Public pages are open to every crawler, AI ones included; what sits behind a session, the auth
// handlers and the APIs are not pages to index (they also carry `noindex` or `X-Robots-Tag`).
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/dashboard", "/onboarding", "/oauth/", "/auth/", "/api/"] }],
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
