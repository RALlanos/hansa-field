import { basename } from "node:path";
import { readFile } from "node:fs/promises";

type Field = Readonly<{ id: string; key: string; label: string }>;
type Collection = Readonly<{
  id: string;
  name: string;
  project_id: string | null;
  project_app_id: string | null;
  version: number;
  schema_definition: Readonly<{
    sections: ReadonlyArray<Readonly<{ fields: readonly Field[] }>>;
  }>;
}>;
type Catalog = Readonly<{
  projects: ReadonlyArray<Readonly<{ id: string; name: string }>>;
  collections: readonly Collection[];
}>;
type Inspection = Readonly<{
  id: string;
  count: number;
  fields: readonly string[];
  statuses: ReadonlyArray<readonly [string, number]>;
}>;
type Summary = Readonly<{
  imported: number;
  skipped: number;
  issues: readonly string[];
  confirmed: boolean;
}>;

const apiUrl = process.env.IMPORT_API_URL ?? "http://localhost:3100/api";
const projectName = "Proyecto Piloto Santa Cruz";
const pointArchive = process.argv[2];
const lineArchive = process.argv[3];
if (!pointArchive || !lineArchive) {
  throw new Error(
    "Uso: tsx src/transfers/import-tigo-reference.cli.ts <puntos.zip> <lineas.zip>",
  );
}

function sourceKey(source: string): string {
  const normalized = source
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/^_+/, "source_")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 64);
  return /^[a-z]/.test(normalized)
    ? normalized
    : `field_${normalized}`.slice(0, 64);
}

function appForPointStatus(status: string): string {
  if (["TAPS", "TAP SATURADO", "TAP SOBRECARGADO"].includes(status))
    return "Taps FTTH";
  const mapping: Readonly<Record<string, string>> = {
    POSTES: "Postes",
    NODO: "Nodos de red",
    DIVISORES: "Divisores ópticos",
    AMPLIFICADORES: "Amplificadores HFC",
    EDIFICIOS: "Edificios",
    XBOX: "Cajas terminales FTTH",
    MEC: "MEC",
  };
  const app = mapping[status];
  if (!app)
    throw new Error(`No existe una App configurada para el estado: ${status}`);
  return app;
}

async function responseBody<T>(response: Response): Promise<T> {
  const data: unknown = await response.json();
  if (!response.ok) {
    const message =
      typeof data === "object" && data !== null && "message" in data
        ? String(data.message)
        : "La API rechazó la importación.";
    throw new Error(message);
  }
  return data as T;
}

async function inspect(path: string): Promise<Inspection> {
  const form = new FormData();
  form.set(
    "file",
    new Blob([await readFile(path)], { type: "application/zip" }),
    basename(path),
  );
  return responseBody<Inspection>(
    await fetch(`${apiUrl}/workspace/imports/inspect`, {
      method: "POST",
      body: form,
    }),
  );
}

async function importArchive(
  catalog: Catalog,
  projectId: string,
  path: string,
  appForStatus: (status: string) => string,
): Promise<Summary> {
  const inspection = await inspect(path);
  const routes = inspection.statuses.map(([status]) => {
    const appName = appForStatus(status);
    const collection = catalog.collections.find(
      (candidate) =>
        candidate.name === appName &&
        candidate.project_id === projectId &&
        candidate.project_app_id,
    );
    if (!collection || !collection.project_app_id)
      throw new Error(`Falta la Project App ${appName}.`);
    const fields = collection.schema_definition.sections.flatMap(
      (section) => section.fields,
    );
    const mapping = Object.fromEntries(
      inspection.fields.flatMap((source) => {
        const field = fields.find(
          (candidate) =>
            candidate.key === sourceKey(source) || candidate.label === source,
        );
        return field ? [[source, field.id]] : [];
      }),
    );
    return {
      datasetId: collection.id,
      projectId,
      projectAppId: collection.project_app_id,
      expectedVersion: collection.version,
      status,
      mapping,
    };
  });
  const payload = { routes };
  const preview = await responseBody<Summary>(
    await fetch(`${apiUrl}/workspace/imports/${inspection.id}/preview`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    }),
  );
  if (preview.issues.length)
    throw new Error(
      `Preview rechazado: ${preview.issues.slice(0, 5).join("; ")}`,
    );
  const result = await responseBody<Summary>(
    await fetch(`${apiUrl}/workspace/imports/${inspection.id}/confirm`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    }),
  );
  if (!result.confirmed) throw new Error("La API no confirmó la importación.");
  return result;
}

const catalog = await responseBody<Catalog>(await fetch(`${apiUrl}/workspace`));
const project = catalog.projects.find(
  (candidate) => candidate.name === projectName,
);
if (!project) throw new Error(`Falta el proyecto: ${projectName}`);
const points = await importArchive(
  catalog,
  project.id,
  pointArchive,
  appForPointStatus,
);
const lines = await importArchive(
  catalog,
  project.id,
  lineArchive,
  () => "Red lineal HFC/FTTH",
);
process.stdout.write(
  `${JSON.stringify({ project: projectName, points, lines }, null, 2)}\n`,
);
