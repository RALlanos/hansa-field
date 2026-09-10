import { randomUUID } from "node:crypto";
import { Client } from "pg";
import { beforeAll, afterAll, it, expect } from "vitest";
import { pilotBaseline } from "./pilot-baseline.js";
const db = new Client({
  connectionString:
    process.env.DATABASE_URL ??
    "postgresql://hansa_field:change-me-local-only@localhost:5434/hansa_field",
});
const namespace = `pilot_${randomUUID().replaceAll("-", "")}`;
beforeAll(async () => {
  await db.connect();
  await db.query(`CREATE SCHEMA "${namespace}"`);
  await db.query(`SET search_path TO "${namespace}",public`);
  await db.query(pilotBaseline.up);
});
afterAll(async () => {
  await db.query(pilotBaseline.down);
  await db.query(`DROP SCHEMA "${namespace}" CASCADE`);
  await db.end();
});
it("supports local records without App and enforces dataset ownership", async () => {
  const org = randomUUID(),
    project = randomUUID(),
    dataset = randomUUID(),
    version = randomUUID(),
    record = randomUUID();
  await db.query("INSERT INTO organizations(id,name) VALUES($1,'Pilot')", [
    org,
  ]);
  await db.query(
    "INSERT INTO projects(id,organization_id,name) VALUES($1,$2,'Local')",
    [project, org],
  );
  await expect(
    db.query(
      "INSERT INTO datasets(organization_id,name) VALUES($1,'Invalid')",
      [org],
    ),
  ).rejects.toThrow();
  await db.query(
    "INSERT INTO datasets(id,organization_id,name,local_project_id) VALUES($1,$2,'Local',$3)",
    [dataset, org, project],
  );
  await db.query(
    "INSERT INTO dataset_versions(id,dataset_id,version,schema_definition) VALUES($1,$2,1,'{\"sections\":[]}')",
    [version, dataset],
  );
  await db.query(
    'INSERT INTO records(id,organization_id,dataset_id,schema_version_id,origin) VALUES($1,$2,$3,$4,\'{"context":"project"}\')',
    [record, org, dataset, version],
  );
  await db.query(
    "INSERT INTO project_records(organization_id,project_id,dataset_id,record_id,schema_definition) VALUES($1,$2,$3,$4,'{\"sections\":[]}')",
    [org, project, dataset, record],
  );
  expect(
    (await db.query("SELECT count(*)::int count FROM apps")).rows[0].count,
  ).toBe(0);
  expect(
    (await db.query("SELECT count(*)::int count FROM project_apps")).rows[0]
      .count,
  ).toBe(0);
  await expect(
    db.query("UPDATE records SET origin='{}' WHERE id=$1", [record]),
  ).rejects.toThrow();
  await expect(
    db.query(
      "INSERT INTO project_records(organization_id,project_id,dataset_id,record_id,schema_definition) VALUES($1,$2,$3,$4,'{}')",
      [org, project, dataset, record],
    ),
  ).rejects.toThrow();
});
