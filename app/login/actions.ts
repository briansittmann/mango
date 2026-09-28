"use server";

import { sendStatus } from "@/lib/auth/otp-status";
import { supabaseServer } from "@/lib/supabase/server";

export type RequestCodeState = { status: "idle" | "sent" | "error" | "rate_limited"; email?: string };

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
