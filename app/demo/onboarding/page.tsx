import type { Metadata } from "next";
import { Suspense } from "react";
import { getTranslations } from "next-intl/server";
import { DemoOnboarding } from "./demo-onboarding";

// Unlinked and unindexed: the sandbox exists so the onboarding's specs run without a database.
export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("metadatos");
  return { title: t("tituloDemo"), robots: { index: false, follow: false } };
}

export default function DemoOnboardingPage() {
  return (
    <main className="flex flex-1 flex-col">
      <Suspense>
        <DemoOnboarding />
      </Suspense>
    </main>
  );
}
