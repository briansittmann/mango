import { getLocale } from "next-intl/server";
import { changeLanguage } from "@/app/actions/language";
import { DemoNotice } from "@/components/molecules/demo-notice";
import { DashboardTemplate } from "@/components/templates/dashboard-template";
import { buildDemoData } from "@/lib/demo/demo-data";

export default async function DemoPage() {
  const locale = (await getLocale()) as "es" | "en";
  const data = buildDemoData(locale);

  return (
    <DashboardTemplate
      data={data}
      actions={{ changeLanguage }}
      notice={<DemoNotice />}
    />
  );
}
