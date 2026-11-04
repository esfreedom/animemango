import { defineCloudflareConfig } from "@opennextjs/cloudflare";

// Default OpenNext settings for Cloudflare Workers. The incremental cache stays off until a
// binding is added for it.
export default defineCloudflareConfig({});
