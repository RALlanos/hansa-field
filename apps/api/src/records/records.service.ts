import { Inject, Injectable, NotFoundException } from "@nestjs/common";

import {
  DatabaseService,
  type DatabaseQuery,
} from "../database/database.service.js";
import type { MapIconId } from "../apps/map-icons.js";

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

type MapFeatureRow = Readonly<{
  id: string;
  app_id: string;
  app_name: string;
  map_icon: MapIconId;
  map_color: string;
  feature_count: number;
  total_records: number;
  total_features: number;
  geometry: GeoJsonGeometry;
}>;

export type MapFeaturesQuery = Readonly<{
  appIds?: string[];
  bounds: readonly [number, number, number, number];
  zoom: number;
}>;

export type MapFeature = Readonly<{
  id: string;
  appId: string;
  appName: string;
  mapIcon: MapIconId;
  mapColor: string;
  count: number;
  geometry: GeoJsonGeometry;
}>;

export type MapFeaturesResult = Readonly<{
  data: MapFeature[];
  clustered: boolean;
  totalRecords: number;
  truncated: boolean;
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

  async listMapFeatures(query: MapFeaturesQuery): Promise<MapFeaturesResult> {
    const clustered = query.zoom < 14;
    const cellSize = 360 / 2 ** (query.zoom + 5);
    const limit = 2_000;
    const parameters = [...query.bounds, query.appIds ?? null, cellSize, limit];
    const sql = clustered
      ? `WITH visible AS (
           SELECT record.id, record.app_id, app.name AS app_name,
                  app.map_icon, app.map_color,
                  ST_PointOnSurface(record.geometry) AS point
           FROM records record
           JOIN app_definitions app ON app.id = record.app_id
           WHERE record.geometry IS NOT NULL
             AND ST_Intersects(
               record.geometry,
               ST_MakeEnvelope($1, $2, $3, $4, 4326)
             )
             AND ($5::uuid[] IS NULL OR record.app_id = ANY($5::uuid[]))
         ), grouped AS (
           SELECT app_id, app_name, map_icon, map_color,
                  ST_SnapToGrid(point, $6) AS cell,
                  COUNT(*)::integer AS feature_count,
                  ST_Centroid(ST_Collect(point)) AS geometry
           FROM visible
           GROUP BY app_id, app_name, map_icon, map_color,
                    ST_SnapToGrid(point, $6)
         )
         SELECT 'cluster:' || app_id::text || ':' || ST_X(cell)::text || ':' ||
                  ST_Y(cell)::text AS id,
                app_id, app_name, map_icon, map_color, feature_count,
                SUM(feature_count) OVER ()::integer AS total_records,
                COUNT(*) OVER ()::integer AS total_features,
                ST_AsGeoJSON(geometry)::jsonb AS geometry
         FROM grouped
         ORDER BY feature_count DESC, app_name ASC
         LIMIT $7`
      : `SELECT record.id::text AS id, record.app_id, app.name AS app_name,
                app.map_icon, app.map_color, 1::integer AS feature_count,
                COUNT(*) OVER ()::integer AS total_records,
                COUNT(*) OVER ()::integer AS total_features,
                ST_AsGeoJSON(record.geometry)::jsonb AS geometry
         FROM records record
         JOIN app_definitions app ON app.id = record.app_id
         WHERE record.geometry IS NOT NULL
           AND ST_Intersects(
             record.geometry,
             ST_MakeEnvelope($1, $2, $3, $4, 4326)
           )
           AND ($5::uuid[] IS NULL OR record.app_id = ANY($5::uuid[]))
         ORDER BY record.updated_at DESC
         LIMIT $7`;
    const result = await this.database.query<MapFeatureRow>(sql, parameters);
    const first = result.rows[0];
    return {
      data: result.rows.map((row) => ({
        id: row.id,
        appId: row.app_id,
        appName: row.app_name,
        mapIcon: row.map_icon,
        mapColor: row.map_color,
        count: row.feature_count,
        geometry: row.geometry,
      })),
      clustered,
      totalRecords: first?.total_records ?? 0,
      truncated: (first?.total_features ?? 0) > result.rows.length,
    };
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
