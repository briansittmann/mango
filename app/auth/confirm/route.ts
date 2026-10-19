import type { EmailOtpType } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { NextRequest } from "next/server";
import { decodeSignupPrefs, SIGNUP_PREFS_COOKIE } from "@/lib/auth/signup-prefs";
import { supabaseServer } from "@/lib/supabase/server";

/**
 * Target of the magic-link e-mail (D5) and of the return from Google (add-google-login D2). Shapes:
 * - `?token_hash=&type=` from a custom template: verified server-side, works in any browser
 * - `?code=` from Supabase's default template (no custom SMTP) or from Google: exchanged with the
 *   PKCE verifier cookie, so only in the browser that started it
 * - `?error=` when Google's consent was cancelled or failed
 *
 * The `mango-alta` cookie marks a sign-in started from the Google button: its failures read as
 * "Google did not work", not as a bad link, and its language and timezone reach a new account.
 */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const code = params.get("code");
  const tokenHash = params.get("token_hash");
  const type = params.get("type") as EmailOtpType | null;

  const cookieStore = await cookies();
  const signup = cookieStore.get(SIGNUP_PREFS_COOKIE);
  if (signup) cookieStore.delete({ name: SIGNUP_PREFS_COOKIE, path: "/auth" });

  // Where the Google sign-in was sent from (add-mcp-server D10): kept through a failure, used once.
  const prefs = decodeSignupPrefs(signup?.value);
  const next = prefs.next ? `&next=${encodeURIComponent(prefs.next)}` : "";

  if (params.has("error")) redirect(`/login?error=google${next}`);
  if (!code && !(tokenHash && type)) redirect("/login?error=enlace");

  const supabase = await supabaseServer();

  if (code) {
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) redirect(signup ? `/login?error=google${next}` : "/login?error=enlace");

    // Once, and only on an account whose onboarding has not started: a later sign-in from a page in
    // another language must not flip an existing account (D3).
    const { idioma, timezone } = prefs;
    if (idioma || timezone) {
      const { data: rows } = await supabase
        .from("usuarios")
        .update({ idioma, timezone })
        .eq("auth_user_id", data.user.id)
        .eq("onboarding_completo", false)
        .eq("onboarding_paso", 1)
        .select("id");
      // The code mail reads the language from the auth metadata, as the language switch keeps it.
      if (rows?.length && idioma) await supabase.auth.updateUser({ data: { idioma } });
    }
    redirect(prefs.next ?? "/dashboard");
  }

  const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash!, type: type! });
  redirect(error ? "/login?error=enlace" : "/dashboard");
}
