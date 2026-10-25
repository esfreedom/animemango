import { is } from "drizzle-orm";
import { getTableConfig, PgTable } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";
import * as schema from "./schema";

const tableNames = (Object.values(schema) as unknown[])
  .filter((value): value is PgTable => is(value, PgTable))
  .map((table) => getTableConfig(table).name)
  .sort();

describe("database schema", () => {
  it("defines every table from DESIGN.md section 9 and the feature tables", () => {
    expect(tableNames).toEqual(
      [
        // DESIGN.md section 9
        "ai_draft",
        "anime",
        "anime_i18n",
        "availability_log",
        "comment",
        "comment_report",
        "episode",
        "episode_schedule_log",
        "platform",
        "platform_availability",
        "season_entry",
        "thread",
        "trailer",
        "users",
        // Added for phases P1 to P7
        "announcement",
        "anime_follow",
        "anime_vote",
        "notification",
        "official_channel",
        "takedown_request",
        "watch_order_entry",
      ].sort(),
    );
  });
});
