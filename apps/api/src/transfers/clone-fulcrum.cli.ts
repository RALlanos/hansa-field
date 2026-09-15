import { createHash } from "node:crypto";
import { Client } from "pg";
import { z } from "zod";

import { templateInput } from "../datasets/template-contract.js";

const LOCAL_ORGANIZATION = "00000000-0000-4000-8000-000000000001";
const SOURCE_PREFIX = "Fulcrum · ";

const environment = z
  .object({
    DATABASE_URL: z.url({ protocol: /^postgres(ql)?$/ }),
    FULCRUM_API_TOKEN: z.string().trim().min(20),
    FULCRUM_API_URL: z.url({ protocol: /^https$/ }).optional(),
  })
  .parse(process.env);

const argumentsSchema = z.object({
  mode: z.enum(["list", "clone"]),
  formId: z.string().min(1).optional(),
});

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

const apiBase = (
  environment.FULCRUM_API_URL ?? "https://api.fulcrumapp.com/api/v2"
).replace(/\/$/, "");

function usage(): never {
  throw new Error(
    [
      "Uso:",
      "  pnpm --filter @hansa-field/api clone:fulcrum -- --list",
      "  pnpm --filter @hansa-field/api clone:fulcrum -- --form <fulcrum-form-id>",
      "",
      "El clonador solo crea Plantilla + App + Dataset vacíos.",
      "Nunca consulta ni importa registros, proyectos ni archivos de Fulcrum.",
    ].join("\n"),
  );
}

function parseArguments(argv: readonly string[]) {
  if (argv.length === 1 && argv[0] === "--list")
    return argumentsSchema.parse({ mode: "list" });
  if (argv.length === 2 && argv[0] === "--form")
    return argumentsSchema.parse({ mode: "clone", formId: argv[1] });
  return usage();
}

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
  const key = asString(source.key);
  if (!key) throw new Error("Fulcrum devolvió un campo sin key.");
  const choices = Array.isArray(source.choices)
    ? source.choices.flatMap((choice) => {
        const text = asString(asRecord(choice).value);
        return text ? [text] : [];
      })
    : [];
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
    elements: Array.isArray(source.elements)
      ? source.elements.map(parseElement)
      : [],
  };
}

function parseForm(value: unknown): FulcrumForm {
  const source = asRecord(value);
  const form = asRecord(source.form);
  const id = asString(form.id);
  const name = asString(form.name);
  if (!id || !name)
    throw new Error("Fulcrum devolvió un formulario incompleto.");
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
}

function fieldType(element: FulcrumElement): HansaField["type"] {
  if (element.type === "ChoiceField")
    return element.multiple ? "multipleChoice" : "singleChoice";
  if (element.type === "YesNoField") return "boolean";
  if (element.type === "DateField") return "date";
  if (element.type === "TimeField") return "time";
  if (element.type === "PhotoField") return "photo";
  if (element.type === "AttachmentField") return "file";
  if (element.type === "SignatureField") return "signature";
  if (element.type === "TextField" && element.numeric) return "number";
  if (["VideoField", "AudioField", "Repeatable"].includes(element.type))
    return "longText";
  return "shortText";
}

function flattenFields(elements: readonly FulcrumElement[]): FulcrumElement[] {
  return elements.flatMap((element) =>
    element.type === "Section" ? flattenFields(element.elements) : [element],
  );
}

function hansaSchema(form: FulcrumForm): HansaSchema {
  const usedKeys = new Set<string>();
  const makeField = (element: FulcrumElement): HansaField => {
    const base = safeKey(element.dataName ?? element.key, element.key);
    let key = `fulcrum_${base}`.slice(0, 64);
    if (usedKeys.has(key))
      key =
        `fulcrum_${base.slice(0, 48)}_${createHash("sha1").update(element.key).digest("hex").slice(0, 6)}`.slice(
          0,
          64,
        );
    usedKeys.add(key);
    const type = fieldType(element);
    const choice = type === "singleChoice" || type === "multipleChoice";
    const options = choice ? [...new Set(element.choices)].slice(0, 100) : [];
    return {
      id: stableUuid(`fulcrum:${form.id}:field:${element.key}`),
      key,
      label: element.label,
      type: choice && options.length === 0 ? "shortText" : type,
      required: element.required,
      ...(options.length ? { options } : {}),
      ...(element.description ? { description: element.description } : {}),
    };
  };

  const general = form.elements.filter((element) => element.type !== "Section");
  const sections = [
    ...(general.length
      ? [
          {
            id: stableUuid(`fulcrum:${form.id}:section:general`),
            title: "Información general",
            fields: general.map(makeField),
          },
        ]
      : []),
    ...form.elements.flatMap((element) => {
      if (element.type !== "Section") return [];
      const fields = flattenFields(element.elements).map(makeField);
      return fields.length
        ? [
            {
              id: stableUuid(`fulcrum:${form.id}:section:${element.key}`),
              title: element.label,
              ...(element.description ? { subtitle: element.description } : {}),
              fields,
            },
          ]
        : [];
    }),
  ];
  const supportedGeometries = ["Point", "LineString", "Polygon"] as const;
  const allowedGeometries = form.geometryTypes.filter(
    (geometry): geometry is (typeof supportedGeometries)[number] =>
      supportedGeometries.includes(
        geometry as (typeof supportedGeometries)[number],
      ),
  );
  return templateInput.parse({
    name: `${SOURCE_PREFIX}${form.name}`,
    schema: {
      sections,
      settings: {
        id: `fulcrum_${form.id}`,
        name: `${SOURCE_PREFIX}${form.name}`,
        code: `FULCRUM_${createHash("sha1").update(form.id).digest("hex").slice(0, 8)}`,
        description: form.description || `Clonada desde Fulcrum: ${form.name}.`,
        allowedGeometries: allowedGeometries.length
          ? allowedGeometries
          : ["Point"],
        mapIcon: "pin",
        mapColor: "#2563eb",
      },
    },
  }).schema;
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

async function listForms(): Promise<readonly { id: string; name: string }[]> {
  const body = asRecord(await fulcrumJson("/forms.json?per_page=200"));
  return (Array.isArray(body.forms) ? body.forms : []).flatMap((entry) => {
    const form = asRecord(entry);
    const id = asString(form.id);
    const name = asString(form.name);
    return id && name ? [{ id, name }] : [];
  });
}

async function loadForm(formId: string): Promise<FulcrumForm> {
  return parseForm(
    await fulcrumJson(`/forms/${encodeURIComponent(formId)}.json`),
  );
}

async function cloneConfiguration(client: Client, form: FulcrumForm) {
  const schema = hansaSchema(form);
  const existing = await client.query<{ app_id: string; template_id: string }>(
    `SELECT a.id app_id,t.id template_id
     FROM apps a
     JOIN template_versions tv ON tv.id=a.template_version_id
     JOIN templates t ON t.id=tv.template_id
     WHERE a.organization_id=$1
       AND tv.schema_definition->'settings'->>'id'=$2
     ORDER BY a.id LIMIT 1`,
    [LOCAL_ORGANIZATION, `fulcrum_${form.id}`],
  );
  if (existing.rows[0])
    return {
      created: false,
      appId: existing.rows[0].app_id,
      templateId: existing.rows[0].template_id,
    };

  const template = await client.query<{ id: string }>(
    "INSERT INTO templates(organization_id,name) VALUES($1,$2) RETURNING id",
    [LOCAL_ORGANIZATION, `Plantilla ${SOURCE_PREFIX}${form.name}`],
  );
  const templateVersion = await client.query<{ id: string }>(
    "INSERT INTO template_versions(template_id,version,schema_definition) VALUES($1,1,$2) RETURNING id",
    [template.rows[0]!.id, schema],
  );
  const app = await client.query<{ id: string }>(
    "INSERT INTO apps(organization_id,name,template_version_id) VALUES($1,$2,$3) RETURNING id",
    [
      LOCAL_ORGANIZATION,
      `${SOURCE_PREFIX}${form.name}`,
      templateVersion.rows[0]!.id,
    ],
  );
  const dataset = await client.query<{ id: string }>(
    "INSERT INTO datasets(organization_id,name,app_id) VALUES($1,$2,$3) RETURNING id",
    [LOCAL_ORGANIZATION, `${SOURCE_PREFIX}${form.name}`, app.rows[0]!.id],
  );
  await client.query(
    "INSERT INTO dataset_versions(dataset_id,version,schema_definition) VALUES($1,1,$2)",
    [dataset.rows[0]!.id, schema],
  );
  return {
    created: true,
    appId: app.rows[0]!.id,
    templateId: template.rows[0]!.id,
  };
}

const command = parseArguments(process.argv.slice(2));
if (command.mode === "list") {
  process.stdout.write(`${JSON.stringify(await listForms(), null, 2)}\n`);
} else {
  const form = await loadForm(command.formId!);
  const client = new Client({ connectionString: environment.DATABASE_URL });
  await client.connect();
  try {
    await client.query("BEGIN");
    const result = await cloneConfiguration(client, form);
    await client.query("COMMIT");
    process.stdout.write(
      `${JSON.stringify({ form: { id: form.id, name: form.name }, recordsImported: 0, projectsImported: 0, ...result }, null, 2)}\n`,
    );
  } catch (error: unknown) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    await client.end();
  }
}
