import { randomUUID } from "node:crypto";
import { Client } from "pg";
import { beforeAll, afterAll, expect, it } from "vitest";
import { pilotBaseline } from "../database/pilot-baseline.js";
import type { TransactionalDatabase } from "../database/database.service.js";
import { DatasetsService } from "./datasets.service.js";
import { DatasetRecordsService } from "./dataset-records.service.js";

const client = new Client({
  connectionString:
    process.env.DATABASE_URL ??
    "postgresql://hansa_field:change-me-local-only@localhost:5434/hansa_field",
});
const namespace = `neutral_records_${randomUUID().replaceAll("-", "")}`;
const db: TransactionalDatabase = {
  query: (sql, values) => client.query(sql, values),
  async withTransaction(action) {
    await client.query("BEGIN");
    try {
      const result = await action(client);
      await client.query("COMMIT");
      return result;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    }
  },
};
const org = randomUUID(),
  field = randomUUID();
const schema = {
  sections: [
    {
      id: randomUUID(),
      title: "Data",
      fields: [
        {
          id: field,
          key: "height",
          label: "Altura",
          type: "number" as const,
          required: false,
        },
      ],
    },
  ],
};
const datasets = new DatasetsService(db),
  records = new DatasetRecordsService(db);
const actor = () => ({
  organizationId: org,
  actorId: "pilot-test",
  operationId: randomUUID(),
});
beforeAll(async () => {
  await client.connect();
  await client.query(`CREATE SCHEMA "${namespace}"`);
  await client.query(`SET search_path TO "${namespace}",public`);
  await client.query(pilotBaseline.up);
  await client.query("INSERT INTO organizations(id,name) VALUES($1,'Test')", [
    org,
  ]);
});
afterAll(async () => {
  await client.query(pilotBaseline.down);
  await client.query(`DROP SCHEMA "${namespace}" CASCADE`);
  await client.end();
});

it("App import has no participation; project edit and retry are isolated", async () => {
  const template = await datasets.createTemplate(org, "Template", schema);
  const app = await datasets.createApp(org, "App", template.versionId);
  const a = await datasets.createProject(org, "A"),
    b = await datasets.createProject(org, "B");
  const pa = await datasets.relateApp(org, a.projectId, app.appId),
    pb = await datasets.relateApp(org, b.projectId, app.appId);
  const op = actor();
  const created = await records.create(op, {
    datasetId: app.datasetId,
    attributes: { [field]: 9 },
    geometry: { type: "Point", coordinates: [-68, -16] },
  });
  expect(created.projectRecordId).toBeNull();
  expect(
    await records.create(op, {
      geometry: { type: "Point", coordinates: [-68, -16] },
      attributes: { [field]: 9 },
      datasetId: app.datasetId,
    }),
  ).toEqual(created);
  const ar = await records.incorporate(
    actor(),
    created.recordId,
    a.projectId,
    pa.projectAppId,
  );
  const br = await records.incorporate(
    actor(),
    created.recordId,
    b.projectId,
    pb.projectAppId,
  );
  await records.patchProject(actor(), b.projectId, br.projectRecordId, {
    expectedRevision: 1,
    attributesOverride: { [field]: 12 },
  });
  await expect(
    records.patchProject(actor(), b.projectId, br.projectRecordId, {
      expectedRevision: 1,
      attributesOverride: { [field]: 15 },
    }),
  ).rejects.toThrow();
  expect((await records.detail(org, created.recordId)).attributes).toEqual({
    [field]: 9,
  });
  expect(
    (await records.projectDetail(org, a.projectId, ar.projectRecordId))
      .attributes,
  ).toEqual({ [field]: 9 });
  expect(
    (await records.projectDetail(org, b.projectId, br.projectRecordId))
      .attributes,
  ).toEqual({ [field]: 12 });
  await expect(
    records.patchProject(actor(), a.projectId, br.projectRecordId, {
      expectedRevision: 2,
    }),
  ).rejects.toThrow();
  await expect(
    records.removeProject(actor(), b.projectId, br.projectRecordId, 1),
  ).rejects.toThrow();
  const removal = actor();
  const removed = await records.removeProject(
    removal,
    b.projectId,
    br.projectRecordId,
    2,
  );
  expect(
    await records.removeProject(removal, b.projectId, br.projectRecordId, 2),
  ).toEqual(removed);
  await expect(
    records.projectDetail(org, b.projectId, br.projectRecordId),
  ).rejects.toThrow();
  expect(
    (await records.projectDetail(org, a.projectId, ar.projectRecordId))
      .attributes,
  ).toEqual({ [field]: 9 });
  expect((await records.detail(org, created.recordId)).attributes).toEqual({
    [field]: 9,
  });
});
it("local project creates record and participation without fake App or ProjectApp", async () => {
  const project = await datasets.createProject(org, "Local");
  const local = await datasets.createLocalCollection(
    org,
    project.projectId,
    "Local data",
    schema,
  );
  const result = await records.create(actor(), {
    datasetId: local.datasetId,
    projectId: project.projectId,
    attributes: { [field]: 3 },
    geometry: null,
  });
  expect(result.projectRecordId).not.toBeNull();
  const detail = await records.detail(org, result.recordId);
  expect(detail.origin).toMatchObject({
    context: "project",
    projectId: project.projectId,
    datasetId: local.datasetId,
  });
  const row = await client.query(
    "SELECT project_app_id FROM project_records WHERE id=$1",
    [result.projectRecordId],
  );
  expect(row.rows[0].project_app_id).toBeNull();
  await expect(
    records.create(actor(), {
      datasetId: local.datasetId,
      attributes: { [field]: 3 },
      geometry: null,
    }),
  ).rejects.toThrow();
});
it("schema label edits preserve values and publication is independent from lifecycle", async () => {
  const app = await datasets.createApp(org, "No template");
  await datasets.publishSchema(org, app.datasetId, 1, schema);
  const record = await records.create(actor(), {
    datasetId: app.datasetId,
    attributes: { [field]: 8 },
    geometry: null,
  });
  await datasets.publishSchema(org, app.datasetId, 2, {
    sections: schema.sections.map((s) => ({
      ...s,
      fields: s.fields.map((f) => ({ ...f, label: "Altura del poste" })),
    })),
  });
  expect((await records.detail(org, record.recordId)).attributes).toEqual({
    [field]: 8,
  });
  await records.publish(actor(), record.recordId, 1);
  expect(await records.detail(org, record.recordId)).toMatchObject({
    visibility: "published",
    lifecycle: "active",
    revision: 2,
  });
  await expect(
    client.query("UPDATE record_events SET snapshot='{}' WHERE record_id=$1", [
      record.recordId,
    ]),
  ).rejects.toThrow();
});
