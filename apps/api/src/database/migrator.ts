import type { Client, PoolClient } from "pg";

import { migrations } from "./migrations.js";

type MigrationClient = Client | PoolClient;

async function ensureMigrationTable(client: MigrationClient): Promise<void> {
  await client.query(`
    CREATE TABLE IF NOT EXISTS hansa_field_migrations (
      id text PRIMARY KEY,
      applied_at timestamptz NOT NULL DEFAULT now()
    )
  `);
}

export async function migrateUp(client: MigrationClient): Promise<void> {
  await ensureMigrationTable(client);

  for (const migration of migrations) {
    const applied = await client.query(
      "SELECT 1 FROM hansa_field_migrations WHERE id = $1",
      [migration.id],
    );
    if (applied.rowCount) continue;

    await client.query("BEGIN");
    try {
      await client.query(migration.up);
      await client.query(
        "INSERT INTO hansa_field_migrations (id) VALUES ($1)",
        [migration.id],
      );
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    }
  }
}

export async function migrateDown(client: MigrationClient): Promise<void> {
  await ensureMigrationTable(client);

  for (const migration of [...migrations].reverse()) {
    const applied = await client.query(
      "SELECT 1 FROM hansa_field_migrations WHERE id = $1",
      [migration.id],
    );
    if (!applied.rowCount) continue;

    await client.query("BEGIN");
    try {
      await client.query(migration.down);
      await client.query("DELETE FROM hansa_field_migrations WHERE id = $1", [
        migration.id,
      ]);
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    }
  }

  await client.query("DROP TABLE IF EXISTS hansa_field_migrations");
}
