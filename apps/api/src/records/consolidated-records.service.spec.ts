import { randomUUID } from "node:crypto";
import { Client } from "pg";
import { beforeAll, afterAll, describe, expect, it } from "vitest";
import { migrateUp } from "../database/migrator.js";
import { ConsolidatedRecordsService } from "./consolidated-records.service.js";

const client = new Client({
  connectionString:
    process.env.DATABASE_URL ??
    "postgresql://hansa_field:change-me-local-only@localhost:5434/hansa_field",
});
const namespace = `consolidated_${randomUUID().replaceAll("-", "")}`;
const service = new ConsolidatedRecordsService(client);
const template = randomUUID(),
  version = randomUUID(),
  a = randomUUID(),
  b = randomUUID(),
  pa = randomUUID(),
  pb = randomUUID(),
  record = randomUUID();
const material = randomUUID(),
  local = randomUUID(),
  sameLabel = randomUUID();
const query = { search: "", page: 1, pageSize: 50 };
describe("consolidated participation reads (PostGIS)", () => {
  beforeAll(async () => {
    await client.connect();
    await client.query(`CREATE SCHEMA "${namespace}"`);
    await client.query(`SET search_path TO "${namespace}",public`);
    await migrateUp(client);
    await client.query(
      "INSERT INTO app_definitions(id,code,name,allowed_geometries) VALUES($1,'POSTES','Postes',ARRAY['Point'])",
      [template],
    );
    await client.query(
      "INSERT INTO app_versions(id,app_id,version,schema_definition) VALUES($1,$2,1,'{\"sections\":[]}'::jsonb)",
      [version, template],
    );
    await client.query(
      "INSERT INTO projects(id,code,name) VALUES($1,'PROYECTO_A','Proyecto A'),($2,'PROYECTO_B','Proyecto B')",
      [a, b],
    );
    await client.query(
      "INSERT INTO project_apps(id,project_id,app_id,base_version_id) VALUES($1,$2,$5,$6),($3,$4,$5,$6)",
      [pa, a, pb, b, template, version],
    );
    for (const id of [pa, pb])
      await client.query(
        "INSERT INTO project_app_versions(project_app_id,version,schema_definition) VALUES($1,1,$2)",
        [
          id,
          {
            sections: [
              {
                fields: [
                  { id: material, key: "material", label: "Material" },
                  ...(id === pb
                    ? [
                        { id: local, key: "luminaria", label: "Luminaria" },
                        {
                          id: sameLabel,
                          key: "otro_material",
                          label: "Material",
                        },
                      ]
                    : []),
                ],
              },
            ],
          },
        ],
      );
    await client.query(
      'INSERT INTO records(id,app_id,app_version_id,canonical_attributes,geometry) VALUES($1,$2,$3,\'{"material":"Hormigón"}\',ST_SetSRID(ST_Point(-63,-17),4326))',
      [record, template, version],
    );
    await client.query(
      "INSERT INTO project_records(project_app_id,record_id) VALUES($1,$2)",
      [pa, record],
    );
    await client.query(
      'INSERT INTO project_records(project_app_id,record_id,attributes_override,project_attributes,geometry_override,display_geometry_override) VALUES($1,$2,\'{"material":"Metal"}\',\'{"luminaria":true}\',ST_SetSRID(ST_Point(-64,-18),4326),ST_SetSRID(ST_Point(-65,-19),4326))',
      [pb, record],
    );
  });
  afterAll(async () => {
    await client.query(`DROP SCHEMA IF EXISTS "${namespace}" CASCADE`);
    await client.end();
  });
  it("unifies columns by field identity without merging same-label fields", async () => {
    const meta = await service.metadata(template);
    expect(meta.columns).toHaveLength(3);
    expect(meta.columns.find((c) => c.id === material)?.keys).toEqual({
      [pa]: "material",
      [pb]: "material",
    });
    expect(meta.columns.find((c) => c.id === local)?.keys[pa]).toBeUndefined();
    expect(meta.columns.filter((c) => c.label === "Material")).toHaveLength(2);
  });
  it("keeps shared record identities and resolves each participation separately", async () => {
    const result = await service.list(template, query);
    expect(result.totalRecords).toBe(2);
    expect(new Set(result.data.map((r) => r.recordUuid)).size).toBe(1);
    expect(new Set(result.data.map((r) => r.projectRecordUuid)).size).toBe(2);
    const first = result.data.find((r) => r.projectAppId === pa),
      second = result.data.find((r) => r.projectAppId === pb);
    expect(first?.attributes.material).toBe("Hormigón");
    expect(second?.attributes.material).toBe("Metal");
    expect(second?.attributes.luminaria).toBe(true);
    expect(second?.attributes.otro_material).toBeUndefined();
    expect(second?.geometry).toEqual({
      type: "Point",
      coordinates: [-64, -18],
    });
    expect(second?.displayGeometry).toEqual({
      type: "Point",
      coordinates: [-65, -19],
    });
  });
  it("filters and paginates while preserving total on empty pages", async () => {
    expect(
      (await service.list(template, { ...query, projectId: b })).totalRecords,
    ).toBe(1);
    expect(
      (
        await service.list(template, {
          ...query,
          projectAppIds: [pa],
          search: "Metal",
        })
      ).totalRecords,
    ).toBe(0);
    expect(
      (await service.list(template, { ...query, search: "Metal" })).data[0]
        ?.projectId,
    ).toBe(b);
    const page = await service.list(template, {
      ...query,
      page: 3,
      pageSize: 1,
    });
    expect(page.data).toHaveLength(0);
    expect(page.totalRecords).toBe(2);
  });
  it("maps the same collection with visual overrides, bbox and clusters", async () => {
    const map = await service.map(template, query, [-66, -20, -62, -16], 19);
    expect(map.totalRecords).toBe(2);
    expect(map.data.find((r) => r.projectAppId === pb)?.geometry).toEqual({
      type: "Point",
      coordinates: [-65, -19],
    });
    expect(
      (
        await service.map(
          template,
          { ...query, search: "Metal" },
          [-66, -20, -62, -16],
          10,
        )
      ).totalRecords,
    ).toBe(1);
    expect(
      (await service.map(template, query, [-63.1, -17.1, -62.9, -16.9], 19))
        .totalRecords,
    ).toBe(1);
  });
  it("excludes removed participations without removing their canonical record", async () => {
    await client.query(
      "UPDATE project_records SET status='removed' WHERE project_app_id=$1",
      [pb],
    );
    expect((await service.list(template, query)).totalRecords).toBe(1);
    expect(
      (await service.map(template, query, [-66, -20, -62, -16], 10))
        .totalRecords,
    ).toBe(1);
    expect(
      (await client.query("SELECT id FROM records WHERE id=$1", [record]))
        .rowCount,
    ).toBe(1);
  });
});
