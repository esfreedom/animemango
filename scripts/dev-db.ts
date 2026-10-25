// Local Postgres for development: PGlite served over the Postgres wire protocol.
// Usage: npm run db:dev, then set DATABASE_URL=postgresql://postgres@127.0.0.1:5433/postgres
import path from "node:path";
import { PGLiteSocketServer } from "@electric-sql/pglite-socket";
import { createPgliteDb } from "../src/db/test-db";

async function main() {
  const port = Number(process.env.DEV_DB_PORT ?? 5433);
  const dataDir = path.resolve(process.cwd(), ".pglite");

  const { client } = await createPgliteDb(dataDir);
  const server = new PGLiteSocketServer({ db: client, port, host: "127.0.0.1", maxConnections: 10 });
  await server.start();
  console.log(`PGlite listening on 127.0.0.1:${port} (data: ${dataDir})`);

  const shutdown = async () => {
    await server.stop();
    await client.close();
    process.exit(0);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
