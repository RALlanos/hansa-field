import { Client } from "pg";
import { migrateUp } from "./migrator.js";

const url = new URL(process.env.DATABASE_URL ?? "");
if (
  !["localhost", "127.0.0.1"].includes(url.hostname) ||
  url.port !== "5434" ||
  url.pathname !== "/hansa_field" ||
  process.argv[2] !== "--confirm-local-reset"
)
  throw new Error(
    "Reset restricted to explicitly confirmed local hansa_field database on port 5434.",
  );
const client = new Client({ connectionString: url.toString() });
await client.connect();
try {
  const identity = await client.query<{ name: string }>(
    "SELECT current_database() name",
  );
  if (identity.rows[0]?.name !== "hansa_field")
    throw new Error("Unexpected database.");
  await client.query("DROP SCHEMA public CASCADE; CREATE SCHEMA public");
  await migrateUp(client);
  await client.query(
    "INSERT INTO organizations(id,name) VALUES('00000000-0000-4000-8000-000000000001','Hansa Field Desarrollo')",
  );
  const result = await client.query(
    "SELECT PostGIS_Version() postgis,(SELECT count(*)::int FROM records) records,(SELECT count(*)::int FROM datasets) datasets",
  );
  process.stdout.write(JSON.stringify(result.rows[0]) + "\n");
} finally {
  await client.end();
}
