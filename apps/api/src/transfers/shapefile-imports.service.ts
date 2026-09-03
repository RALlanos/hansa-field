import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from "@nestjs/common";

import {
  DatabaseService,
  type DatabaseQuery,
} from "../database/database.service.js";
import {
  inspectShapefileArchive,
  readShapefileArchive,
  type ShapefileSourceRecord,
} from "./shapefile-inspector.js";
import { TIGO_HFC_FTTH_V1, classifySourceStatus } from "./routing-profile.js";

export type ImportScope =
  | Readonly<{ type: "standalone" }>
  | Readonly<{ type: "project"; projectId: string }>
  | Readonly<{ type: "app"; appId: string }>;
export type ImportSelection = Readonly<{
  georeferenceConfirmed: true;
  tableMappings: ReadonlyArray<
    Readonly<{ sourceStatus: string; targetAppId: string | null }>
  >;
  fieldMappings: ReadonlyArray<
    Readonly<{
      targetAppId: string;
      sourceField: string;
      targetFieldKey: string | null;
    }>
  >;
}>;

type ImportJobRow = Readonly<{
  id: string;
  profile_code: string;
  profile_version: number;
  import_scope: "standalone" | "project" | "app";
  project_id: string | null;
  target_app_id: string | null;
  status: string;
  source_file_name: string;
  source_layer: string;
  source_checksum_sha256: string;
  archive_path: string;
  source_crs_wkt: string;
}>;
type AppContractRow = Readonly<{
  id: string;
  code: string;
  name: string;
  allowed_geometries: string[];
  version_id: string;
  schema_definition: unknown;
}>;
type PreparedRow = Readonly<{
  recordId: string;
  appId: string;
  appVersionId: string;
  attributes: Readonly<Record<string, unknown>>;
  originalAttributes: Readonly<Record<string, unknown>>;
  geometry: ShapefileSourceRecord["geometry"];
  sourceRecordId: string;
  sourceStatus: string;
  exists: boolean;
}>;

@Injectable()
export class ShapefileImportsService {
  constructor(
    @Inject(DatabaseService) private readonly database: DatabaseService,
  ) {}

  async inspect(sourceFileName: string, archive: Buffer, scope: ImportScope) {
    const inspection = await inspectShapefileArchive(sourceFileName, archive);
    await this.assertScopeTargetExists(scope);
    const availableApps = await this.listAvailableApps();
    const appsByCode = new Map(availableApps.map((app) => [app.code, app]));
    const jobId = randomUUID();
    const storageRoot = resolve(
      process.env.IMPORT_STORAGE_PATH ??
        resolve(process.cwd(), "var", "imports"),
    );
    const jobDirectory = resolve(storageRoot, jobId);
    await mkdir(jobDirectory, { recursive: true });
    const archivePath = resolve(jobDirectory, "source.zip");
    await writeFile(archivePath, archive, { flag: "wx" });
    await this.database.query(
      `INSERT INTO import_jobs (
         id, profile_code, profile_version, import_scope, project_id,
         target_app_id, status, source_file_name, source_layer,
         source_checksum_sha256, archive_path, source_crs_wkt, source_epsg,
         feature_count, summary
       ) VALUES ($1, $2, $3, $4, $5, $6, 'inspected', $7, $8, $9, $10, $11, $12, $13, $14)`,
      [
        jobId,
        inspection.profile.code,
        inspection.profile.version,
        scope.type,
        scope.type === "project" ? scope.projectId : null,
        scope.type === "app" ? scope.appId : null,
        inspection.sourceFileName,
        inspection.layerName,
        inspection.checksumSha256,
        archivePath,
        inspection.crs.wkt,
        inspection.crs.epsg,
        inspection.featureCount,
        {
          geometryType: inspection.geometryType,
          bbox: inspection.bbox,
          sourceStatuses: inspection.sourceStatuses,
          fields: inspection.fields,
        },
      ],
    );
    return {
      jobId,
      scope,
      ...inspection,
      tables: inspection.sourceStatuses.map(({ value, count }) => {
        const code =
          classifySourceStatus(TIGO_HFC_FTTH_V1, value)?.appCode ?? null;
        return {
          sourceStatus: value,
          count,
          suggestedAppCode: code,
          suggestedAppId: code ? (appsByCode.get(code)?.id ?? null) : null,
        };
      }),
      availableApps,
    };
  }

  async plan(jobId: string, selection: ImportSelection) {
    const prepared = await this.prepare(jobId, selection);
    return {
      jobId,
      total: prepared.rows.length,
      creates: prepared.rows.filter((row) => !row.exists).length,
      updates: prepared.rows.filter((row) => row.exists).length,
      skipped: prepared.skipped,
      errors: prepared.errors,
      apps: prepared.apps.map((app) => ({
        id: app.id,
        code: app.code,
        name: app.name,
        count: prepared.rows.filter((row) => row.appId === app.id).length,
      })),
    };
  }

  async confirm(jobId: string, selection: ImportSelection) {
    const prepared = await this.prepare(jobId, selection);
    if (prepared.errors.length) {
      throw new UnprocessableEntityException({
        code: "IMPORT_PLAN_HAS_ERRORS",
        message: "Corrige los problemas mostrados antes de importar.",
        details: prepared.errors,
      });
    }
    return this.database.withTransaction(async (transaction) => {
      const state = await transaction.query<{ status: string }>(
        "SELECT status FROM import_jobs WHERE id = $1 FOR UPDATE",
        [jobId],
      );
      if (state.rows[0]?.status !== "inspected") {
        throw new ConflictException({
          code: "IMPORT_JOB_NOT_READY",
          message: "Este trabajo ya no está disponible para importar.",
        });
      }
      await transaction.query(
        "UPDATE import_jobs SET status = 'importing' WHERE id = $1",
        [jobId],
      );
      if (prepared.job.import_scope === "project" && prepared.job.project_id) {
        await transaction.query(
          `INSERT INTO project_apps (project_id, app_id)
           SELECT $1, unnest($2::uuid[]) ON CONFLICT DO NOTHING`,
          [prepared.job.project_id, prepared.apps.map((app) => app.id)],
        );
      }
      for (let offset = 0; offset < prepared.rows.length; offset += 250) {
        await this.persistBatch(
          transaction,
          prepared.job,
          prepared.rows.slice(offset, offset + 250),
        );
      }
      const result = {
        total: prepared.rows.length,
        created: prepared.rows.filter((row) => !row.exists).length,
        updated: prepared.rows.filter((row) => row.exists).length,
        skipped: prepared.skipped,
        failed: 0,
        apps: prepared.apps.map((app) => ({
          id: app.id,
          code: app.code,
          count: prepared.rows.filter((row) => row.appId === app.id).length,
        })),
      };
      await transaction.query(
        `UPDATE import_jobs SET status = 'completed', result = $2,
           completed_at = now() WHERE id = $1`,
        [jobId, result],
      );
      return { jobId, ...result };
    });
  }

  private async prepare(jobId: string, selection: ImportSelection) {
    const job = await this.loadJob(jobId);
    if (job.status !== "inspected") {
      throw new ConflictException({
        code: "IMPORT_JOB_NOT_READY",
        message: "Este trabajo ya no está disponible para preparar.",
      });
    }
    const archive = await readFile(job.archive_path);
    const { inspection, records } = await readShapefileArchive(
      job.source_file_name,
      archive,
    );
    if (inspection.checksumSha256 !== job.source_checksum_sha256) {
      throw new UnprocessableEntityException({
        code: "IMPORT_SOURCE_CHANGED",
        message: "El archivo almacenado cambió después de la inspección.",
      });
    }
    const errors: Array<{ index?: number; message: string }> = [];
    const tableMappings = new Map(
      selection.tableMappings.map((mapping) => [
        mapping.sourceStatus.trim().toUpperCase(),
        mapping.targetAppId,
      ]),
    );
    if (tableMappings.size !== selection.tableMappings.length) {
      errors.push({
        message: "Una tabla detectada tiene más de una decisión.",
      });
    }
    for (const status of inspection.sourceStatuses) {
      if (!tableMappings.has(status.value)) {
        errors.push({
          message: `Decide qué hacer con la tabla ${status.value}.`,
        });
      }
    }
    const targetAppIds = [
      ...new Set(
        [...tableMappings.values()].filter(
          (value): value is string => value !== null,
        ),
      ),
    ];
    if (
      job.import_scope === "app" &&
      targetAppIds.some((appId) => appId !== job.target_app_id)
    ) {
      errors.push({
        message: "Una importación desde una App sólo puede usar esa App.",
      });
    }
    const apps = await this.loadAppContracts(targetAppIds);
    if (apps.length !== targetAppIds.length) {
      errors.push({ message: "Una de las Apps seleccionadas ya no existe." });
    }
    if (apps.some((app) => !app.allowed_geometries.includes("Point"))) {
      errors.push({
        message: "Una App seleccionada no admite geometrías Point.",
      });
    }
    const appsById = new Map(apps.map((app) => [app.id, app]));
    const fieldMappings = this.validateFieldMappings(
      selection,
      inspection,
      apps,
      errors,
    );
    const selected: Array<{
      app: AppContractRow;
      record: ShapefileSourceRecord;
      sourceRecordId: string;
      sourceStatus: string;
      hansaRecordId: string | null;
    }> = [];
    const seen = new Set<string>();
    let skipped = 0;
    records.forEach((record, index) => {
      const sourceStatus = this.sourceStatus(record);
      const targetAppId = tableMappings.get(sourceStatus);
      if (targetAppId === null) {
        skipped += 1;
        return;
      }
      const app = targetAppId ? appsById.get(targetAppId) : undefined;
      if (!app) return;
      const rawSourceId = record.properties._record_id;
      const sourceRecordId =
        typeof rawSourceId === "string" ? rawSourceId.trim() : "";
      if (!sourceRecordId) {
        errors.push({ index, message: "El registro no tiene UUID externo." });
        return;
      }
      if (!this.isUuid(sourceRecordId)) {
        errors.push({ index, message: "El UUID externo no es válido." });
        return;
      }
      if (seen.has(sourceRecordId)) {
        errors.push({ index, message: "El UUID externo está repetido." });
        return;
      }
      seen.add(sourceRecordId);
      const rawHansaId = record.properties.hansa_uuid;
      const hansaRecordId =
        typeof rawHansaId === "string" && rawHansaId.trim()
          ? rawHansaId.trim()
          : null;
      if (hansaRecordId && !this.isUuid(hansaRecordId)) {
        errors.push({
          index,
          message: "El UUID Hansa suministrado no es válido.",
        });
        return;
      }
      selected.push({
        app,
        record,
        sourceRecordId,
        sourceStatus,
        hansaRecordId,
      });
    });
    const existing = selected.length
      ? await this.database.query<{
          source_record_id: string;
          record_id: string;
        }>(
          `SELECT source_record_id, record_id FROM record_import_sources
           WHERE profile_code = $1 AND profile_version = $2
             AND source_record_id = ANY($3::text[])`,
          [
            job.profile_code,
            job.profile_version,
            selected.map((record) => record.sourceRecordId),
          ],
        )
      : { rows: [] };
    const existingBySource = new Map(
      existing.rows.map((row) => [row.source_record_id, row.record_id]),
    );
    const suppliedHansaIds = selected.flatMap((record) =>
      record.hansaRecordId ? [record.hansaRecordId] : [],
    );
    const existingHansa = suppliedHansaIds.length
      ? await this.database.query<{ id: string }>(
          "SELECT id FROM records WHERE id = ANY($1::uuid[])",
          [suppliedHansaIds],
        )
      : { rows: [] };
    const existingHansaIds = new Set(existingHansa.rows.map((row) => row.id));
    const rows: PreparedRow[] = selected.map((item) => {
      const sourceMatchedId = existingBySource.get(item.sourceRecordId);
      if (item.hansaRecordId && !existingHansaIds.has(item.hansaRecordId)) {
        errors.push({
          message: `El UUID Hansa ${item.hansaRecordId} fue suministrado pero no existe.`,
        });
      }
      if (
        item.hansaRecordId &&
        sourceMatchedId &&
        item.hansaRecordId !== sourceMatchedId
      ) {
        errors.push({
          message: `El UUID Hansa y el UUID externo de ${item.sourceRecordId} apuntan a registros distintos.`,
        });
      }
      const recordId = item.hansaRecordId ?? sourceMatchedId ?? randomUUID();
      const attributes: Record<string, unknown> = { hansa_uuid: recordId };
      for (const [sourceField, targetField] of fieldMappings.get(item.app.id) ??
        []) {
        if (targetField)
          attributes[targetField] = item.record.properties[sourceField] ?? null;
      }
      return {
        recordId,
        appId: item.app.id,
        appVersionId: item.app.version_id,
        attributes,
        originalAttributes: item.record.properties,
        geometry: item.record.geometry,
        sourceRecordId: item.sourceRecordId,
        sourceStatus: item.sourceStatus,
        exists: Boolean(item.hansaRecordId || sourceMatchedId),
      };
    });
    return { job, apps, rows, skipped, errors };
  }

  private validateFieldMappings(
    selection: ImportSelection,
    inspection: Awaited<ReturnType<typeof inspectShapefileArchive>>,
    apps: readonly AppContractRow[],
    errors: Array<{ index?: number; message: string }>,
  ) {
    const mappings = new Map<string, Map<string, string | null>>();
    for (const mapping of selection.fieldMappings) {
      const bySource = mappings.get(mapping.targetAppId) ?? new Map();
      if (bySource.has(mapping.sourceField)) {
        errors.push({
          message: `El campo ${mapping.sourceField} está repetido.`,
        });
      }
      bySource.set(mapping.sourceField, mapping.targetFieldKey);
      mappings.set(mapping.targetAppId, bySource);
    }
    for (const app of apps) {
      const targetFields = this.schemaFields(app.schema_definition);
      const appMappings = mappings.get(app.id);
      for (const field of inspection.fields) {
        if (!appMappings?.has(field.sourceName)) {
          errors.push({
            message: `Decide si ${field.sourceName} se importa en ${app.name}.`,
          });
        }
      }
      for (const [source, target] of appMappings ?? []) {
        if (!target) continue;
        const targetField = targetFields.get(target);
        if (!targetField) {
          errors.push({
            message: `${source} apunta a un campo inexistente en ${app.name}.`,
          });
          continue;
        }
        const sourceField = inspection.fields.find(
          (field) => field.sourceName === source,
        );
        if (
          sourceField &&
          !this.typesAreCompatible(sourceField.suggestedType, targetField.type)
        ) {
          errors.push({
            message: `${source} (${sourceField.suggestedType}) no es compatible con ${targetField.label} (${targetField.type}).`,
          });
        }
      }
    }
    return mappings;
  }

  private sourceStatus(record: ShapefileSourceRecord): string {
    const value = record.properties._status;
    return typeof value === "string" && value.trim()
      ? value.trim().toUpperCase()
      : "(VACÍO)";
  }

  private isUuid(value: string): boolean {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value,
    );
  }

  private async listAvailableApps() {
    const apps = await this.loadAppContracts();
    return apps.map((app) => ({
      id: app.id,
      code: app.code,
      name: app.name,
      allowedGeometries: app.allowed_geometries,
      fields: [...this.schemaFields(app.schema_definition)].map(
        ([key, field]) => ({ key, ...field }),
      ),
    }));
  }

  private async loadAppContracts(appIds?: readonly string[]) {
    if (appIds && !appIds.length) return [];
    const result = await this.database.query<AppContractRow>(
      `SELECT app.id, app.code, app.name, app.allowed_geometries,
         version.id AS version_id, version.schema_definition
       FROM app_definitions app JOIN LATERAL (
         SELECT id, schema_definition FROM app_versions
         WHERE app_id = app.id ORDER BY version DESC LIMIT 1
       ) version ON true
       WHERE ($1::uuid[] IS NULL OR app.id = ANY($1::uuid[])) ORDER BY app.name`,
      [appIds ?? null],
    );
    return result.rows;
  }

  private schemaFields(
    value: unknown,
  ): Map<string, { label: string; type: string }> {
    const fieldsByKey = new Map<string, { label: string; type: string }>();
    if (!value || typeof value !== "object" || !("sections" in value))
      return fieldsByKey;
    for (const section of Array.isArray(value.sections) ? value.sections : []) {
      if (!section || typeof section !== "object" || !("fields" in section))
        continue;
      for (const field of Array.isArray(section.fields) ? section.fields : []) {
        if (
          field &&
          typeof field === "object" &&
          "key" in field &&
          typeof field.key === "string" &&
          "type" in field &&
          typeof field.type === "string"
        ) {
          fieldsByKey.set(field.key, {
            label:
              "label" in field && typeof field.label === "string"
                ? field.label
                : field.key,
            type: field.type,
          });
        }
      }
    }
    return fieldsByKey;
  }

  private typesAreCompatible(sourceType: string, targetType: string): boolean {
    if (sourceType === "integer" || sourceType === "decimal")
      return targetType === "number";
    if (sourceType === "date") return targetType === "date";
    if (sourceType === "boolean") return targetType === "boolean";
    return ["shortText", "longText", "singleChoice"].includes(targetType);
  }

  private async loadJob(jobId: string): Promise<ImportJobRow> {
    const result = await this.database.query<ImportJobRow>(
      `SELECT id, profile_code, profile_version, import_scope, project_id,
         target_app_id, status, source_file_name, source_layer,
         source_checksum_sha256, archive_path, source_crs_wkt
       FROM import_jobs WHERE id = $1`,
      [jobId],
    );
    const job = result.rows[0];
    if (!job) {
      throw new NotFoundException({
        code: "IMPORT_JOB_NOT_FOUND",
        message: "El trabajo de importación no existe.",
      });
    }
    return job;
  }

  private async assertScopeTargetExists(scope: ImportScope): Promise<void> {
    if (scope.type === "standalone") return;
    const target = await this.database.query<{ exists: boolean }>(
      scope.type === "project"
        ? "SELECT EXISTS(SELECT 1 FROM projects WHERE id = $1) AS exists"
        : "SELECT EXISTS(SELECT 1 FROM app_definitions WHERE id = $1) AS exists",
      [scope.type === "project" ? scope.projectId : scope.appId],
    );
    if (!target.rows[0]?.exists) {
      throw new NotFoundException({
        code: scope.type === "project" ? "PROJECT_NOT_FOUND" : "APP_NOT_FOUND",
        message:
          scope.type === "project"
            ? "Crea o selecciona primero el proyecto destino."
            : "La App destino no existe.",
      });
    }
  }

  private async persistBatch(
    database: DatabaseQuery,
    job: ImportJobRow,
    rows: readonly PreparedRow[],
  ): Promise<void> {
    const serialized = JSON.stringify(rows);
    await database.query(
      `WITH input AS (
         SELECT * FROM jsonb_to_recordset($1::jsonb) AS row(
           "recordId" uuid, "appId" uuid, "appVersionId" uuid,
           attributes jsonb, geometry jsonb)
       ) INSERT INTO records (id, app_id, app_version_id, attributes, geometry)
       SELECT "recordId", "appId", "appVersionId", attributes,
         ST_SetSRID(ST_GeomFromGeoJSON(geometry), 4326) FROM input
       ON CONFLICT (id) DO UPDATE SET app_id = EXCLUDED.app_id,
         app_version_id = EXCLUDED.app_version_id, attributes = EXCLUDED.attributes,
         geometry = EXCLUDED.geometry, updated_at = now()`,
      [serialized],
    );
    await database.query(
      `WITH input AS (
         SELECT * FROM jsonb_to_recordset($1::jsonb) AS row(
           "recordId" uuid, "originalAttributes" jsonb, geometry jsonb,
           "sourceRecordId" text, "sourceStatus" text)
       ) INSERT INTO record_import_sources (
         record_id, profile_code, profile_version, source_record_id,
         source_status, import_job_id, source_file_name, source_layer,
         source_crs_wkt, original_attributes, original_geometry)
       SELECT "recordId", $2, $3, "sourceRecordId", "sourceStatus", $4,
         $5, $6, $7, "originalAttributes", geometry FROM input
       ON CONFLICT (profile_code, profile_version, source_record_id)
       DO UPDATE SET source_status = EXCLUDED.source_status,
         import_job_id = EXCLUDED.import_job_id, source_file_name = EXCLUDED.source_file_name,
         source_layer = EXCLUDED.source_layer, source_crs_wkt = EXCLUDED.source_crs_wkt,
         original_attributes = EXCLUDED.original_attributes,
         original_geometry = EXCLUDED.original_geometry, imported_at = now()`,
      [
        serialized,
        job.profile_code,
        job.profile_version,
        job.id,
        job.source_file_name,
        job.source_layer,
        job.source_crs_wkt,
      ],
    );
  }
}
