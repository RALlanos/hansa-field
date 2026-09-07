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

describe("project App foundation migration", () => {
  beforeAll(async () => {
    await client.connect();
    await client.query(`CREATE SCHEMA "${schema}"`);
    schemaCreated = true;
    await client.query(`SET search_path TO "${schema}", public`);
  });

  afterAll(async () => {
    if (schemaCreated)
      await client.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
    await client.end();
  });

  it("creates a project participation for every record", async () => {
    await migrateUp(client);
    const tables = await client.query<{ table_name: string }>(
      `SELECT table_name FROM information_schema.tables
       WHERE table_schema = $1 ORDER BY table_name`,
      [schema],
    );
    expect(tables.rows.map(({ table_name }) => table_name)).toEqual(
      expect.arrayContaining([
        "app_blocks",
        "block_template_members",
        "project_app_versions",
        "project_apps",
        "project_records",
        "records",
        "template_field_definitions",
      ]),
    );

    const template = await client.query<{ id: string }>(
      `INSERT INTO app_definitions (code, name, allowed_geometries)
       VALUES ('POSTES', 'Postes', ARRAY['Point']) RETURNING id`,
    );
    const templateId = template.rows[0]?.id;
    const version = await client.query<{ id: string }>(
      `INSERT INTO app_versions (app_id, version, schema_definition)
       VALUES ($1, 1, '{"sections": []}') RETURNING id`,
      [templateId],
    );
    const project = await client.query<{ id: string }>(
      `INSERT INTO projects (code, name) VALUES ('FTTH_A', 'FTTH A') RETURNING id`,
    );
    const projectApp = await client.query<{ id: string }>(
      `INSERT INTO project_apps (project_id, app_id, base_version_id)
       VALUES ($1, $2, $3) RETURNING id`,
      [project.rows[0]?.id, templateId, version.rows[0]?.id],
    );
    const record = await client.query<{ id: string }>(
      `INSERT INTO records (
         app_id, app_version_id, canonical_attributes, geometry, origin_project_app_id
       ) VALUES (
         $1, $2, '{"material":"Madera"}',
         ST_SetSRID(ST_Point(-68.15, -16.5), 4326), $3
       ) RETURNING id`,
      [templateId, version.rows[0]?.id, projectApp.rows[0]?.id],
    );
    await client.query(
      `INSERT INTO project_records (project_app_id, record_id, attributes_override)
       VALUES ($1, $2, '{"material":"Metal"}')`,
      [projectApp.rows[0]?.id, record.rows[0]?.id],
    );
    const effective = await client.query<{ material: string }>(
      `SELECT COALESCE(
         project_record.attributes_override ->> 'material',
         record.canonical_attributes ->> 'material'
       ) AS material
       FROM project_records project_record
       JOIN records record ON record.id = project_record.record_id`,
    );
    expect(effective.rows[0]?.material).toBe("Metal");
  });

  it("rolls the baseline back", async () => {
    await migrateDown(client);
    const result = await client.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM information_schema.tables
       WHERE table_schema = $1`,
      [schema],
    );
    expect(result.rows[0]?.count).toBe("0");
  });
});
