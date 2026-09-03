import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import { Inject, Injectable, NotFoundException } from "@nestjs/common";

import { DatabaseService } from "../database/database.service.js";
import { inspectShapefileArchive } from "./shapefile-inspector.js";

type ExistingAppRow = Readonly<{ id: string; code: string; name: string }>;
export type ImportScope =
  | Readonly<{ type: "standalone" }>
  | Readonly<{ type: "project"; projectId: string }>
  | Readonly<{ type: "app"; appId: string }>;

@Injectable()
export class ShapefileImportsService {
  constructor(
    @Inject(DatabaseService) private readonly database: DatabaseService,
  ) {}

  async inspect(sourceFileName: string, archive: Buffer, scope: ImportScope) {
    const inspection = await inspectShapefileArchive(sourceFileName, archive);
    await this.assertScopeTargetExists(scope);
    const appCodes = inspection.routing.apps.map((app) => app.appCode);
    const existing = await this.database.query<ExistingAppRow>(
      `SELECT id, code, name FROM app_definitions WHERE code = ANY($1::text[])`,
      [appCodes],
    );
    const existingByCode = new Map(existing.rows.map((app) => [app.code, app]));
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
         target_app_id, status, source_file_name,
         source_layer, source_checksum_sha256, archive_path, source_crs_wkt,
         source_epsg, feature_count, summary
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
          routing: inspection.routing,
          sourceStatuses: inspection.sourceStatuses,
          fields: inspection.fields,
        },
      ],
    );

    return {
      jobId,
      scope,
      ...inspection,
      apps: inspection.routing.apps.map(({ appCode, count }) => {
        const app = existingByCode.get(appCode);
        return {
          code: appCode,
          count,
          state: app ? ("existing" as const) : ("willCreate" as const),
          ...(app ? { id: app.id, name: app.name } : {}),
        };
      }),
    };
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
}
