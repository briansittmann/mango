import { changeLanguage } from "@/app/actions/language";
import { LandingTemplate } from "@/components/templates/landing-template";
import { ForceDarkTheme } from "@/components/theme/force-dark-theme";

export default function Home() {
  return (
    <>
      <ForceDarkTheme />
      <LandingTemplate changeLanguage={changeLanguage} />
    </>
  );
}
