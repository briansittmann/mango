"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { CodeEntry } from "@/components/organisms/code-entry";
import { requestCode, verifyCode } from "./actions";
import { LoginForm } from "./login-form";

/**
 * `/login` is the e-mail step and `/login?email=` the code step (D1). The URL is replaced, not
 * navigated, so the step survives a reload and opening it never sends a code.
 */
export function LoginSteps({ initialEmail, linkError }: { initialEmail: string | null; linkError: boolean }) {
  const router = useRouter();
  const [email, setEmail] = useState(initialEmail);
  const [previous, setPrevious] = useState<string | undefined>(undefined);

  const onSent = useCallback((address: string) => {
    window.history.replaceState(null, "", `/login?email=${encodeURIComponent(address)}`);
    setEmail(address);
  }, []);

  if (!email) return <LoginForm linkError={linkError} defaultEmail={previous} onSent={onSent} />;

  return (
    <CodeEntry
      key={email}
      email={email}
      onVerify={async (token) => (await verifyCode({ email, token })).status}
      onResend={async () => {
        const data = new FormData();
        data.set("email", email);
        const { status } = await requestCode({ status: "idle" }, data);
        return status === "sent" ? "sent" : status === "rate_limited" ? "rate_limited" : "error";
      }}
      onChangeEmail={() => {
        window.history.replaceState(null, "", "/login");
        setPrevious(email);
        setEmail(null);
      }}
      onDone={() => router.push("/dashboard")}
    />
  );
}
