import { randomUUID } from "node:crypto";
import { Client } from "pg";
import { it, expect } from "vitest";
import { migrateUp, migrateDown } from "./migrator.js";
it("applies the neutral baseline idempotently and reverses it", async () => {
  const client = new Client({
    connectionString:
      process.env.DATABASE_URL ??
      "postgresql://hansa_field:change-me-local-only@localhost:5434/hansa_field",
  });
  const schema = `migration_${randomUUID().replaceAll("-", "")}`;
  await client.connect();
  try {
    await client.query(`CREATE SCHEMA "${schema}"`);
    await client.query(`SET search_path TO "${schema}",public`);
    await migrateUp(client);
    await migrateUp(client);
    const result = await client.query(
      "SELECT tablename FROM pg_tables WHERE schemaname=$1",
      [schema],
    );
    expect(result.rows.map((r) => r.tablename)).toEqual(
      expect.arrayContaining([
        "datasets",
        "templates",
        "records",
        "project_records",
        "import_jobs",
      ]),
    );
    await migrateDown(client);
    const remaining = await client.query(
      "SELECT tablename FROM pg_tables WHERE schemaname=$1",
      [schema],
    );
    expect(remaining.rows).toEqual([]);
  } finally {
    await client.query(`DROP SCHEMA "${schema}" CASCADE`);
    await client.end();
  }
});
