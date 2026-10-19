"use server";

import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";

/**
 * "Permitir" / "Cancelar" on the consent page (add-mcp-server D9): approves or denies the request as
 * the signed-in person and sends the browser back to the assistant, with a code or `access_denied`.
 * A failure comes back as a value, so the page can say it and let them try again.
 */
export async function decideAuthorization(authorizationId: string, approve: boolean): Promise<{ ok: false }> {
  const supabase = await supabaseServer();
  const options = { skipBrowserRedirect: true };
  const { data, error } = approve
    ? await supabase.auth.oauth.approveAuthorization(authorizationId, options)
    : await supabase.auth.oauth.denyAuthorization(authorizationId, options);
  if (error || !data?.redirect_url) return { ok: false };
  redirect(data.redirect_url);
}
