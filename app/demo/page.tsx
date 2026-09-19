import { getLocale } from "next-intl/server";
import { changeLanguage } from "@/app/actions/language";
import { buildDemoData, buildDemoRecurringDefinitions } from "@/lib/demo/demo-data";
import { DemoDashboard } from "./demo-dashboard";

export default async function DemoPage() {
  const locale = (await getLocale()) as "es" | "en";
  const data = buildDemoData(locale);
  const recurringDefinitions = buildDemoRecurringDefinitions(locale);

  return <DemoDashboard data={data} recurringDefinitions={recurringDefinitions} changeLanguage={changeLanguage} />;
}
