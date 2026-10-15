import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { changeLanguage } from "@/app/actions/language";
import { buildDemoBudgetRows, buildDemoData, buildDemoPlan, buildDemoRecurringDefinitions } from "@/lib/demo/demo-data";
import { socialMetadata } from "@/lib/metadata";
import { DemoDashboard } from "./demo-dashboard";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("metadatos");
  return { title: t("tituloDemo"), ...(await socialMetadata("/demo", t("tituloDemo"))) };
}

export default async function DemoPage() {
  const locale = (await getLocale()) as "es" | "en";
  const data = buildDemoData(locale);
  const recurringDefinitions = buildDemoRecurringDefinitions(locale);
  const budgetRows = buildDemoBudgetRows();
  const plan = buildDemoPlan(locale);

  return (
    <DemoDashboard data={data} recurringDefinitions={recurringDefinitions} budgetRows={budgetRows} plan={plan} changeLanguage={changeLanguage} />
  );
}
