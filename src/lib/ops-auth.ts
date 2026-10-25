import { timingSafeEqual } from "node:crypto";

// Bearer token for the AI operations API (/api/ops/*). It is separate from CRON_SECRET, so a
// leaked cron token cannot write proposals, and the reverse is true too.
export type OpsAuth = "ok" | "unauthorized" | "not_configured";

export function checkOpsToken(authorization: string | null, expected: string | undefined): OpsAuth {
  if (!expected) return "not_configured";
  if (!authorization?.startsWith("Bearer ")) return "unauthorized";

  const given = Buffer.from(authorization.slice("Bearer ".length));
  const wanted = Buffer.from(expected);
  if (given.length !== wanted.length) return "unauthorized";
  return timingSafeEqual(given, wanted) ? "ok" : "unauthorized";
}
