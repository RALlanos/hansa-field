import { randomUUID } from "node:crypto";
import { Client } from "pg";
import { it, expect } from "vitest";
import { TemplatesController } from "./templates.controller.js";
import { LOCAL_ORGANIZATION } from "./operational.controller.js";
import { pilotBaseline } from "../database/pilot-baseline.js";
it("roundtrips complete template settings and publishes immutable versions without datasets", async () => {
  const client = new Client({
    connectionString:
      process.env.DATABASE_URL ??
      "postgresql://hansa_field:change-me-local-only@localhost:5434/hansa_field",
  });
  const namespace = `templates_${randomUUID().replaceAll("-", "")}`;
  await client.connect();
  try {
    await client.query(`CREATE SCHEMA "${namespace}"`);
    await client.query(`SET search_path TO "${namespace}",public`);
    await client.query(pilotBaseline.up);
    await client.query("INSERT INTO organizations(id,name) VALUES($1,'Test')", [
      LOCAL_ORGANIZATION,
    ]);
    const controller = new TemplatesController({
      query: (sql, values) => client.query(sql, values),
      withTransaction: async (action) => {
        await client.query("BEGIN");
        try {
          const result = await action(client);
          await client.query("COMMIT");
          return result;
        } catch (e) {
          await client.query("ROLLBACK");
          throw e;
        }
      },
    });
    const fieldId = randomUUID(),
      choiceId = randomUUID();
    const input = {
      name: "Postes",
      schema: {
        settings: {
          name: "Postes",
          code: "POSTES",
          description: "Descripción",
          allowedGeometries: ["Point", "LineString", "Polygon"],
          mapIcon: "tower",
          mapColor: "#123456",
        },
        sections: [
          {
            id: randomUUID(),
            title: "General",
            subtitle: "Grupo",
            fields: [
              {
                id: fieldId,
                key: "altura",
                label: "Altura",
                type: "number",
                required: true,
                description: "Metros",
                hidden: false,
                display: "inline",
              },
              {
                id: choiceId,
                key: "material",
                label: "Material",
                type: "singleChoice",
                required: false,
                options: ["Metal", "Madera"],
                visibility: {
                  match: "all",
                  preserveValue: true,
                  conditions: [{ fieldId, operator: "isNotEmpty" }],
                },
              },
            ],
          },
        ],
      },
    };
    const created = await controller.create(input);
    expect(created.version).toBe(1);
    expect((await controller.get(created.id!)).schema).toEqual(input.schema);
    const updated = structuredClone(input);
    updated.schema.sections[0]!.fields[0]!.label = "Altura del poste";
    await controller.version(created.id!, { ...updated, expectedVersion: 1 });
    const latest = await controller.get(created.id!);
    expect(latest.version).toBe(2);
    expect(latest.schema).toEqual(updated.schema);
    const historical = await client.query(
      "SELECT schema_definition FROM template_versions WHERE template_id=$1 AND version=1",
      [created.id],
    );
    expect(historical.rows[0].schema_definition).toEqual(input.schema);
    await expect(
      controller.version(created.id!, { ...updated, expectedVersion: 1 }),
    ).rejects.toThrow("La plantilla cambió");
    const typeChange = structuredClone(updated);
    typeChange.schema.sections[0]!.fields[0]!.type = "shortText";
    await expect(
      controller.version(created.id!, { ...typeChange, expectedVersion: 2 }),
    ).rejects.toThrow();
    const counts = await client.query(
      "SELECT (SELECT count(*) FROM datasets)::int datasets,(SELECT count(*) FROM records)::int records,(SELECT count(*) FROM projects)::int projects",
    );
    expect(counts.rows[0]).toEqual({ datasets: 0, records: 0, projects: 0 });
  } finally {
    await client.query(`DROP SCHEMA "${namespace}" CASCADE`);
    await client.end();
  }
});
