import { changeLanguage } from "@/app/actions/language";
import { LandingTemplate } from "@/components/templates/landing-template";

export default function Home() {
  return <LandingTemplate changeLanguage={changeLanguage} />;
}
