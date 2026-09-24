"use server";

import { headers } from "next/headers";
import { supabaseServer } from "@/lib/supabase/server";

export type SendMagicLinkState = { status: "idle" | "sent" | "error" };

/**
 * Sends the magic link without creating users (D5). An unknown address gets the same `sent`
 * answer as a known one, so the form never tells which e-mails have an account.
 */
export async function sendMagicLink(_prev: SendMagicLinkState, formData: FormData): Promise<SendMagicLinkState> {
  const email = formData.get("email");
  if (typeof email !== "string" || !email.includes("@")) return { status: "error" };

  // Supabase's default template (no custom SMTP) links to its own verify endpoint, which
  // redirects here with `?code=`; `/auth/confirm` exchanges it with the verifier cookie this
  // call sets, so the link works in the browser that requested it.
  const origin = (await headers()).get("origin");
  const supabase = await supabaseServer();
  const { error } = await supabase.auth.signInWithOtp({
    email: email.trim(),
    options: { shouldCreateUser: false, emailRedirectTo: origin ? `${origin}/auth/confirm` : undefined },
  });

  if (!error || error.code === "otp_disabled" || /signups not allowed/i.test(error.message)) return { status: "sent" };
  return { status: "error" };
}
