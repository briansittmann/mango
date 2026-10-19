import type { GoogleStartResult } from "@/app/auth/google/route";
import type { RequestCodeResult } from "@/app/auth/request-code/route";

/** Posts to `/auth/request-code` with the page's language and the browser's timezone (D5). */
export async function sendCode(email: string, idioma: string): Promise<RequestCodeResult> {
  try {
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const response = await fetch("/auth/request-code", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email, idioma, timezone }) });
    if (!response.ok) return { status: "error" };
    return (await response.json()) as RequestCodeResult;
  } catch {
    return { status: "error" };
  }
}

/** Posts to `/auth/google` with the page's language, the browser's timezone and where to land after; the provider's URL, or null. */
export async function startGoogle(idioma: string, next: string | null): Promise<string | null> {
  try {
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const response = await fetch("/auth/google", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ idioma, timezone, ...(next && { next }) }) });
    if (!response.ok) return null;
    const result = (await response.json()) as GoogleStartResult;
    return result.status === "ok" ? result.url : null;
  } catch {
    return null;
  }
}
