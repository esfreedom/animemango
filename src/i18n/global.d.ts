import type messages from "../../messages/th.json";

// Types translation keys from the Thai dictionary (the source of truth).
// The messages test checks that en and ja have the same keys.
declare module "next-intl" {
  interface AppConfig {
    Messages: typeof messages;
  }
}
