import { randomUUID } from "node:crypto";

import { Client } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { migrateDown, migrateUp } from "./migrator.js";

const databaseUrl =
  process.env.DATABASE_URL ??
  "postgresql://hansa_field:change-me-local-only@localhost:5434/hansa_field";
const schema = `test_${randomUUID().replaceAll("-", "")}`;
const client = new Client({ connectionString: databaseUrl });
let schemaCreated = false;

describe("foundation database migration", () => {
  beforeAll(async () => {
    await client.connect();
    await client.query(`CREATE SCHEMA "${schema}"`);
    schemaCreated = true;
    await client.query(`SET search_path TO "${schema}", public`);
  });

  afterAll(async () => {
    if (schemaCreated) {
      await client.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
    }
    await client.end();
  });

  it("creates versioned apps and spatial records with essential constraints", async () => {
    await migrateUp(client);

    const tables = await client.query<{ table_name: string }>(
      `SELECT table_name FROM information_schema.tables
       WHERE table_schema = $1 ORDER BY table_name`,
      [schema],
    );
    expect(tables.rows.map(({ table_name }) => table_name)).toEqual([
      "app_definitions",
      "app_versions",
      "hansa_field_migrations",
      "project_apps",
      "projects",
      "records",
    ]);

    const app = await client.query<{ id: string }>(
      `INSERT INTO app_definitions (code, name, allowed_geometries)
       VALUES ('POSTES', 'Postes', ARRAY['Point']) RETURNING id`,
    );
    const appId = app.rows[0]?.id;
    const project = await client.query<{ id: string }>(
      `INSERT INTO projects (code, name) VALUES ('LPZ_FTTH', 'La Paz FTTH') RETURNING id`,
    );
    await expect(
      client.query(
        `INSERT INTO project_apps (project_id, app_id) VALUES ($1, $2)`,
        [project.rows[0]?.id, appId],
      ),
    ).resolves.toBeDefined();
    const version = await client.query<{ id: string }>(
      `INSERT INTO app_versions (app_id, version, schema_definition)
       VALUES ($1, 1, '{"fields": []}') RETURNING id`,
      [appId],
    );

    const record = await client.query<{ id: string; geometry_type: string }>(
      `INSERT INTO records (app_id, app_version_id, attributes, geometry)
       VALUES ($1, $2, '{"status":"nuevo"}', ST_SetSRID(ST_Point(-68.15, -16.5), 4326))
       RETURNING id, GeometryType(geometry) AS geometry_type`,
      [appId, version.rows[0]?.id],
    );
    expect(record.rows[0]?.id).toMatch(/^[0-9a-f-]{36}$/);
    expect(record.rows[0]?.geometry_type).toBe("POINT");

    const remainingGeometryTypes = await client.query<{
      geometry_type: string;
    }>(
      `INSERT INTO records (app_id, app_version_id, geometry) VALUES
         ($1, $2, ST_GeomFromText('LINESTRING(-68.15 -16.5, -68.14 -16.49)', 4326)),
         ($1, $2, ST_GeomFromText('POLYGON((-68.15 -16.5, -68.14 -16.5, -68.14 -16.49, -68.15 -16.5))', 4326))
       RETURNING GeometryType(geometry) AS geometry_type`,
      [appId, version.rows[0]?.id],
    );
    expect(
      remainingGeometryTypes.rows.map(({ geometry_type }) => geometry_type),
    ).toEqual(["LINESTRING", "POLYGON"]);

    const indexes = await client.query<{ indexname: string }>(
      `SELECT indexname FROM pg_indexes
       WHERE schemaname = $1 AND tablename = 'records'`,
      [schema],
    );
    expect(indexes.rows.map(({ indexname }) => indexname)).toEqual(
      expect.arrayContaining([
        "records_geometry_gix",
        "records_attributes_gin",
      ]),
    );

    await expect(
      client.query(
        `INSERT INTO records (app_id, app_version_id, geometry)
         VALUES ($1, $2, ST_SetSRID(ST_Point(0, 0), 3857))`,
        [appId, version.rows[0]?.id],
      ),
    ).rejects.toMatchObject({ code: "22023" });
  });

  it("rolls the foundation back in a controlled way", async () => {
    await migrateDown(client);
    const result = await client.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM information_schema.tables
       WHERE table_schema = $1`,
      [schema],
    );
    expect(result.rows[0]?.count).toBe("0");
  });
});
