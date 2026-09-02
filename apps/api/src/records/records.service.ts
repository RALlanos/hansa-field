import { Inject, Injectable, NotFoundException } from "@nestjs/common";

import {
  DatabaseService,
  type DatabaseQuery,
} from "../database/database.service.js";

export type GeoJsonGeometry =
  | Readonly<{ type: "Point"; coordinates: [number, number] }>
  | Readonly<{ type: "LineString"; coordinates: [number, number][] }>
  | Readonly<{ type: "Polygon"; coordinates: [number, number][][] }>;
export type CreateRecordInput = Readonly<{
  attributes: Record<string, unknown>;
  geometry: GeoJsonGeometry | null;
}>;
export type AppRecord = Readonly<{
  id: string;
  appId: string;
  appVersionId: string;
  attributes: Record<string, unknown>;
  geometry: GeoJsonGeometry | null;
  createdAt: string;
  updatedAt: string;
}>;

type RecordRow = Readonly<{
  id: string;
  app_id: string;
  app_version_id: string;
  attributes: Record<string, unknown>;
  geometry: GeoJsonGeometry | null;
  created_at: Date;
  updated_at: Date;
}>;

function mapRow(row: RecordRow): AppRecord {
  return {
    id: row.id,
    appId: row.app_id,
    appVersionId: row.app_version_id,
    attributes: row.attributes,
    geometry: row.geometry,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

@Injectable()
export class RecordsService {
  constructor(
    @Inject(DatabaseService) private readonly database: DatabaseQuery,
  ) {}

  async list(
    appId: string,
    bounds?: readonly [number, number, number, number],
    limit = 500,
  ): Promise<AppRecord[]> {
    const result = await this.database.query<RecordRow>(
      `SELECT id, app_id, app_version_id, attributes,
              ST_AsGeoJSON(geometry)::jsonb AS geometry, created_at, updated_at
       FROM records
       WHERE app_id = $1
         AND ($2::double precision IS NULL OR (geometry IS NOT NULL AND
           ST_Intersects(geometry, ST_MakeEnvelope($2, $3, $4, $5, 4326))))
       ORDER BY updated_at DESC LIMIT $6`,
      [appId, ...(bounds ?? [null, null, null, null]), limit],
    );
    return result.rows.map(mapRow);
  }

  async create(appId: string, input: CreateRecordInput): Promise<AppRecord> {
    const version = await this.database.query<{ id: string }>(
      `SELECT id FROM app_versions WHERE app_id = $1 ORDER BY version DESC LIMIT 1`,
      [appId],
    );
    const appVersionId = version.rows[0]?.id;
    if (!appVersionId) {
      throw new NotFoundException({
        code: "APP_VERSION_NOT_FOUND",
        message: "Guarda primero el formulario de la App.",
      });
    }
    const result = await this.database.query<RecordRow>(
      `INSERT INTO records (app_id, app_version_id, attributes, geometry)
       VALUES ($1, $2, $3, CASE WHEN $4::jsonb IS NULL THEN NULL
         ELSE ST_SetSRID(ST_GeomFromGeoJSON($4), 4326) END)
       RETURNING id, app_id, app_version_id, attributes,
         ST_AsGeoJSON(geometry)::jsonb AS geometry, created_at, updated_at`,
      [appId, appVersionId, input.attributes, input.geometry],
    );
    const row = result.rows[0];
    if (!row) throw new Error("Database did not return the created record.");
    return mapRow(row);
  }

  async update(
    appId: string,
    recordId: string,
    input: CreateRecordInput,
  ): Promise<AppRecord> {
    const result = await this.database.query<RecordRow>(
      `UPDATE records SET attributes = $3,
         geometry = CASE WHEN $4::jsonb IS NULL THEN NULL
           ELSE ST_SetSRID(ST_GeomFromGeoJSON($4), 4326) END,
         updated_at = now()
       WHERE app_id = $1 AND id = $2
       RETURNING id, app_id, app_version_id, attributes,
         ST_AsGeoJSON(geometry)::jsonb AS geometry, created_at, updated_at`,
      [appId, recordId, input.attributes, input.geometry],
    );
    const row = result.rows[0];
    if (!row) {
      throw new NotFoundException({
        code: "RECORD_NOT_FOUND",
        message: "El registro solicitado no existe.",
      });
    }
    return mapRow(row);
  }
}
