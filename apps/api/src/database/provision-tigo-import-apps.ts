import { randomUUID } from "node:crypto";
import { Client } from "pg";
import { z } from "zod";

import { templateInput } from "../datasets/template-contract.js";

const organizationId = "00000000-0000-4000-8000-000000000001";
const projectName = "Proyecto Piloto Santa Cruz";
const blockName = "Cajón Infraestructura Nacional";

const environment = z
  .object({
    DATABASE_URL: z.url({ protocol: /^postgres(ql)?$/ }),
  })
  .parse(process.env);

type ManagedSchema = ReturnType<typeof templateInput.parse>["schema"];
type ManagedField = ManagedSchema["sections"][number]["fields"][number];
type FieldDefinition = Readonly<{
  key: string;
  label: string;
  type: ManagedField["type"];
}>;
type AppDefinition = Readonly<{
  name: string;
  templateName: string;
  code: string;
  description: string;
  mapIcon: ManagedSchema["settings"]["mapIcon"];
  mapColor: string;
  allowedGeometries: readonly ("Point" | "LineString" | "Polygon")[];
  fields: readonly FieldDefinition[];
}>;

const commonPointFields: readonly FieldDefinition[] = [
  { key: "source_record_id", label: "_record_id", type: "shortText" },
  { key: "source_status", label: "_status", type: "shortText" },
  { key: "source_title", label: "_title", type: "shortText" },
  { key: "source_server_up", label: "_server_up", type: "date" },
  { key: "source_updated_by", label: "_updated_b", type: "shortText" },
  { key: "source_latitude", label: "_latitude", type: "number" },
  { key: "source_longitude", label: "_longitude", type: "number" },
  { key: "marker_col", label: "marker-col", type: "shortText" },
  { key: "tecnologia", label: "tecnologia", type: "shortText" },
  { key: "distrito", label: "distrito", type: "shortText" },
  { key: "nodo", label: "nodo", type: "shortText" },
  { key: "hps", label: "hps", type: "number" },
];

const definitions: readonly AppDefinition[] = [
  {
    name: "Postes",
    templateName: "Plantilla Postes de Red",
    code: "POSTES",
    description: "Postes de red importados desde la cartografía maestra.",
    mapIcon: "post",
    mapColor: "#2563eb",
    allowedGeometries: ["Point"],
    fields: [
      ...commonPointFields,
      { key: "empresa", label: "empresa", type: "shortText" },
      { key: "material", label: "material", type: "shortText" },
    ],
  },
  {
    name: "Taps FTTH",
    templateName: "Plantilla Taps FTTH",
    code: "TAPS",
    description: "Taps, taps saturados y taps sobrecargados.",
    mapIcon: "node",
    mapColor: "#0891b2",
    allowedGeometries: ["Point"],
    fields: [
      ...commonPointFields,
      { key: "tap_id", label: "id", type: "shortText" },
      { key: "bocas_tot", label: "bocas_tot", type: "number" },
      { key: "bocas_libr", label: "bocas_libr", type: "number" },
      { key: "bocas_ocup", label: "bocas_ocup", type: "number" },
      { key: "tipo_tap", label: "tipo_tap", type: "shortText" },
      { key: "piso", label: "piso", type: "shortText" },
      { key: "equalizad", label: "equalizad", type: "shortText" },
      { key: "forward", label: "forward", type: "shortText" },
      { key: "retorno", label: "retorno", type: "shortText" },
      { key: "id_concat", label: "id_concat", type: "shortText" },
      { key: "potencia", label: "potencia", type: "number" },
    ],
  },
  {
    name: "Nodos de red",
    templateName: "Plantilla Nodos de red",
    code: "NODOS",
    description: "Nodos HFC, FTTH e híbridos.",
    mapIcon: "node",
    mapColor: "#16a34a",
    allowedGeometries: ["Point"],
    fields: [
      ...commonPointFields,
      { key: "marca", label: "marca", type: "shortText" },
    ],
  },
  {
    name: "Divisores ópticos",
    templateName: "Plantilla Divisores ópticos",
    code: "DIVISORES",
    description: "Divisores y componentes ópticos de red.",
    mapIcon: "splice",
    mapColor: "#7c3aed",
    allowedGeometries: ["Point"],
    fields: [
      ...commonPointFields,
      { key: "tipo", label: "tipo", type: "shortText" },
    ],
  },
  {
    name: "Amplificadores HFC",
    templateName: "Plantilla Amplificadores HFC",
    code: "AMPLIFICADORES",
    description: "Amplificadores HFC de la cartografía maestra.",
    mapIcon: "tower",
    mapColor: "#ea580c",
    allowedGeometries: ["Point"],
    fields: [
      ...commonPointFields,
      { key: "id_amp", label: "id_amp", type: "shortText" },
      { key: "tipo_amp", label: "tipo_amp", type: "shortText" },
    ],
  },
  {
    name: "Edificios",
    templateName: "Plantilla Edificios de Red",
    code: "EDIFICIOS",
    description: "Edificios y su capacidad de taps HFC/FTTH.",
    mapIcon: "building",
    mapColor: "#db2777",
    allowedGeometries: ["Point"],
    fields: [
      ...commonPointFields,
      { key: "nom_edif", label: "nom_edif", type: "shortText" },
      { key: "hps_edif", label: "hps_edif", type: "number" },
      { key: "cant_taps", label: "cant_taps", type: "number" },
      { key: "boc_tap_ed", label: "boc_tap_ed", type: "number" },
      { key: "boc_ocu_ed", label: "boc_ocu_ed", type: "number" },
      { key: "boc_lib_ed", label: "boc_lib_ed", type: "number" },
      { key: "bocas_libr", label: "bocas_libr", type: "number" },
      { key: "id_origen", label: "id_origen", type: "shortText" },
      { key: "equip_orig", label: "equip_orig", type: "shortText" },
      { key: "mda", label: "mda", type: "shortText" },
      { key: "link_pdf", label: "link_pdf", type: "shortText" },
    ],
  },
  {
    name: "Cajas terminales FTTH",
    templateName: "Plantilla Cajas terminales FTTH",
    code: "XBOX",
    description: "Cajas terminales FTTH (XBOX).",
    mapIcon: "splice",
    mapColor: "#be123c",
    allowedGeometries: ["Point"],
    fields: [
      ...commonPointFields,
      { key: "id_xbox", label: "id_xbox", type: "shortText" },
      { key: "troncal", label: "troncal", type: "shortText" },
    ],
  },
  {
    name: "MEC",
    templateName: "Plantilla MEC",
    code: "MEC",
    description: "Equipos MEC de la red.",
    mapIcon: "generator",
    mapColor: "#704b10",
    allowedGeometries: ["Point"],
    fields: commonPointFields,
  },
  {
    name: "Red lineal HFC/FTTH",
    templateName: "Plantilla Red lineal HFC/FTTH",
    code: "RED_LINEAL",
    description: "Troncales, distribución y cobertura HFC/FTTH.",
    mapIcon: "cable",
    mapColor: "#7c3aed",
    allowedGeometries: ["LineString"],
    fields: [
      ...commonPointFields,
      { key: "nodo_cob", label: "nodo_cob", type: "shortText" },
      { key: "tipo_de_ca", label: "tipo_de_ca", type: "shortText" },
      { key: "valor", label: "valor", type: "shortText" },
    ],
  },
];

function appendFields(
  schema: ManagedSchema,
  definition: AppDefinition,
): ManagedSchema {
  const byKey = new Map(
    schema.sections
      .flatMap((section) => section.fields)
      .map((field) => [field.key, field]),
  );
  const sourceFields = definition.fields.map((field) => {
    const existing = byKey.get(field.key);
    return existing
      ? { ...existing, label: field.label, required: false }
      : { id: randomUUID(), ...field, required: false };
  });
  const definedKeys = new Set(definition.fields.map((field) => field.key));
  const retained = schema.sections.map((section) => ({
    ...section,
    fields: section.fields
      .filter((field) => !definedKeys.has(field.key))
      .map((field) => ({ ...field, required: false })),
  }));
  const sourceSection = retained.find(
    (section) => section.title === "Datos del archivo importado",
  );
  if (sourceSection) sourceSection.fields = sourceFields;
  else
    retained.push({
      id: randomUUID(),
      title: "Datos del archivo importado",
      fields: sourceFields,
    });
  return {
    ...schema,
    sections: retained,
    settings: {
      ...schema.settings,
      name: definition.name,
      code: definition.code,
      description: definition.description,
      mapIcon: definition.mapIcon,
      mapColor: definition.mapColor,
      allowedGeometries: [...definition.allowedGeometries],
    },
  };
}

function initialSchema(definition: AppDefinition): ManagedSchema {
  return templateInput.parse({
    name: definition.templateName,
    schema: {
      sections: [
        {
          id: randomUUID(),
          title: "Datos del archivo importado",
          fields: definition.fields.map((field) => ({
            id: randomUUID(),
            ...field,
            required: false,
          })),
        },
      ],
      settings: {
        id: definition.code.toLowerCase(),
        name: definition.name,
        code: definition.code,
        description: definition.description,
        allowedGeometries: definition.allowedGeometries,
        mapIcon: definition.mapIcon,
        mapColor: definition.mapColor,
      },
    },
  }).schema;
}

function parseExisting(name: string, value: unknown): ManagedSchema {
  return templateInput.parse({ name, schema: value }).schema;
}

function sameSchema(left: ManagedSchema, right: ManagedSchema): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

const client = new Client({ connectionString: environment.DATABASE_URL });
await client.connect();
try {
  await client.query("BEGIN");
  const project = await client.query<{ id: string }>(
    "SELECT id FROM projects WHERE organization_id=$1 AND name=$2 FOR UPDATE",
    [organizationId, projectName],
  );
  if (!project.rows[0]) throw new Error(`Falta el proyecto: ${projectName}`);
  const block = await client.query<{ id: string }>(
    "SELECT id FROM app_blocks WHERE organization_id=$1 AND name=$2 FOR UPDATE",
    [organizationId, blockName],
  );
  if (!block.rows[0]) throw new Error(`Falta el cajón: ${blockName}`);

  for (const definition of definitions) {
    const existing = await client.query<{
      app_id: string;
      template_id: string;
      dataset_id: string;
      template_schema: unknown;
      dataset_schema: unknown;
      template_version: number;
      dataset_version: number;
    }>(
      `SELECT a.id app_id,t.id template_id,d.id dataset_id,tv.schema_definition template_schema,dv.schema_definition dataset_schema,
        tv.version template_version,dv.version dataset_version
       FROM apps a JOIN template_versions selected_tv ON selected_tv.id=a.template_version_id JOIN templates t ON t.id=selected_tv.template_id
       JOIN LATERAL(SELECT * FROM template_versions WHERE template_id=t.id ORDER BY version DESC LIMIT 1)tv ON true
       JOIN datasets d ON d.app_id=a.id
       JOIN LATERAL(SELECT * FROM dataset_versions WHERE dataset_id=d.id ORDER BY version DESC LIMIT 1)dv ON true
       WHERE a.organization_id=$1 AND a.name=$2 FOR UPDATE OF a,t,d`,
      [organizationId, definition.name],
    );
    let appId: string;
    let datasetId: string;
    let datasetVersionId: string;
    let schema: ManagedSchema;
    if (existing.rows[0]) {
      const row = existing.rows[0];
      const templateSchema = appendFields(
        parseExisting(definition.templateName, row.template_schema),
        definition,
      );
      schema = appendFields(
        parseExisting(definition.name, row.dataset_schema),
        definition,
      );
      const templateVersion = await client.query<{ id: string }>(
        "INSERT INTO template_versions(template_id,version,schema_definition) VALUES($1,$2,$3) RETURNING id",
        [row.template_id, row.template_version + 1, templateSchema],
      );
      await client.query(
        "UPDATE apps SET template_version_id=$2,name=$3 WHERE id=$1",
        [row.app_id, templateVersion.rows[0]!.id, definition.name],
      );
      const datasetVersion = await client.query<{ id: string }>(
        "INSERT INTO dataset_versions(dataset_id,version,schema_definition) VALUES($1,$2,$3) RETURNING id",
        [row.dataset_id, row.dataset_version + 1, schema],
      );
      appId = row.app_id;
      datasetId = row.dataset_id;
      datasetVersionId = datasetVersion.rows[0]!.id;
    } else {
      schema = initialSchema(definition);
      const template = await client.query<{ id: string }>(
        "INSERT INTO templates(organization_id,name) VALUES($1,$2) RETURNING id",
        [organizationId, definition.templateName],
      );
      const templateVersion = await client.query<{ id: string }>(
        "INSERT INTO template_versions(template_id,version,schema_definition) VALUES($1,1,$2) RETURNING id",
        [template.rows[0]!.id, schema],
      );
      const app = await client.query<{ id: string }>(
        "INSERT INTO apps(organization_id,name,template_version_id) VALUES($1,$2,$3) RETURNING id",
        [organizationId, definition.name, templateVersion.rows[0]!.id],
      );
      const dataset = await client.query<{ id: string }>(
        "INSERT INTO datasets(organization_id,name,app_id) VALUES($1,$2,$3) RETURNING id",
        [organizationId, definition.name, app.rows[0]!.id],
      );
      const datasetVersion = await client.query<{ id: string }>(
        "INSERT INTO dataset_versions(dataset_id,version,schema_definition) VALUES($1,1,$2) RETURNING id",
        [dataset.rows[0]!.id, schema],
      );
      appId = app.rows[0]!.id;
      datasetId = dataset.rows[0]!.id;
      datasetVersionId = datasetVersion.rows[0]!.id;
    }
    await client.query(
      "INSERT INTO block_members(block_id,app_id,dataset_version_id) VALUES($1,$2,$3) ON CONFLICT(block_id,app_id) DO UPDATE SET dataset_version_id=EXCLUDED.dataset_version_id",
      [block.rows[0].id, appId, datasetVersionId],
    );
    const projectApp = await client.query<{
      id: string;
      version: number;
      schema_definition: unknown;
    }>(
      `SELECT pa.id,pav.version,pav.schema_definition FROM project_apps pa
       JOIN LATERAL(SELECT * FROM project_app_versions WHERE project_app_id=pa.id ORDER BY version DESC LIMIT 1)pav ON true
       WHERE pa.project_id=$1 AND pa.app_id=$2 FOR UPDATE OF pa`,
      [project.rows[0].id, appId],
    );
    if (projectApp.rows[0]) {
      const projectSchema = appendFields(
        parseExisting(definition.name, projectApp.rows[0].schema_definition),
        definition,
      );
      await client.query(
        "INSERT INTO project_app_versions(project_app_id,version,schema_definition) VALUES($1,$2,$3)",
        [projectApp.rows[0].id, projectApp.rows[0].version + 1, projectSchema],
      );
    } else {
      const created = await client.query<{ id: string }>(
        "INSERT INTO project_apps(organization_id,project_id,app_id,dataset_id) VALUES($1,$2,$3,$4) RETURNING id",
        [organizationId, project.rows[0].id, appId, datasetId],
      );
      await client.query(
        "INSERT INTO project_app_versions(project_app_id,version,schema_definition) VALUES($1,1,$2)",
        [created.rows[0]!.id, schema],
      );
    }
  }
  await client.query("COMMIT");
  process.stdout.write(`Apps listas para importar en ${projectName}.\n`);
} catch (error: unknown) {
  await client.query("ROLLBACK");
  throw error;
} finally {
  await client.end();
}
