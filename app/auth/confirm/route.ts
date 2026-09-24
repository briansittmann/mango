import type { EmailOtpType } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import type { NextRequest } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

/**
 * Target of the magic-link e-mail (D5). Two shapes:
 * - `?token_hash=&type=` from a custom template: verified server-side, works in any browser
 * - `?code=` from Supabase's default template (no custom SMTP): exchanged with the PKCE verifier
 *   cookie, so only in the browser that requested the link
 */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const code = params.get("code");
  const tokenHash = params.get("token_hash");
  const type = params.get("type") as EmailOtpType | null;

  if (!code && !(tokenHash && type)) redirect("/login?error=enlace");

  const supabase = await supabaseServer();
  const { error } = code
    ? await supabase.auth.exchangeCodeForSession(code)
    : await supabase.auth.verifyOtp({ token_hash: tokenHash!, type: type! });

  redirect(error ? "/login?error=enlace" : "/dashboard");
}
