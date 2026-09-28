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
