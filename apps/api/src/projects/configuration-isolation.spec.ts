import { randomUUID } from "node:crypto";
import { Client } from "pg";
import { afterAll, beforeAll, expect, it } from "vitest";
import { migrateUp } from "../database/migrator.js";
import type { TransactionalDatabase } from "../database/database.service.js";
import { BlocksService } from "../blocks/blocks.service.js";
import { ProjectsService } from "./projects.service.js";

const client = new Client({
  connectionString:
    process.env.DATABASE_URL ??
    "postgresql://hansa_field:change-me-local-only@localhost:5434/hansa_field",
});
const namespace = `configuration_${randomUUID().replaceAll("-", "")}`;
const db: TransactionalDatabase = {
  query: (sql, values) => client.query(sql, values),
  async withTransaction(operation) {
    await client.query("BEGIN");
    try {
      const result = await operation(client);
      await client.query("COMMIT");
      return result;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    }
  },
};
beforeAll(async () => {
  await client.connect();
  await client.query(`CREATE SCHEMA "${namespace}"`);
  await client.query(`SET search_path TO "${namespace}",public`);
  await migrateUp(client);
});
afterAll(async () => {
  await client.query(`DROP SCHEMA "${namespace}" CASCADE`);
  await client.end();
});
it("block edits are not retroactive and project schemas remain isolated", async () => {
  const appId = randomUUID(),
    appVersionId = randomUUID(),
    fieldId = randomUUID();
  const schema = {
    sections: [
      {
        id: randomUUID(),
        title: "Datos",
        fields: [
          {
            id: fieldId,
            key: "name",
            label: "Nombre",
            type: "shortText",
            required: false,
          },
        ],
      },
    ],
  };
  await client.query(
    "INSERT INTO app_definitions(id,code,name,allowed_geometries) VALUES($1,'POSTES','Postes',ARRAY['Point'])",
    [appId],
  );
  await client.query(
    "INSERT INTO app_versions(id,app_id,version,schema_definition) VALUES($1,$2,1,$3)",
    [appVersionId, appId, schema],
  );
  const blocks = new BlocksService(db),
    projects = new ProjectsService(db);
  const block = await blocks.create({
    code: "CAJON",
    name: "Cajón",
    description: "",
    members: [{ appId, appVersionId }],
  });
  const a = await projects.create({
    code: "PROYECTO_A",
    name: "Proyecto A",
    description: "",
    blockIds: [block.id],
  });
  const b = await projects.create({
    code: "PROYECTO_B",
    name: "Proyecto B",
    description: "",
    blockIds: [block.id],
  });
  const pa = a.projectApps[0]!,
    pb = b.projectApps[0]!;
  const before = await client.query("SELECT * FROM project_apps ORDER BY id");
  await blocks.update(block.id, {
    code: "CAJON",
    name: "Editado",
    description: "",
    members: [],
  });
  expect(
    (await client.query("SELECT * FROM project_apps ORDER BY id")).rows,
  ).toEqual(before.rows);
  expect((await blocks.list())[0]?.members).toEqual([]);
  const c = await projects.create({
    code: "PROYECTO_C",
    name: "Proyecto C",
    description: "",
    blockIds: [block.id],
  });
  expect(c.projectApps).toEqual([]);
  const local = {
    ...schema,
    sections: schema.sections.map((section) => ({
      ...section,
      fields: [
        ...section.fields,
        {
          id: randomUUID(),
          key: "local",
          label: "Local",
          type: "shortText",
          required: false,
        },
      ],
    })),
  };
  await projects.createProjectAppVersion(pb.id, local);
  expect((await projects.latestProjectAppVersion(pb.id)).schema).toEqual(local);
  expect((await projects.latestProjectAppVersion(pa.id)).schema).toEqual(
    schema,
  );
  expect(
    (
      await client.query(
        "SELECT schema_definition FROM app_versions WHERE id=$1",
        [appVersionId],
      )
    ).rows[0].schema_definition,
  ).toEqual(schema);
  expect(
    (await projects.list()).find((project) => project.id === a.id)?.projectApps,
  ).toEqual(a.projectApps);
  expect(
    (await client.query("SELECT count(*)::int AS count FROM records")).rows[0]
      .count,
  ).toBe(0);
});
