import type { Metadata, ResolvingMetadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { changeLanguage } from "@/app/actions/language";
import { buildDemoBudgetRows, buildDemoData, buildDemoRecurringDefinitions } from "@/lib/demo/demo-data";
import { socialMetadata } from "@/lib/metadata";
import { DemoDashboard } from "./demo-dashboard";

export async function generateMetadata(_: PageProps<"/demo">, parent: ResolvingMetadata): Promise<Metadata> {
  const t = await getTranslations("metadatos");
  const { openGraph, twitter } = await socialMetadata("/demo", t("tituloDemo"));
  // Replacing openGraph and twitter drops the root opengraph-image, so carry it over.
  const inherited = await parent;
  return {
    title: t("tituloDemo"),
    openGraph: { ...openGraph, images: inherited.openGraph?.images },
    twitter: { ...twitter, images: inherited.twitter?.images },
  };
}

export default async function DemoPage() {
  const locale = (await getLocale()) as "es" | "en";
  const data = buildDemoData(locale);
  const recurringDefinitions = buildDemoRecurringDefinitions(locale);
  const budgetRows = buildDemoBudgetRows();

  return (
    <DemoDashboard data={data} recurringDefinitions={recurringDefinitions} budgetRows={budgetRows} changeLanguage={changeLanguage} />
  );
}
