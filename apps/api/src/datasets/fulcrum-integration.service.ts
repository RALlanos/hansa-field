import { createHash } from "node:crypto";
import {
  BadRequestException,
  Injectable,
  ServiceUnavailableException,
} from "@nestjs/common";
import { z } from "zod";

import { DatabaseService } from "../database/database.service.js";
import { templateInput } from "./template-contract.js";
const LOCAL_ORGANIZATION = "00000000-0000-4000-8000-000000000001";

const sourcePrefix = "Fulcrum · ";
const supportedGeometries = ["Point", "LineString", "Polygon"] as const;

type SourceElement = {
  readonly type: string;
  readonly key: string;
  readonly label: string;
  readonly dataName: string | null;
  readonly description: string | null;
  readonly required: boolean;
  readonly numeric: boolean;
  readonly multiple: boolean;
  readonly choices: readonly {
    value: string;
    label: string;
    color: string | null;
  }[];
  readonly elements: readonly SourceElement[];
};

type SourceForm = {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly geometryTypes: readonly string[];
  readonly elements: readonly SourceElement[];
  readonly status: SourceElement | null;
};

const cloneInput = z
  .object({
    formId: z.string().uuid(),
    strategy: z.enum(["preserve", "sections", "fieldValues"]),
    splitFieldKey: z.string().min(1).max(128).optional(),
    projectId: z.string().uuid().optional(),
    projectName: z.string().trim().min(1).max(160).optional(),
  })
  .strict()
  .superRefine((input, ctx) => {
    if (input.strategy === "fieldValues" && !input.splitFieldKey)
      ctx.addIssue({
        code: "custom",
        path: ["splitFieldKey"],
        message: "Selecciona el campo para separar.",
      });
    if (input.projectId && input.projectName)
      ctx.addIssue({
        code: "custom",
        path: ["projectName"],
        message: "Elige un proyecto existente o escribe uno nuevo, no ambos.",
      });
  });

const temporaryToken = z
  .string()
  .trim()
  .min(24)
  .max(512)
  .regex(/^[A-Za-z0-9._-]+$/, "El token temporal de Fulcrum no es válido.");

function asRecord(value: unknown): Readonly<Record<string, unknown>> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Readonly<Record<string, unknown>>)
    : {};
}

function stringValue(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function booleanValue(value: unknown): boolean {
  return value === true;
}

function colorValue(value: unknown): string | null {
  return typeof value === "string" && /^#[0-9a-fA-F]{6}$/.test(value)
    ? value
    : null;
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

function parseElement(value: unknown): SourceElement {
  const source = asRecord(value);
  const key = stringValue(source.key);
  if (!key)
    throw new BadRequestException(
      "Fulcrum devolvió un campo sin identificador.",
    );
  return {
    type: stringValue(source.type) ?? "UnknownField",
    key,
    label: stringValue(source.label) ?? key,
    dataName: stringValue(source.data_name),
    description: stringValue(source.description),
    required: booleanValue(source.required),
    numeric: booleanValue(source.numeric),
    multiple: booleanValue(source.multiple),
    choices: Array.isArray(source.choices)
      ? source.choices.flatMap((choice) => {
          const item = asRecord(choice);
          const value = stringValue(item.value);
          return value
            ? [
                {
                  value,
                  label: stringValue(item.label) ?? value,
                  color: colorValue(item.color),
                },
              ]
            : [];
        })
      : [],
    elements: Array.isArray(source.elements)
      ? source.elements.map(parseElement)
      : [],
  };
}

function parseForm(value: unknown): SourceForm {
  const form = asRecord(asRecord(value).form);
  const id = stringValue(form.id);
  const name = stringValue(form.name);
  if (!id || !name)
    throw new BadRequestException("Fulcrum devolvió una App incompleta.");
  const statusRaw = form.status_field;
  return {
    id,
    name,
    description: stringValue(form.description) ?? "",
    geometryTypes: Array.isArray(form.geometry_types)
      ? form.geometry_types.filter(
          (value): value is string => typeof value === "string",
        )
      : [],
    elements: Array.isArray(form.elements)
      ? form.elements.map(parseElement)
      : [],
    status:
      statusRaw && typeof statusRaw === "object"
        ? parseElement(statusRaw)
        : null,
  };
}

function flatten(elements: readonly SourceElement[]): SourceElement[] {
  return elements.flatMap((element) =>
    element.type === "Section" ? flatten(element.elements) : [element],
  );
}

function sourceType(element: SourceElement) {
  if (element.type === "ChoiceField")
    return element.multiple ? "multipleChoice" : "singleChoice";
  if (element.type === "YesNoField") return "boolean";
  if (element.type === "DateField" || element.type === "DateTimeField")
    return "date";
  if (element.type === "TimeField") return "time";
  if (element.type === "PhotoField") return "photo";
  if (element.type === "AttachmentField") return "file";
  if (element.type === "SignatureField") return "signature";
  if (element.type === "TextField" && element.numeric) return "number";
  return "shortText";
}

function allFields(form: SourceForm): SourceElement[] {
  return [...(form.status ? [form.status] : []), ...flatten(form.elements)];
}

function buildSchema(
  form: SourceForm,
  identity: string,
  selected: readonly SourceElement[],
  routing: { fieldKey: string; value: string } | null,
) {
  const usedKeys = new Set<string>();
  const fields = new Map<string, { id: string; key: string }>();
  const toField = (element: SourceElement) => {
    const base = safeKey(element.dataName ?? element.key, element.key);
    let key = `fulcrum_${base}`.slice(0, 64);
    if (usedKeys.has(key))
      key =
        `fulcrum_${base.slice(0, 48)}_${createHash("sha1").update(element.key).digest("hex").slice(0, 6)}`.slice(
          0,
          64,
        );
    usedKeys.add(key);
    const type = sourceType(element);
    const options = [
      ...new Set(element.choices.map((choice) => choice.value)),
    ].slice(0, 100);
    const field = {
      id: stableUuid(`fulcrum:${form.id}:${identity}:field:${element.key}`),
      key,
      label: element.label,
      type: (options.length ||
      (type !== "singleChoice" && type !== "multipleChoice")
        ? type
        : "shortText") as
        | "shortText"
        | "number"
        | "boolean"
        | "date"
        | "time"
        | "singleChoice"
        | "multipleChoice"
        | "photo"
        | "file"
        | "signature",
      required: element.required,
      ...(options.length ? { options } : {}),
      ...(element.description ? { description: element.description } : {}),
    };
    fields.set(element.key, { id: field.id, key: field.key });
    return field;
  };
  const include = new Set(selected.map((field) => field.key));
  const general = form.elements.filter(
    (element) => element.type !== "Section" && include.has(element.key),
  );
  const sections = [
    ...(form.status && include.has(form.status.key)
      ? [
          {
            id: stableUuid(`fulcrum:${form.id}:${identity}:section:status`),
            title: "Estado",
            fields: [toField(form.status)],
          },
        ]
      : []),
    ...(general.length
      ? [
          {
            id: stableUuid(`fulcrum:${form.id}:${identity}:section:general`),
            title: "Información general",
            fields: general.map(toField),
          },
        ]
      : []),
    ...form.elements.flatMap((element) => {
      if (element.type !== "Section") return [];
      const items = flatten(element.elements).filter((field) =>
        include.has(field.key),
      );
      return items.length
        ? [
            {
              id: stableUuid(
                `fulcrum:${form.id}:${identity}:section:${element.key}`,
              ),
              title: element.label,
              ...(element.description ? { subtitle: element.description } : {}),
              fields: items.map(toField),
            },
          ]
        : [];
    }),
  ];
  const statusField = form.status ? fields.get(form.status.key) : undefined;
  const rules =
    form.status && statusField
      ? form.status.choices.flatMap((choice) =>
          choice.color
            ? [
                {
                  value: choice.value,
                  color: choice.color,
                  icon: "pin" as const,
                },
              ]
            : [],
        )
      : [];
  const geometries = form.geometryTypes.filter(
    (type): type is (typeof supportedGeometries)[number] =>
      supportedGeometries.includes(
        type as (typeof supportedGeometries)[number],
      ),
  );
  return templateInput.parse({
    name: `${sourcePrefix}${form.name}`,
    schema: {
      sections,
      settings: {
        id: `fulcrum:${form.id}:${identity}`,
        name: `${sourcePrefix}${form.name}`,
        code: `FULCRUM_${createHash("sha1").update(`${form.id}:${identity}`).digest("hex").slice(0, 8)}`,
        description: form.description || `Clonada desde Fulcrum: ${form.name}.`,
        allowedGeometries: geometries.length ? geometries : ["Point"],
        mapIcon: "pin",
        mapColor: "#2563eb",
        ...(rules.length && statusField
          ? { mapStyle: { fieldId: statusField.id, rules } }
          : {}),
        ...(routing ? { sourceRouting: routing } : {}),
      },
    },
  }).schema;
}

@Injectable()
export class FulcrumIntegrationService {
  constructor(private readonly database: DatabaseService) {}

  private token(requestToken?: string) {
    const token = requestToken
      ? temporaryToken.parse(requestToken)
      : process.env.FULCRUM_API_TOKEN?.trim();
    if (!token)
      throw new ServiceUnavailableException(
        "Fulcrum no está configurado en el servidor. Define FULCRUM_API_TOKEN solo en el entorno de API.",
      );
    return token;
  }

  private async get(path: string, requestToken?: string): Promise<unknown> {
    const base = (
      process.env.FULCRUM_API_URL ?? "https://api.fulcrumapp.com/api/v2"
    ).replace(/\/$/, "");
    const response = await fetch(`${base}${path}`, {
      headers: {
        Accept: "application/json",
        "X-ApiToken": this.token(requestToken),
      },
    });
    const text = await response.text();
    if (!response.ok)
      throw new BadRequestException(`Fulcrum respondió ${response.status}.`);
    if (!text) return {};
    try {
      return JSON.parse(text) as unknown;
    } catch {
      throw new BadRequestException(
        "Fulcrum devolvió una respuesta que no es JSON.",
      );
    }
  }

  async forms(requestToken?: string) {
    const body = asRecord(
      await this.get("/forms.json?per_page=200", requestToken),
    );
    return (Array.isArray(body.forms) ? body.forms : []).flatMap((form) => {
      const source = asRecord(form);
      const id = stringValue(source.id);
      const name = stringValue(source.name);
      return id && name
        ? [
            {
              id,
              name,
              recordCount:
                typeof source.record_count === "number"
                  ? source.record_count
                  : null,
            },
          ]
        : [];
    });
  }

  async preview(formId: string, requestToken?: string) {
    const form = parseForm(
      await this.get(`/forms/${encodeURIComponent(formId)}.json`, requestToken),
    );
    return {
      id: form.id,
      name: form.name,
      description: form.description,
      geometryTypes: form.geometryTypes,
      sections: form.elements
        .filter((element) => element.type === "Section")
        .map((section) => ({
          key: section.key,
          label: section.label,
          fieldCount: flatten(section.elements).length,
        })),
      fields: allFields(form).map((field) => ({
        key: field.key,
        label: field.label,
        type: field.type,
        choices: field.choices,
        required: field.required,
        isStatus: field.key === form.status?.key,
      })),
      statusFieldKey: form.status?.key ?? null,
    };
  }

  async clone(raw: unknown, requestToken?: string) {
    const input = cloneInput.parse(raw);
    const form = parseForm(
      await this.get(
        `/forms/${encodeURIComponent(input.formId)}.json`,
        requestToken,
      ),
    );
    const fields = allFields(form);
    const outputs =
      input.strategy === "preserve"
        ? [
            {
              identity: "preserve",
              label: form.name,
              fields,
              routing: null as { fieldKey: string; value: string } | null,
            },
          ]
        : input.strategy === "sections"
          ? form.elements
              .filter((section) => section.type === "Section")
              .map((section) => ({
                identity: `section:${section.key}`,
                label: `${form.name} · ${section.label}`,
                fields: [
                  ...form.elements.filter(
                    (element) => element.type !== "Section",
                  ),
                  ...flatten(section.elements),
                  ...(form.status ? [form.status] : []),
                ],
                routing: null as { fieldKey: string; value: string } | null,
              }))
          : (() => {
              const field = fields.find(
                (candidate) => candidate.key === input.splitFieldKey,
              );
              if (!field?.choices.length)
                throw new BadRequestException(
                  "El campo elegido debe tener valores configurados en Fulcrum.",
                );
              return field.choices.map((choice) => ({
                identity: `value:${field.key}:${choice.value}`,
                label: `${form.name} · ${choice.label}`,
                fields,
                routing: { fieldKey: field.key, value: choice.value },
              }));
            })();
    if (!outputs.length)
      throw new BadRequestException(
        "La estrategia elegida no produjo Apps. Revisa la configuración del formulario origen.",
      );
    return this.database.withTransaction(async (tx) => {
      let projectId = input.projectId;
      if (input.projectName) {
        const project = await tx.query<{ id: string }>(
          "INSERT INTO projects(organization_id,name) VALUES($1,$2) RETURNING id",
          [LOCAL_ORGANIZATION, input.projectName],
        );
        projectId = project.rows[0]!.id;
      }
      if (projectId) {
        const exists = await tx.query(
          "SELECT id FROM projects WHERE id=$1 AND organization_id=$2",
          [projectId, LOCAL_ORGANIZATION],
        );
        if (!exists.rows[0])
          throw new BadRequestException("Proyecto destino inexistente.");
      }
      const apps: { id: string; name: string; created: boolean }[] = [];
      for (const output of outputs) {
        const schema = buildSchema(
          form,
          output.identity,
          output.fields,
          output.routing,
        );
        const existing = await tx.query<{
          app_id: string;
          app_name: string;
          dataset_id: string;
        }>(
          `SELECT a.id app_id,a.name app_name,d.id dataset_id FROM apps a JOIN datasets d ON d.app_id=a.id JOIN template_versions tv ON tv.id=a.template_version_id WHERE a.organization_id=$1 AND tv.schema_definition->'settings'->>'id'=$2 LIMIT 1`,
          [LOCAL_ORGANIZATION, schema.settings.id],
        );
        let appId: string;
        let datasetId: string;
        if (existing.rows[0]) {
          appId = existing.rows[0].app_id;
          datasetId = existing.rows[0].dataset_id;
          apps.push({
            id: appId,
            name: existing.rows[0].app_name,
            created: false,
          });
        } else {
          const template = await tx.query<{ id: string }>(
            "INSERT INTO templates(organization_id,name) VALUES($1,$2) RETURNING id",
            [LOCAL_ORGANIZATION, `Plantilla ${sourcePrefix}${output.label}`],
          );
          const version = await tx.query<{ id: string }>(
            "INSERT INTO template_versions(template_id,version,schema_definition) VALUES($1,1,$2) RETURNING id",
            [template.rows[0]!.id, schema],
          );
          const app = await tx.query<{ id: string }>(
            "INSERT INTO apps(organization_id,name,template_version_id) VALUES($1,$2,$3) RETURNING id",
            [
              LOCAL_ORGANIZATION,
              `${sourcePrefix}${output.label}`,
              version.rows[0]!.id,
            ],
          );
          appId = app.rows[0]!.id;
          const dataset = await tx.query<{ id: string }>(
            "INSERT INTO datasets(organization_id,name,app_id) VALUES($1,$2,$3) RETURNING id",
            [LOCAL_ORGANIZATION, `${sourcePrefix}${output.label}`, appId],
          );
          datasetId = dataset.rows[0]!.id;
          await tx.query(
            "INSERT INTO dataset_versions(dataset_id,version,schema_definition) VALUES($1,1,$2)",
            [datasetId, schema],
          );
          apps.push({
            id: appId,
            name: `${sourcePrefix}${output.label}`,
            created: true,
          });
        }
        if (projectId) {
          const membership = await tx.query<{ id: string }>(
            "INSERT INTO project_apps(organization_id,project_id,app_id,dataset_id) VALUES($1,$2,$3,$4) ON CONFLICT(project_id,app_id) DO NOTHING RETURNING id",
            [LOCAL_ORGANIZATION, projectId, appId, datasetId],
          );
          if (membership.rows[0])
            await tx.query(
              "INSERT INTO project_app_versions(project_app_id,version,schema_definition,settings) VALUES($1,1,$2,$3)",
              [
                membership.rows[0].id,
                schema,
                {
                  symbol: {
                    icon: schema.settings.mapIcon,
                    color: schema.settings.mapColor,
                    label: schema.settings.name,
                  },
                },
              ],
            );
        }
      }
      return {
        source: { id: form.id, name: form.name },
        strategy: input.strategy,
        projectId: projectId ?? null,
        apps,
        recordsImported: 0,
      };
    });
  }
}
