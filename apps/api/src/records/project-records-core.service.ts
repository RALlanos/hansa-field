import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";

import {
  DatabaseService,
  type DatabaseQuery,
} from "../database/database.service.js";

import {
  resolveEffectiveRecord,
  type EffectiveRecord,
} from "./effective-record.js";
import type { GeoJsonGeometry } from "./records.service.js";

export type CreateProjectRecordInput = Readonly<{
  canonicalAttributes: Readonly<Record<string, unknown>>;
  geometry: GeoJsonGeometry | null;
  projectAttributes?: Readonly<Record<string, unknown>>;
}>;
export type IncorporateRecordInput = Readonly<{
  attributesOverride: Readonly<Record<string, unknown>>;
  projectAttributes: Readonly<Record<string, unknown>>;
  geometryOverride?: GeoJsonGeometry | null;
  displayGeometryOverride?: GeoJsonGeometry | null;
}>;
export type ProjectRecordContext = Readonly<{
  recordId: string;
  projectRecordId: string;
  projectAppId: string;
  effective: EffectiveRecord;
}>;
export type UpdateProjectRecordInput = Readonly<{
  attributesOverride: Readonly<Record<string, unknown>>;
  projectAttributes: Readonly<Record<string, unknown>>;
  geometryOverride?: GeoJsonGeometry | null;
  displayGeometryOverride?: GeoJsonGeometry | null;
}>;

type ProjectAppRow = Readonly<{ app_id: string; base_version_id: string }>;
type RecordRow = Readonly<{
  id: string;
  canonical_attributes: Record<string, unknown>;
  geometry: GeoJsonGeometry | null;
}>;
type ProjectRecordRow = Readonly<{
  id: string;
  attributes_override: Record<string, unknown>;
  project_attributes: Record<string, unknown>;
  geometry_override: GeoJsonGeometry | null;
  display_geometry_override: GeoJsonGeometry | null;
}>;

@Injectable()
export class ProjectRecordsCoreService {
  constructor(
    @Inject(DatabaseService) private readonly database: DatabaseService,
  ) {}

  async create(
    projectAppId: string,
    input: CreateProjectRecordInput,
  ): Promise<ProjectRecordContext> {
    return this.database.withTransaction(async (transaction) => {
      const projectApp = await this.loadProjectApp(transaction, projectAppId);
      const record = await transaction.query<RecordRow>(
        `INSERT INTO records (
           app_id, app_version_id, canonical_attributes, geometry, origin_project_app_id
         ) VALUES ($1, $2, $3, CASE WHEN $4::jsonb IS NULL THEN NULL
           ELSE ST_SetSRID(ST_GeomFromGeoJSON($4), 4326) END, $5::uuid)
         RETURNING id, canonical_attributes,
           ST_AsGeoJSON(geometry)::jsonb AS geometry`,
        [
          projectApp.app_id,
          projectApp.base_version_id,
          input.canonicalAttributes,
          input.geometry,
          projectAppId,
        ],
      );
      const createdRecord = record.rows[0];
      if (!createdRecord) throw new Error("No se creó el record.");
      const participation = await transaction.query<ProjectRecordRow>(
        `INSERT INTO project_records (project_app_id, record_id, project_attributes)
         VALUES ($1, $2, $3)
         RETURNING id, attributes_override, project_attributes,
           ST_AsGeoJSON(geometry_override)::jsonb AS geometry_override,
           ST_AsGeoJSON(display_geometry_override)::jsonb AS display_geometry_override`,
        [projectAppId, createdRecord.id, input.projectAttributes ?? {}],
      );
      return this.context(projectAppId, createdRecord, participation.rows[0]);
    });
  }

  async incorporate(
    projectAppId: string,
    recordId: string,
    input: IncorporateRecordInput,
  ): Promise<ProjectRecordContext> {
    return this.database.withTransaction(async (transaction) => {
      const projectApp = await this.loadProjectApp(transaction, projectAppId);
      const record = await transaction.query<RecordRow & { app_id: string }>(
        `SELECT id, app_id, canonical_attributes,
           ST_AsGeoJSON(geometry)::jsonb AS geometry
         FROM records WHERE id = $1`,
        [recordId],
      );
      const existing = record.rows[0];
      if (!existing) {
        throw new NotFoundException({
          code: "RECORD_NOT_FOUND",
          message: "El record que se quiere incorporar no existe.",
        });
      }
      if (existing.app_id !== projectApp.app_id) {
        throw new ConflictException({
          code: "PROJECT_APP_TEMPLATE_MISMATCH",
          message: "El record no corresponde a la Plantilla Madre destino.",
        });
      }
      try {
        const participation = await transaction.query<ProjectRecordRow>(
          `INSERT INTO project_records (
             project_app_id, record_id, attributes_override, project_attributes,
             geometry_override, display_geometry_override
           ) VALUES ($1, $2, $3, $4,
             CASE WHEN $5::jsonb IS NULL THEN NULL ELSE ST_SetSRID(ST_GeomFromGeoJSON($5), 4326) END,
             CASE WHEN $6::jsonb IS NULL THEN NULL ELSE ST_SetSRID(ST_GeomFromGeoJSON($6), 4326) END
           ) RETURNING id, attributes_override, project_attributes,
             ST_AsGeoJSON(geometry_override)::jsonb AS geometry_override,
             ST_AsGeoJSON(display_geometry_override)::jsonb AS display_geometry_override`,
          [
            projectAppId,
            recordId,
            input.attributesOverride,
            input.projectAttributes,
            input.geometryOverride ?? null,
            input.displayGeometryOverride ?? null,
          ],
        );
        return this.context(projectAppId, existing, participation.rows[0]);
      } catch (error: unknown) {
        if (isUniqueViolation(error)) {
          throw new ConflictException({
            code: "PROJECT_RECORD_ALREADY_ACTIVE",
            message:
              "El record ya participa activamente en esta App de Proyecto.",
          });
        }
        throw error;
      }
    });
  }

  async remove(projectAppId: string, projectRecordId: string): Promise<void> {
    const result = await this.database.query<{ id: string }>(
      `UPDATE project_records SET status = 'removed', updated_at = now()
       WHERE id = $1 AND project_app_id = $2 AND status = 'active'
       RETURNING id`,
      [projectRecordId, projectAppId],
    );
    if (!result.rows[0]) {
      throw new NotFoundException({
        code: "PROJECT_RECORD_NOT_ACTIVE",
        message: "La participación activa no existe en esta App de Proyecto.",
      });
    }
  }

  async update(
    projectAppId: string,
    projectRecordId: string,
    input: UpdateProjectRecordInput,
  ): Promise<ProjectRecordContext> {
    const result = await this.database.query<
      ProjectRecordRow & RecordRow & { record_id: string }
    >(
      `UPDATE project_records participation SET
         attributes_override = $3, project_attributes = $4,
         geometry_override = CASE WHEN $5::jsonb IS NULL THEN NULL ELSE ST_SetSRID(ST_GeomFromGeoJSON($5), 4326) END,
         display_geometry_override = CASE WHEN $6::jsonb IS NULL THEN NULL ELSE ST_SetSRID(ST_GeomFromGeoJSON($6), 4326) END,
         updated_at = now()
       FROM records record
       WHERE participation.id = $1 AND participation.project_app_id = $2
         AND participation.status = 'active' AND record.id = participation.record_id
       RETURNING participation.id, record.id AS record_id, record.canonical_attributes,
         ST_AsGeoJSON(record.geometry)::jsonb AS geometry,
         participation.attributes_override, participation.project_attributes,
         ST_AsGeoJSON(participation.geometry_override)::jsonb AS geometry_override,
         ST_AsGeoJSON(participation.display_geometry_override)::jsonb AS display_geometry_override`,
      [
        projectRecordId,
        projectAppId,
        input.attributesOverride,
        input.projectAttributes,
        input.geometryOverride ?? null,
        input.displayGeometryOverride ?? null,
      ],
    );
    const row = result.rows[0];
    if (!row)
      throw new NotFoundException({
        code: "PROJECT_RECORD_NOT_ACTIVE",
        message: "La participación activa no existe.",
      });
    return this.context(
      projectAppId,
      {
        id: row.record_id,
        canonical_attributes: row.canonical_attributes,
        geometry: row.geometry,
      },
      row,
    );
  }

  private async loadProjectApp(
    database: DatabaseQuery,
    projectAppId: string,
  ): Promise<ProjectAppRow> {
    const result = await database.query<ProjectAppRow>(
      `SELECT app_id, base_version_id FROM project_apps WHERE id = $1`,
      [projectAppId],
    );
    const row = result.rows[0];
    if (!row) {
      throw new NotFoundException({
        code: "PROJECT_APP_NOT_FOUND",
        message: "La App de Proyecto no existe.",
      });
    }
    return row;
  }

  private context(
    projectAppId: string,
    record: RecordRow,
    projectRecord: ProjectRecordRow | undefined,
  ): ProjectRecordContext {
    if (!projectRecord) throw new Error("No se creó la participación.");
    return {
      recordId: record.id,
      projectRecordId: projectRecord.id,
      projectAppId,
      effective: resolveEffectiveRecord({
        canonicalAttributes: record.canonical_attributes,
        attributesOverride: projectRecord.attributes_override,
        projectAttributes: projectRecord.project_attributes,
        canonicalGeometry: record.geometry,
        geometryOverride: projectRecord.geometry_override,
        displayGeometryOverride: projectRecord.display_geometry_override,
      }),
    };
  }
}

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "23505"
  );
}
