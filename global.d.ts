import type es from "./messages/es.json";

declare module "next-intl" {
  interface AppConfig {
    Messages: typeof es;
  }
}
