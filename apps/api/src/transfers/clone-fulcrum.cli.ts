import { createHash, randomUUID } from "node:crypto";
import { Client } from "pg";
import { z } from "zod";

import { templateInput } from "../datasets/template-contract.js";

const organizationId = "00000000-0000-4000-8000-000000000001";
const sourcePrefix = "Fulcrum · ";
const unassignedProjectName = `${sourcePrefix}Sin proyecto`;

const environment = z
  .object({
    DATABASE_URL: z.url({ protocol: /^postgres(ql)?$/ }),
    FULCRUM_API_TOKEN: z.string().trim().min(20),
    FULCRUM_API_URL: z.url({ protocol: /^https$/ }).optional(),
  })
  .parse(process.env);

const geometrySchema = z
  .object({
    type: z.enum(["Point", "LineString", "Polygon"]),
    coordinates: z.unknown(),
  })
  .strict();

type FulcrumElement = {
  type: string;
  key: string;
  label: string;
  dataName: string | null;
  description: string | null;
  required: boolean;
  numeric: boolean;
  multiple: boolean;
  choices: readonly string[];
  elements: readonly FulcrumElement[];
};
type FulcrumForm = {
  id: string;
  name: string;
  description: string;
  geometryTypes: readonly string[];
  elements: readonly FulcrumElement[];
};
type FulcrumProject = { id: string; name: string; description: string };
type FulcrumRecord = {
  id: string;
  projectId: string | null;
  formValues: Readonly<Record<string, unknown>>;
  geometry: z.infer<typeof geometrySchema> | null;
  status: string | null;
  createdAt: string | null;
  updatedAt: string | null;
};
type HansaField = {
  id: string;
  key: string;
  label: string;
  type:
    | "shortText"
    | "longText"
    | "number"
    | "boolean"
    | "date"
    | "time"
    | "singleChoice"
    | "multipleChoice"
    | "photo"
    | "file"
    | "signature";
  required: boolean;
  options?: string[];
  description?: string;
};
type HansaSchema = z.infer<typeof templateInput>["schema"];
type HansaForm = {
  form: FulcrumForm;
  schema: HansaSchema;
  fieldsBySourceKey: ReadonlyMap<string, HansaField>;
  datasetId: string;
  appId: string;
};

const apiBase = (
  environment.FULCRUM_API_URL ?? "https://api.fulcrumapp.com/api/v2"
).replace(/\/$/, "");

function stableUuid(value: string): string {
  const bytes = createHash("sha256").update(value).digest().subarray(0, 16);
  bytes[6] = (bytes[6]! & 0x0f) | 0x50;
  bytes[8] = (bytes[8]! & 0x3f) | 0x80;
  const hex = bytes.toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function safeKey(value: string, fallback: string): string {
  const normalized = value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 56);
  const candidate = normalized || fallback;
  return /^[a-z]/.test(candidate) ? candidate : `field_${candidate}`;
}

function asRecord(value: unknown): Readonly<Record<string, unknown>> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Readonly<Record<string, unknown>>)
    : {};
}

function asString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function asBoolean(value: unknown): boolean {
  return value === true;
}

function parseElement(value: unknown): FulcrumElement {
  const source = asRecord(value);
  const childElements = Array.isArray(source.elements)
    ? source.elements.map(parseElement)
    : [];
  const choices = Array.isArray(source.choices)
    ? source.choices.flatMap((choice) => {
        const choiceValue = asString(asRecord(choice).value);
        return choiceValue ? [choiceValue] : [];
      })
    : [];
  const key = asString(source.key);
  if (!key) throw new Error("Fulcrum devolvió un campo sin key.");
  return {
    type: asString(source.type) ?? "UnknownField",
    key,
    label: asString(source.label) ?? key,
    dataName: asString(source.data_name),
    description: asString(source.description),
    required: asBoolean(source.required),
    numeric: asBoolean(source.numeric),
    multiple: asBoolean(source.multiple),
    choices,
    elements: childElements,
  };
}

function flattenElements(
  elements: readonly FulcrumElement[],
): FulcrumElement[] {
  return elements.flatMap((element) =>
    element.type === "Section" ? flattenElements(element.elements) : [element],
  );
}

function fieldType(element: FulcrumElement): HansaField["type"] {
  if (element.type === "ChoiceField")
    return element.multiple ? "multipleChoice" : "singleChoice";
  if (element.type === "YesNoField") return "boolean";
  if (element.type === "DateField") return "date";
  if (element.type === "TimeField") return "time";
  if (element.type === "TextField" && element.numeric) return "number";
  if (
    [
      "PhotoField",
      "VideoField",
      "AudioField",
      "AttachmentField",
      "SignatureField",
      "Repeatable",
    ].includes(element.type)
  )
    return "longText";
  return "shortText";
}

function normalizeChoice(
  value: unknown,
  multiple: boolean,
): string | string[] | null {
  const source = asRecord(value);
  const values = [
    ...(Array.isArray(source.choice_values)
      ? source.choice_values.filter(
          (item): item is string => typeof item === "string",
        )
      : []),
    ...(Array.isArray(source.other_values)
      ? source.other_values.filter(
          (item): item is string => typeof item === "string",
        )
      : []),
  ];
  return multiple ? values : (values[0] ?? null);
}

function normalizeValue(value: unknown, field: HansaField): unknown {
  if (value === null || value === undefined) return null;
  if (field.type === "number") {
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string") {
      const parsed = Number(value.trim().replace(",", "."));
      return Number.isFinite(parsed) ? parsed : null;
    }
    return null;
  }
  if (field.type === "boolean") {
    if (typeof value === "boolean") return value;
    if (typeof value === "string") {
      const normalized = value.trim().toLowerCase();
      if (["true", "1", "yes", "si", "sí"].includes(normalized)) return true;
      if (["false", "0", "no"].includes(normalized)) return false;
    }
    return null;
  }
  if (field.type === "singleChoice" || field.type === "multipleChoice")
    return normalizeChoice(value, field.type === "multipleChoice");
  return typeof value === "string" ? value : JSON.stringify(value);
}

async function fulcrumJson(path: string): Promise<unknown> {
  const response = await fetch(`${apiBase}${path}`, {
    headers: {
      Accept: "application/json",
      "X-ApiToken": environment.FULCRUM_API_TOKEN,
    },
  });
  const body: unknown = await response.json();
  if (!response.ok)
    throw new Error(`Fulcrum ${response.status}: ${JSON.stringify(body)}`);
  return body;
}

async function loadForms(): Promise<FulcrumForm[]> {
  const catalog = asRecord(await fulcrumJson("/forms.json?per_page=200"));
  const forms = Array.isArray(catalog.forms) ? catalog.forms : [];
  return Promise.all(
    forms.map(async (summary) => {
      const id = asString(asRecord(summary).id);
      if (!id) throw new Error("Fulcrum devolvió un formulario sin ID.");
      const body = asRecord(await fulcrumJson(`/forms/${id}.json`));
      const form = asRecord(body.form);
      const name = asString(form.name);
      if (!name) throw new Error(`Formulario ${id} sin nombre.`);
      return {
        id,
        name,
        description: asString(form.description) ?? "",
        geometryTypes: Array.isArray(form.geometry_types)
          ? form.geometry_types.filter(
              (item): item is string => typeof item === "string",
            )
          : [],
        elements: Array.isArray(form.elements)
          ? form.elements.map(parseElement)
          : [],
      };
    }),
  );
}

async function loadProjects(): Promise<FulcrumProject[]> {
  const body = asRecord(await fulcrumJson("/projects.json?per_page=200"));
  const projects = Array.isArray(body.projects) ? body.projects : [];
  return projects.flatMap((value) => {
    const project = asRecord(value);
    const id = asString(project.id);
    const name = asString(project.name);
    return id && name
      ? [{ id, name, description: asString(project.description) ?? "" }]
      : [];
  });
}

async function loadRecords(formId: string): Promise<FulcrumRecord[]> {
  const result: FulcrumRecord[] = [];
  let page = 1;
  let totalPages = 1;
  do {
    const response = asRecord(
      await fulcrumJson(
        `/records.json?form_id=${formId}&page=${page}&per_page=500`,
      ),
    );
    totalPages =
      typeof response.total_pages === "number" ? response.total_pages : 1;
    const records = Array.isArray(response.records) ? response.records : [];
    for (const value of records) {
      const record = asRecord(value);
      const id = asString(record.id);
      if (!id)
        throw new Error(`Registro de Fulcrum sin ID en formulario ${formId}.`);
      const geometry =
        record.geometry == null ? null : geometrySchema.parse(record.geometry);
      result.push({
        id,
        projectId: asString(record.project_id),
        formValues: asRecord(record.form_values),
        geometry,
        status: asString(record.status),
        createdAt: asString(record.created_at),
        updatedAt: asString(record.updated_at),
      });
    }
    process.stdout.write(`Fulcrum ${formId}: página ${page}/${totalPages}\n`);
    page += 1;
  } while (page <= totalPages);
  return result;
}

function hansaSchema(
  form: FulcrumForm,
  records: readonly FulcrumRecord[],
): { schema: HansaSchema; fieldsBySourceKey: ReadonlyMap<string, HansaField> } {
  const optionsByKey = new Map<string, Set<string>>();
  for (const record of records)
    for (const [key, value] of Object.entries(record.formValues)) {
      const values = normalizeChoice(value, true);
      if (Array.isArray(values) && values.length) {
        const options = optionsByKey.get(key) ?? new Set<string>();
        values.forEach((item) => options.add(item));
        optionsByKey.set(key, options);
      }
    }
  const usedKeys = new Set<string>();
  const fieldsBySourceKey = new Map<string, HansaField>();
  const makeField = (element: FulcrumElement): HansaField => {
    const baseKey = safeKey(element.dataName ?? element.key, element.key);
    let key = `fulcrum_${baseKey}`.slice(0, 64);
    if (usedKeys.has(key))
      key = `fulcrum_${baseKey.slice(0, 50)}_${element.key}`.slice(0, 64);
    usedKeys.add(key);
    const type = fieldType(element);
    const options =
      type === "singleChoice" || type === "multipleChoice"
        ? [
            ...new Set([
              ...element.choices,
              ...(optionsByKey.get(element.key) ?? []),
            ]),
          ].slice(0, 100)
        : undefined;
    const field: HansaField = {
      id: stableUuid(`fulcrum:${form.id}:field:${element.key}`),
      key,
      label: element.label,
      type: options?.length
        ? type
        : type === "singleChoice" || type === "multipleChoice"
          ? "shortText"
          : type,
      required: false,
      ...(options?.length ? { options } : {}),
      ...(element.description ? { description: element.description } : {}),
    };
    fieldsBySourceKey.set(element.key, field);
    return field;
  };
  const sections: HansaSchema["sections"] = [];
  const general: HansaField[] = [];
  for (const element of form.elements) {
    if (element.type !== "Section") {
      general.push(makeField(element));
      continue;
    }
    const nested = flattenElements(element.elements).map(makeField);
    if (nested.length)
      sections.push({
        id: stableUuid(`fulcrum:${form.id}:section:${element.key}`),
        title: element.label,
        ...(element.description ? { subtitle: element.description } : {}),
        fields: nested,
      });
  }
  const metadata: HansaField[] = [
    {
      id: stableUuid(`fulcrum:${form.id}:meta:record`),
      key: "fulcrum_record_id",
      label: "ID de registro Fulcrum",
      type: "shortText",
      required: false,
    },
    {
      id: stableUuid(`fulcrum:${form.id}:meta:project`),
      key: "fulcrum_project_id",
      label: "ID de proyecto Fulcrum",
      type: "shortText",
      required: false,
    },
    {
      id: stableUuid(`fulcrum:${form.id}:meta:status`),
      key: "fulcrum_status",
      label: "Estado Fulcrum",
      type: "shortText",
      required: false,
    },
    {
      id: stableUuid(`fulcrum:${form.id}:meta:created`),
      key: "fulcrum_created_at",
      label: "Creado en Fulcrum",
      type: "shortText",
      required: false,
    },
    {
      id: stableUuid(`fulcrum:${form.id}:meta:updated`),
      key: "fulcrum_updated_at",
      label: "Actualizado en Fulcrum",
      type: "shortText",
      required: false,
    },
    {
      id: stableUuid(`fulcrum:${form.id}:meta:geometry`),
      key: "fulcrum_raw_geometry",
      label: "Geometría original de Fulcrum",
      type: "longText",
      required: false,
    },
    {
      id: stableUuid(`fulcrum:${form.id}:meta:raw`),
      key: "fulcrum_raw_values",
      label: "Valores originales de Fulcrum",
      type: "longText",
      required: false,
    },
  ];
  sections.unshift({
    id: stableUuid(`fulcrum:${form.id}:section:general`),
    title: "Información general",
    fields: [...general, ...metadata],
  });
  const allowedGeometries = ["Point", "LineString", "Polygon"] as const;
  const schema = templateInput.parse({
    name: `${sourcePrefix}${form.name}`,
    schema: {
      sections,
      settings: {
        id: `fulcrum_${form.id}`,
        name: `${sourcePrefix}${form.name}`,
        code: `FULCRUM_${createHash("sha1").update(form.id).digest("hex").slice(0, 8)}`,
        description: form.description || `Clonada desde Fulcrum: ${form.name}.`,
        allowedGeometries: form.geometryTypes.length
          ? allowedGeometries
          : allowedGeometries,
        mapIcon: "pin",
        mapColor: "#2563eb",
      },
    },
  }).schema;
  return { schema, fieldsBySourceKey };
}

async function ensureProject(client: Client, name: string): Promise<string> {
  const existing = await client.query<{ id: string }>(
    "SELECT id FROM projects WHERE organization_id=$1 AND name=$2 ORDER BY id LIMIT 1",
    [organizationId, name],
  );
  if (existing.rows[0]) return existing.rows[0].id;
  const created = await client.query<{ id: string }>(
    "INSERT INTO projects(organization_id,name) VALUES($1,$2) RETURNING id",
    [organizationId, name],
  );
  return created.rows[0]!.id;
}

async function ensureForm(
  client: Client,
  form: FulcrumForm,
  schema: HansaSchema,
): Promise<{ appId: string; datasetId: string }> {
  const name = `${sourcePrefix}${form.name}`;
  const existing = await client.query<{ app_id: string; dataset_id: string }>(
    "SELECT a.id app_id,d.id dataset_id FROM apps a JOIN datasets d ON d.app_id=a.id WHERE a.organization_id=$1 AND a.name=$2 ORDER BY a.id LIMIT 1",
    [organizationId, name],
  );
  if (existing.rows[0])
    return {
      appId: existing.rows[0].app_id,
      datasetId: existing.rows[0].dataset_id,
    };
  const template = await client.query<{ id: string }>(
    "INSERT INTO templates(organization_id,name) VALUES($1,$2) RETURNING id",
    [organizationId, `Plantilla ${name}`],
  );
  const templateVersion = await client.query<{ id: string }>(
    "INSERT INTO template_versions(template_id,version,schema_definition) VALUES($1,1,$2) RETURNING id",
    [template.rows[0]!.id, schema],
  );
  const app = await client.query<{ id: string }>(
    "INSERT INTO apps(organization_id,name,template_version_id) VALUES($1,$2,$3) RETURNING id",
    [organizationId, name, templateVersion.rows[0]!.id],
  );
  const dataset = await client.query<{ id: string }>(
    "INSERT INTO datasets(organization_id,name,app_id) VALUES($1,$2,$3) RETURNING id",
    [organizationId, name, app.rows[0]!.id],
  );
  await client.query(
    "INSERT INTO dataset_versions(dataset_id,version,schema_definition) VALUES($1,1,$2)",
    [dataset.rows[0]!.id, schema],
  );
  return { appId: app.rows[0]!.id, datasetId: dataset.rows[0]!.id };
}

async function ensureProjectApp(
  client: Client,
  projectId: string,
  appId: string,
  datasetId: string,
  schema: HansaSchema,
): Promise<string> {
  const existing = await client.query<{ id: string }>(
    "SELECT id FROM project_apps WHERE project_id=$1 AND app_id=$2",
    [projectId, appId],
  );
  if (existing.rows[0]) return existing.rows[0].id;
  const created = await client.query<{ id: string }>(
    "INSERT INTO project_apps(organization_id,project_id,app_id,dataset_id) VALUES($1,$2,$3,$4) RETURNING id",
    [organizationId, projectId, appId, datasetId],
  );
  await client.query(
    "INSERT INTO project_app_versions(project_app_id,version,schema_definition) VALUES($1,1,$2)",
    [created.rows[0]!.id, schema],
  );
  return created.rows[0]!.id;
}

function metadataId(schema: HansaSchema, key: string): string {
  const field = schema.sections
    .flatMap((section) => section.fields)
    .find((item) => item.key === key);
  if (!field) throw new Error(`Falta el campo interno ${key}.`);
  return field.id;
}

async function cloneForm(
  client: Client,
  hansaForm: HansaForm,
  records: readonly FulcrumRecord[],
  projectIds: ReadonlyMap<string, string>,
  fallbackProjectId: string,
): Promise<{ imported: number; skipped: number }> {
  const job = await client.query<{ id: string }>(
    "INSERT INTO import_jobs(organization_id,filename,checksum,rows) VALUES($1,$2,$3,'[]') RETURNING id",
    [
      organizationId,
      `fulcrum-${hansaForm.form.id}.json`,
      createHash("sha256").update(hansaForm.form.id).digest("hex"),
    ],
  );
  const projectAppIds = new Map<string, string>();
  const meta = {
    record: metadataId(hansaForm.schema, "fulcrum_record_id"),
    project: metadataId(hansaForm.schema, "fulcrum_project_id"),
    status: metadataId(hansaForm.schema, "fulcrum_status"),
    created: metadataId(hansaForm.schema, "fulcrum_created_at"),
    updated: metadataId(hansaForm.schema, "fulcrum_updated_at"),
    geometry: metadataId(hansaForm.schema, "fulcrum_raw_geometry"),
    raw: metadataId(hansaForm.schema, "fulcrum_raw_values"),
  };
  let imported = 0;
  let skipped = 0;
  for (const [index, record] of records.entries()) {
    const previous = await client.query<{ id: string }>(
      `SELECT id FROM records WHERE organization_id=$1
       AND origin->'external'->>'system'='fulcrum'
       AND origin->'external'->>'formId'=$2
       AND origin->'external'->>'recordId'=$3 LIMIT 1`,
      [organizationId, hansaForm.form.id, record.id],
    );
    if (previous.rows[0]) {
      skipped += 1;
      continue;
    }
    const projectId = record.projectId
      ? (projectIds.get(record.projectId) ?? fallbackProjectId)
      : fallbackProjectId;
    let projectAppId = projectAppIds.get(projectId);
    if (!projectAppId) {
      projectAppId = await ensureProjectApp(
        client,
        projectId,
        hansaForm.appId,
        hansaForm.datasetId,
        hansaForm.schema,
      );
      projectAppIds.set(projectId, projectAppId);
    }
    const attributes: Record<string, unknown> = {
      [meta.record]: record.id,
      [meta.project]: record.projectId,
      [meta.status]: record.status,
      [meta.created]: record.createdAt,
      [meta.updated]: record.updatedAt,
      [meta.geometry]: record.geometry ? JSON.stringify(record.geometry) : null,
      [meta.raw]: JSON.stringify(record.formValues),
    };
    for (const [sourceKey, value] of Object.entries(record.formValues)) {
      const field = hansaForm.fieldsBySourceKey.get(sourceKey);
      if (field) attributes[field.id] = normalizeValue(value, field);
    }
    const origin = {
      context: "project",
      method: "fulcrum-clone",
      external: {
        system: "fulcrum",
        formId: hansaForm.form.id,
        recordId: record.id,
        projectId: record.projectId,
      },
    };
    const created = await client.query<{ id: string }>(
      `INSERT INTO records(organization_id,dataset_id,schema_version_id,attributes,geometry,origin)
       SELECT $1,$2,v.id,$3,CASE WHEN $4::jsonb IS NULL THEN NULL
          WHEN ST_IsValid(ST_SetSRID(ST_GeomFromGeoJSON($4),4326)) THEN ST_SetSRID(ST_GeomFromGeoJSON($4),4326)
          ELSE NULL END,$5
       FROM dataset_versions v WHERE v.dataset_id=$2 ORDER BY v.version DESC LIMIT 1 RETURNING id`,
      [
        organizationId,
        hansaForm.datasetId,
        attributes,
        record.geometry,
        origin,
      ],
    );
    const recordId = created.rows[0]!.id;
    const participation = await client.query<{ id: string }>(
      "INSERT INTO project_records(organization_id,project_id,project_app_id,dataset_id,record_id,schema_definition) VALUES($1,$2,$3,$4,$5,$6) RETURNING id",
      [
        organizationId,
        projectId,
        projectAppId,
        hansaForm.datasetId,
        recordId,
        hansaForm.schema,
      ],
    );
    await client.query(
      "INSERT INTO import_sources(job_id,record_id,project_record_id,external_id) VALUES($1,$2,$3,$4)",
      [job.rows[0]!.id, recordId, participation.rows[0]!.id, record.id],
    );
    if ((index + 1) % 500 === 0)
      process.stdout.write(
        `${hansaForm.form.name}: ${index + 1}/${records.length}\n`,
      );
    imported += 1;
  }
  await client.query("UPDATE import_jobs SET result=$2 WHERE id=$1", [
    job.rows[0]!.id,
    { imported, skipped, issues: [], confirmed: true, source: "fulcrum" },
  ]);
  return { imported, skipped };
}

const client = new Client({ connectionString: environment.DATABASE_URL });
await client.connect();
try {
  const [forms, projects] = await Promise.all([loadForms(), loadProjects()]);
  const sourceRecords = new Map<string, FulcrumRecord[]>();
  for (const form of forms)
    sourceRecords.set(form.id, await loadRecords(form.id));
  const unsupported = [...sourceRecords.values()]
    .flat()
    .filter(
      (record) =>
        record.geometry &&
        !["Point", "LineString", "Polygon"].includes(record.geometry.type),
    );
  if (unsupported.length)
    throw new Error(
      `Hay ${unsupported.length} geometrías Multi* que el modelo actual de Hansa aún no admite.`,
    );
  await client.query("BEGIN");
  const projectIds = new Map<string, string>();
  for (const project of projects)
    projectIds.set(
      project.id,
      await ensureProject(client, `${sourcePrefix}${project.name}`),
    );
  const fallbackProjectId = await ensureProject(client, unassignedProjectName);
  const hansaForms: HansaForm[] = [];
  for (const form of forms) {
    const records = sourceRecords.get(form.id) ?? [];
    const { schema, fieldsBySourceKey } = hansaSchema(form, records);
    const { appId, datasetId } = await ensureForm(client, form, schema);
    hansaForms.push({ form, schema, fieldsBySourceKey, appId, datasetId });
  }
  const results: Record<string, { imported: number; skipped: number }> = {};
  for (const form of hansaForms)
    results[form.form.name] = await cloneForm(
      client,
      form,
      sourceRecords.get(form.form.id) ?? [],
      projectIds,
      fallbackProjectId,
    );
  await client.query("COMMIT");
  process.stdout.write(
    `${JSON.stringify({ projects: projects.length + 1, forms: results }, null, 2)}\n`,
  );
} catch (error: unknown) {
  await client.query("ROLLBACK");
  throw error;
} finally {
  await client.end();
}
