import { Inject, Injectable, NotFoundException } from "@nestjs/common";

import {
  DatabaseService,
  type DatabaseQuery,
} from "../database/database.service.js";
import type { MapIconId } from "../apps/map-icons.js";
import { resolveEffectiveRecord } from "./effective-record.js";

export type GeoJsonGeometry =
  | Readonly<{ type: "Point"; coordinates: [number, number] }>
  | Readonly<{ type: "LineString"; coordinates: [number, number][] }>
  | Readonly<{ type: "Polygon"; coordinates: [number, number][][] }>;
export type CreateRecordInput = Readonly<{
  attributes: Record<string, unknown>;
  geometry: GeoJsonGeometry | null;
}>;
export type AppRecord = Readonly<{
  recordUuid: string;
  projectRecordUuid: string;
  projectAppId: string;
  attributes: Record<string, unknown>;
  geometry: GeoJsonGeometry | null;
  displayGeometry: GeoJsonGeometry | null;
}>;

type ProjectRecordRow = Readonly<{
  record_uuid: string;
  project_record_uuid: string;
  project_app_id: string;
  app_name: string;
  canonical_attributes: Record<string, unknown>;
  attributes_override: Record<string, unknown>;
  project_attributes: Record<string, unknown>;
  geometry: GeoJsonGeometry | null;
  geometry_override: GeoJsonGeometry | null;
  display_geometry_override: GeoJsonGeometry | null;
  total_records: number;
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
const DETAIL_MAP_SPAN_METERS = 200;

export type MapFeaturesQuery = Readonly<{
  appIds?: string[];
  bounds: readonly [number, number, number, number];
  projectId?: string;
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
export type ProjectRecordsQuery = Readonly<{
  projectId: string;
  appIds: string[];
  bounds: readonly [number, number, number, number];
  page: number;
  pageSize: number;
}>;
export type ProjectRecord = AppRecord & Readonly<{ appName: string }>;
export type ProjectRecordsResult = Readonly<{
  data: ProjectRecord[];
  page: number;
  pageSize: number;
  totalRecords: number;
  totalPages: number;
}>;

function mapSpanMeters(
  bounds: readonly [number, number, number, number],
): number {
  const [west, south, east, north] = bounds;
  const latitudeMeters = (north - south) * 110_540;
  const middleLatitude = ((south + north) / 2) * (Math.PI / 180);
  const longitudeMeters = (east - west) * 111_320 * Math.cos(middleLatitude);
  return Math.max(latitudeMeters, longitudeMeters);
}

@Injectable()
export class RecordsService {
  constructor(
    @Inject(DatabaseService) private readonly database: DatabaseQuery,
  ) {}

  async listMapFeatures(query: MapFeaturesQuery): Promise<MapFeaturesResult> {
    const clustered = mapSpanMeters(query.bounds) > DETAIL_MAP_SPAN_METERS;
    const cellSize = 360 / 2 ** (query.zoom + 5);
    const limit = clustered ? 2_000 : 10_000;
    const parameters = clustered
      ? [
          ...query.bounds,
          query.appIds ?? null,
          query.projectId ?? null,
          cellSize,
          limit,
        ]
      : [...query.bounds, query.appIds ?? null, query.projectId ?? null, limit];
    const sql = clustered
      ? `WITH visible AS (
           SELECT participation.id, project_app.id AS app_id, app.name AS app_name,
                  app.map_icon, app.map_color,
                  ST_PointOnSurface(COALESCE(participation.display_geometry_override, participation.geometry_override, record.geometry)) AS point
           FROM project_records participation JOIN records record ON record.id = participation.record_id
           JOIN project_apps project_app ON project_app.id = participation.project_app_id
           JOIN app_definitions app ON app.id = project_app.app_id
           WHERE participation.status = 'active' AND COALESCE(participation.display_geometry_override, participation.geometry_override, record.geometry) IS NOT NULL
             AND ST_Intersects(
               COALESCE(participation.display_geometry_override, participation.geometry_override, record.geometry),
               ST_MakeEnvelope($1, $2, $3, $4, 4326)
             )
             AND ($5::uuid[] IS NULL OR participation.project_app_id = ANY($5::uuid[]))
             AND project_app.project_id IS NOT DISTINCT FROM $6::uuid
         ), grouped AS (
           SELECT app_id, app_name, map_icon, map_color,
                  ST_SnapToGrid(point, $7) AS cell,
                  COUNT(*)::integer AS feature_count,
                  ST_Centroid(ST_Collect(point)) AS geometry
           FROM visible
           GROUP BY app_id, app_name, map_icon, map_color,
                    ST_SnapToGrid(point, $7)
         )
         SELECT 'cluster:' || app_id::text || ':' || ST_X(cell)::text || ':' ||
                  ST_Y(cell)::text AS id,
                app_id, app_name, map_icon, map_color, feature_count,
                SUM(feature_count) OVER ()::integer AS total_records,
                COUNT(*) OVER ()::integer AS total_features,
                ST_AsGeoJSON(geometry)::jsonb AS geometry
         FROM grouped
         ORDER BY feature_count DESC, app_name ASC
         LIMIT $8`
      : `SELECT participation.id::text AS id, participation.project_app_id AS app_id, app.name AS app_name,
                app.map_icon, app.map_color, 1::integer AS feature_count,
                COUNT(*) OVER ()::integer AS total_records,
                COUNT(*) OVER ()::integer AS total_features,
                ST_AsGeoJSON(COALESCE(participation.display_geometry_override, participation.geometry_override, record.geometry))::jsonb AS geometry
         FROM project_records participation JOIN records record ON record.id = participation.record_id
         JOIN project_apps project_app ON project_app.id = participation.project_app_id
         JOIN app_definitions app ON app.id = project_app.app_id
         WHERE participation.status = 'active' AND COALESCE(participation.display_geometry_override, participation.geometry_override, record.geometry) IS NOT NULL
           AND ST_Intersects(
             COALESCE(participation.display_geometry_override, participation.geometry_override, record.geometry),
             ST_MakeEnvelope($1, $2, $3, $4, 4326)
           )
           AND ($5::uuid[] IS NULL OR participation.project_app_id = ANY($5::uuid[]))
           AND project_app.project_id IS NOT DISTINCT FROM $6::uuid
         ORDER BY participation.updated_at DESC
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

  async listProjectRecords(
    query: ProjectRecordsQuery,
  ): Promise<ProjectRecordsResult> {
    const offset = (query.page - 1) * query.pageSize;
    const result = await this.database.query<ProjectRecordRow>(
      `SELECT record.id AS record_uuid, participation.id AS project_record_uuid,
              participation.project_app_id, app.name AS app_name,
              record.canonical_attributes, participation.attributes_override,
              participation.project_attributes,
              ST_AsGeoJSON(record.geometry)::jsonb AS geometry,
              ST_AsGeoJSON(participation.geometry_override)::jsonb AS geometry_override,
              ST_AsGeoJSON(participation.display_geometry_override)::jsonb AS display_geometry_override,
              COUNT(*) OVER ()::integer AS total_records
       FROM project_records participation
       JOIN records record ON record.id = participation.record_id
       JOIN project_apps project_app ON project_app.id = participation.project_app_id
       JOIN app_definitions app ON app.id = project_app.app_id
       WHERE project_app.project_id = $1 AND participation.status = 'active'
         AND participation.project_app_id = ANY($2::uuid[])
         AND COALESCE(participation.display_geometry_override, participation.geometry_override, record.geometry) IS NOT NULL
         AND ST_Intersects(
           COALESCE(participation.display_geometry_override, participation.geometry_override, record.geometry),
           ST_MakeEnvelope($3, $4, $5, $6, 4326)
         )
       ORDER BY participation.updated_at DESC, participation.id
       LIMIT $7 OFFSET $8`,
      [query.projectId, query.appIds, ...query.bounds, query.pageSize, offset],
    );
    const totalRecords = result.rows[0]?.total_records ?? 0;
    return {
      data: result.rows.map((row) => {
        const effective = resolveEffectiveRecord({
          canonicalAttributes: row.canonical_attributes,
          attributesOverride: row.attributes_override,
          projectAttributes: row.project_attributes,
          canonicalGeometry: row.geometry,
          geometryOverride: row.geometry_override,
          displayGeometryOverride: row.display_geometry_override,
        });
        return {
          recordUuid: row.record_uuid,
          projectRecordUuid: row.project_record_uuid,
          projectAppId: row.project_app_id,
          attributes: effective.attributes,
          geometry: effective.geometry,
          displayGeometry: effective.displayGeometry,
          appName: row.app_name,
        };
      }),
      page: query.page,
      pageSize: query.pageSize,
      totalRecords,
      totalPages: Math.ceil(totalRecords / query.pageSize),
    };
  }
}
