import { Client } from "pg";
import { z } from "zod";

const organizationId = "00000000-0000-4000-8000-000000000001";
const environment = z
  .object({
    DATABASE_URL: z.url({ protocol: /^postgres(ql)?$/ }),
    STRESS_RECORDS: z.coerce
      .number()
      .int()
      .min(1_000)
      .max(2_000_000)
      .default(1_000_000),
    STRESS_BATCH: z.coerce
      .number()
      .int()
      .min(1_000)
      .max(50_000)
      .default(10_000),
  })
  .parse(process.env);

type Field = { id: string; key: string };
type Dataset = {
  id: string;
  versionId: string;
  schema: { sections: { fields: Field[] }[] };
};
type SeedKind =
  "postes" | "taps" | "divisores" | "amplificadores" | "nodos" | "lineas";
type SeedDefinition = { name: string; kind: SeedKind; weight: number };

const definitions: SeedDefinition[] = [
  { name: "Postes", kind: "postes", weight: 0.55 },
  { name: "Taps FTTH", kind: "taps", weight: 0.2 },
  { name: "Divisores ópticos", kind: "divisores", weight: 0.09 },
  { name: "Amplificadores HFC", kind: "amplificadores", weight: 0.05 },
  { name: "Nodos de red", kind: "nodos", weight: 0.025 },
  { name: "Red lineal HFC/FTTH", kind: "lineas", weight: 0.085 },
];

function fieldId(dataset: Dataset, key: string): string {
  const field = dataset.schema.sections
    .flatMap((section) => section.fields)
    .find((item) => item.key === key);
  if (!field)
    throw new Error(`El dataset no contiene el campo requerido: ${key}`);
  return field.id;
}

function requiredId(
  ids: Readonly<Record<string, string>>,
  key: string,
): string {
  const id = ids[key];
  if (!id) throw new Error(`El dataset no contiene el campo requerido: ${key}`);
  return id;
}

function attributes(
  kind: SeedKind,
  ids: Record<string, string>,
): { expression: string; values: string[] } {
  if (kind === "postes")
    return {
      expression:
        "jsonb_build_object($8::text,'P-'||g,$9::text,CASE WHEN g%4=0 THEN 'Madera' WHEN g%4=1 THEN 'Metálico' ELSE 'Hormigón' END,$10::text,CASE WHEN g%2=0 THEN 9 ELSE 11 END,$11::text,CASE WHEN g%20=0 THEN 'Mantenimiento' ELSE 'Operativo' END,$12::text,CASE WHEN g%2=0 THEN 'Tigo' ELSE 'CRE' END)",
      values: ["codigo", "tipo", "altura_m", "estado", "empresa"].map((key) =>
        requiredId(ids, key),
      ),
    };
  if (kind === "taps")
    return {
      expression:
        "jsonb_build_object($8::text,'T-'||g,$9::text,8,$10::text,g%8,$11::text,CASE WHEN g%15=0 THEN 'Mantenimiento' ELSE 'Operativo' END,$12::text,CASE WHEN g%2=0 THEN 'La Paz' ELSE 'Santa Cruz' END)",
      values: ["codigo", "capacidad", "puertos_ocupados", "estado", "zona"].map(
        (key) => requiredId(ids, key),
      ),
    };
  if (kind === "divisores")
    return {
      expression:
        "jsonb_build_object($8::text,'S-'||g,$9::text,CASE WHEN g%3=0 THEN '1:32' WHEN g%3=1 THEN '1:16' ELSE '1:8' END,$10::text,'Operativo',$11::text,'NODO-'||(g%50000))",
      values: ["codigo", "relacion", "estado", "nodo"].map((key) =>
        requiredId(ids, key),
      ),
    };
  if (kind === "amplificadores")
    return {
      expression:
        "jsonb_build_object($8::text,'A-'||g,$9::text,CASE WHEN g%3=0 THEN 'ARRIS' WHEN g%3=1 THEN 'Cisco' ELSE 'Harmonic' END,$10::text,CASE WHEN g%25=0 THEN 'Alarma' ELSE 'Operativo' END,$11::text,'NODO-'||(g%50000))",
      values: ["codigo", "marca", "estado", "nodo"].map((key) =>
        requiredId(ids, key),
      ),
    };
  if (kind === "nodos")
    return {
      expression:
        "jsonb_build_object($8::text,'N-'||g,$9::text,CASE WHEN g%3=0 THEN 'HFC' WHEN g%3=1 THEN 'FTTH' ELSE 'Híbrida' END,$10::text,'Operativo',$11::text,CASE WHEN g%2=0 THEN 512 ELSE 1024 END)",
      values: ["codigo", "tecnologia", "estado", "capacidad"].map((key) =>
        requiredId(ids, key),
      ),
    };
  return {
    expression:
      "jsonb_build_object($8::text,'L-'||g,$9::text,CASE WHEN g%4=0 THEN 'TRONCAL-860' WHEN g%4=1 THEN 'DISTRIBUCION-540' WHEN g%4=2 THEN 'DISTRIBUCION-860' ELSE 'COBERTURA FTTH' END,$10::text,'TRAMO-'||g,$11::text,CASE WHEN g%2=0 THEN 'HFC' ELSE 'FTTH' END,$12::text,'NODO-'||(g%50000))",
    values: ["source_record_id", "status", "title", "tecnologia", "nodo"].map(
      (key) => requiredId(ids, key),
    ),
  };
}

function geometry(kind: SeedKind): string {
  return kind === "lineas"
    ? "ST_SetSRID(ST_MakeLine(ST_MakePoint(-69.6+random()*7,-22.8+random()*10.2),ST_MakePoint(-69.6+random()*7,-22.8+random()*10.2)),4326)"
    : "ST_SetSRID(ST_MakePoint(-69.6+random()*7,-22.8+random()*10.2),4326)";
}

const client = new Client({ connectionString: environment.DATABASE_URL });
await client.connect();
try {
  const datasets = await client.query<{
    name: string;
    id: string;
    version_id: string;
    schema_definition: Dataset["schema"];
  }>(
    `SELECT d.name,d.id,v.id version_id,v.schema_definition FROM datasets d
     JOIN LATERAL(SELECT * FROM dataset_versions WHERE dataset_id=d.id ORDER BY version DESC LIMIT 1)v ON true
     WHERE d.name=ANY($1)`,
    [definitions.map((definition) => definition.name)],
  );
  const byName = new Map(
    datasets.rows.map((row) => [
      row.name,
      {
        id: row.id,
        versionId: row.version_id,
        schema: row.schema_definition,
      } satisfies Dataset,
    ]),
  );
  const project = await client.query<{ id: string }>(
    "SELECT id FROM projects WHERE name='Proyecto Nacional FTTH — estrés' LIMIT 1",
  );
  if (!project.rows[0])
    throw new Error("Falta Proyecto Nacional FTTH — estrés.");
  const projectApps = await client.query<{ dataset_id: string; id: string }>(
    "SELECT id,dataset_id FROM project_apps WHERE project_id=$1",
    [project.rows[0].id],
  );
  const appByDataset = new Map(
    projectApps.rows.map((row) => [row.dataset_id, row.id]),
  );
  let inserted = 0;
  for (const definition of definitions) {
    const dataset = byName.get(definition.name);
    if (!dataset) throw new Error(`Falta la App/dataset: ${definition.name}`);
    const projectAppId = appByDataset.get(dataset.id);
    if (!projectAppId)
      throw new Error(`Falta Project App nacional para: ${definition.name}`);
    const count = Math.floor(environment.STRESS_RECORDS * definition.weight);
    const fields = Object.fromEntries(
      dataset.schema.sections
        .flatMap((section) => section.fields)
        .map((field) => [field.key, field.id]),
    );
    const spec = attributes(definition.kind, fields);
    for (let start = 1; start <= count; start += environment.STRESS_BATCH) {
      const end = Math.min(count, start + environment.STRESS_BATCH - 1);
      await client.query(
        `WITH inserted AS (
           INSERT INTO records(organization_id,dataset_id,schema_version_id,attributes,geometry,origin)
           SELECT $1,$2,$3,${spec.expression},${geometry(definition.kind)},jsonb_build_object('method','stress-seed','ordinal',g)
           FROM generate_series($4::bigint,$5::bigint) g
           RETURNING id,dataset_id,origin
         )
         INSERT INTO project_records(organization_id,project_id,project_app_id,dataset_id,record_id,schema_definition)
         SELECT $1,$6,$7,dataset_id,id,(SELECT schema_definition FROM project_app_versions WHERE project_app_id=$7 ORDER BY version DESC LIMIT 1)
         FROM inserted WHERE ((origin->>'ordinal')::integer % 3)=0`,
        [
          organizationId,
          dataset.id,
          dataset.versionId,
          start,
          end,
          project.rows[0].id,
          projectAppId,
          ...spec.values,
        ],
      );
      inserted += end - start + 1;
      process.stdout.write(
        `\r${inserted.toLocaleString("es-BO")} registros creados`,
      );
    }
  }
  process.stdout.write(
    `\nCompletado: ${inserted.toLocaleString("es-BO")} registros.\n`,
  );
} finally {
  await client.end();
}
