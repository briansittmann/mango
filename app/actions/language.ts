"use server";

import { cookies } from "next/headers";
import { supabaseServer } from "@/lib/supabase/server";

const LOCALES = ["es", "en"] as const;
type Locale = (typeof LOCALES)[number];

function isLocale(value: string): value is Locale {
  return LOCALES.includes(value as Locale);
}

export async function changeLanguage(locale: string) {
  if (!isLocale(locale)) return;

  const cookieStore = await cookies();
  cookieStore.set("locale", locale, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
  });

  // Signed in, the code mail follows the last language chosen here (open-web-signup D7). The
  // page must switch even if this fails, so errors are only logged.
  try {
    const supabase = await supabaseServer();
    const { data } = await supabase.auth.getClaims();
    if (!data?.claims) return;
    const { error } = await supabase.auth.updateUser({ data: { idioma: locale } });
    if (error) console.error("changeLanguage: updateUser failed", error.message);
  } catch (error) {
    console.error("changeLanguage: updateUser failed", error);
  }
}
