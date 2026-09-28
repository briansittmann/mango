"use server";

import { sendStatus, verifyStatus } from "@/lib/auth/otp-status";
import { supabaseServer } from "@/lib/supabase/server";

export type RequestCodeState = { status: "idle" | "sent" | "error" | "rate_limited"; email?: string };
export type VerifyCodeResult = { status: "ok" | "rejected" | "rate_limited" | "error" };

/**
 * Sends a 6-digit code without creating users (D2). An unknown address gets the same `sent`
 * answer as a known one, so the page never tells which e-mails have an account.
 */
export async function requestCode(_prev: RequestCodeState, formData: FormData): Promise<RequestCodeState> {
  const raw = formData.get("email");
  if (typeof raw !== "string" || !raw.includes("@")) return { status: "error" };
  const email = raw.trim();

  try {
    const supabase = await supabaseServer();
    const { error } = await supabase.auth.signInWithOtp({ email, options: { shouldCreateUser: false } });
    const status = sendStatus(error);
    return status === "sent" ? { status, email } : { status };
  } catch {
    return { status: "error" };
  }
}

/**
 * Checks the code (D2). On `ok` the session cookies are already written by `supabaseServer()`;
 * the page shows its success sequence before navigating. Never throws to the client.
 */
export async function verifyCode({ email, token }: { email: string; token: string }): Promise<VerifyCodeResult> {
  if (!email.includes("@") || !/^\d{6}$/.test(token)) return { status: "rejected" };
  try {
    const supabase = await supabaseServer();
    const { error } = await supabase.auth.verifyOtp({ email: email.trim(), token, type: "email" });
    return { status: verifyStatus(error) };
  } catch {
    return { status: "error" };
  }
}
