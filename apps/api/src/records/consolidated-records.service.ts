import { Inject, Injectable, NotFoundException } from "@nestjs/common";
import { z } from "zod";
import {
  DatabaseService,
  type DatabaseQuery,
} from "../database/database.service.js";
import {
  effectiveRecordSql,
  resolveEffectiveRecord,
} from "./effective-record.js";
import type { GeoJsonGeometry } from "./records.service.js";

const schema = z.object({
  sections: z.array(
    z.object({
      fields: z.array(
        z.object({ id: z.string(), key: z.string(), label: z.string() }),
      ),
    }),
  ),
});
type Context = {
  id: string;
  project_id: string;
  project_name: string;
  name: string;
  code: string;
  map_icon: string;
  map_color: string;
  allowed_geometries: string[];
  schema_definition: unknown;
};
type Row = {
  record_uuid: string;
  project_record_uuid: string;
  project_app_id: string;
  project_id: string;
  project_name: string;
  app_name: string;
  canonical_attributes: Record<string, unknown>;
  attributes_override: Record<string, unknown>;
  project_attributes: Record<string, unknown>;
  geometry: GeoJsonGeometry | null;
  geometry_override: GeoJsonGeometry | null;
  display_geometry_override: GeoJsonGeometry | null;
};
export type ConsolidatedQuery = {
  projectId?: string;
  projectAppIds?: string[];
  search: string;
  page: number;
  pageSize: number;
};
const from = `FROM project_records pr JOIN project_apps pa ON pa.id=pr.project_app_id
 JOIN records r ON r.id=pr.record_id JOIN projects p ON p.id=pa.project_id
 JOIN app_definitions a ON a.id=pa.app_id
 CROSS JOIN LATERAL (SELECT ${effectiveRecordSql.attributes} AS attributes,
 ${effectiveRecordSql.displayGeometry} AS display_geometry) effective
 WHERE pa.app_id=$1 AND pr.status='active'
 AND ($2::uuid IS NULL OR pa.project_id=$2)
 AND ($3::uuid[] IS NULL OR pa.id=ANY($3))
 AND ($4='' OR strpos(lower(effective.attributes::text),lower($4))>0 OR strpos(lower(r.id::text),lower($4))>0)`;
const projection = `r.id AS record_uuid,pr.id AS project_record_uuid,pa.id AS project_app_id,
 p.id AS project_id,p.name AS project_name,a.name AS app_name,r.canonical_attributes,pr.attributes_override,pr.project_attributes,
 ST_AsGeoJSON(r.geometry)::jsonb AS geometry,ST_AsGeoJSON(pr.geometry_override)::jsonb AS geometry_override,
 ST_AsGeoJSON(pr.display_geometry_override)::jsonb AS display_geometry_override`;
function publicRow(row: Row) {
  return {
    recordUuid: row.record_uuid,
    projectRecordUuid: row.project_record_uuid,
    projectAppId: row.project_app_id,
    projectId: row.project_id,
    projectName: row.project_name,
    appName: row.app_name,
    ...resolveEffectiveRecord({
      canonicalAttributes: row.canonical_attributes,
      attributesOverride: row.attributes_override,
      projectAttributes: row.project_attributes,
      canonicalGeometry: row.geometry,
      geometryOverride: row.geometry_override,
      displayGeometryOverride: row.display_geometry_override,
    }),
  };
}
@Injectable()
export class ConsolidatedRecordsService {
  constructor(
    @Inject(DatabaseService) private readonly database: DatabaseQuery,
  ) {}
  async metadata(appId: string) {
    const app = await this.database.query<{ name: string }>(
      "SELECT name FROM app_definitions WHERE id=$1",
      [appId],
    );
    if (!app.rows[0]) throw new NotFoundException("La App no existe.");
    const result = await this.database.query<Context>(
      `SELECT pa.id,p.id AS project_id,p.name AS project_name,a.name,a.code,a.map_icon,a.map_color,a.allowed_geometries,v.schema_definition
      FROM project_apps pa JOIN projects p ON p.id=pa.project_id JOIN app_definitions a ON a.id=pa.app_id
      LEFT JOIN LATERAL (SELECT schema_definition FROM project_app_versions WHERE project_app_id=pa.id ORDER BY version DESC LIMIT 1) v ON true WHERE pa.app_id=$1 ORDER BY p.name,pa.id`,
      [appId],
    );
    const columns = new Map<
      string,
      { id: string; label: string; keys: Record<string, string> }
    >();
    const projectApps = result.rows.map((row) => {
      const parsed = schema.safeParse(row.schema_definition);
      for (const field of parsed.success
        ? parsed.data.sections.flatMap((s) => s.fields)
        : []) {
        const column = columns.get(field.id) ?? {
          id: field.id,
          label: field.label,
          keys: {},
        };
        column.keys[row.id] = field.key;
        columns.set(field.id, column);
      }
      return {
        id: row.id,
        projectId: row.project_id,
        projectName: row.project_name,
        name: row.name,
        code: row.code,
        mapIcon: row.map_icon,
        mapColor: row.map_color,
        allowedGeometries: row.allowed_geometries,
      };
    });
    return {
      name: app.rows[0].name,
      projectApps,
      columns: [...columns.values()],
    };
  }
  async list(appId: string, query: ConsolidatedQuery) {
    const params = [
      appId,
      query.projectId ?? null,
      query.projectAppIds ?? null,
      query.search,
    ];
    const count = await this.database.query<{ total: number }>(
      `SELECT count(*)::integer AS total ${from}`,
      params,
    );
    const result = await this.database.query<Row>(
      `SELECT ${projection} ${from} ORDER BY pr.updated_at DESC,pr.id LIMIT $5 OFFSET $6`,
      [...params, query.pageSize, (query.page - 1) * query.pageSize],
    );
    return {
      data: result.rows.map(publicRow),
      page: query.page,
      pageSize: query.pageSize,
      totalRecords: count.rows[0]?.total ?? 0,
    };
  }
  async map(
    appId: string,
    query: ConsolidatedQuery,
    bounds: number[],
    zoom: number,
  ) {
    const params = [
      appId,
      query.projectId ?? null,
      query.projectAppIds ?? null,
      query.search,
      ...bounds,
    ];
    const spatial = `${from} AND effective.display_geometry IS NOT NULL AND ST_Intersects(effective.display_geometry,ST_MakeEnvelope($5,$6,$7,$8,4326))`;
    if (zoom < 18) {
      const result = await this.database.query<{
        id: string;
        app_id: string;
        project_id: string;
        project_name: string;
        app_name: string;
        map_icon: string;
        map_color: string;
        count: number;
        geometry: GeoJsonGeometry;
        total: number;
        groups: number;
      }>(
        `WITH grouped AS (
        SELECT pa.id AS app_id,p.id AS project_id,p.name AS project_name,a.name AS app_name,a.map_icon,a.map_color,
        ST_SnapToGrid(ST_PointOnSurface(effective.display_geometry),$9) AS cell,count(*)::integer AS count,
        ST_Centroid(ST_Collect(ST_PointOnSurface(effective.display_geometry))) AS point ${spatial}
        GROUP BY pa.id,p.id,a.id,ST_SnapToGrid(ST_PointOnSurface(effective.display_geometry),$9))
        SELECT 'cluster:'||app_id||':'||ST_AsText(cell) AS id,app_id,project_id,project_name,app_name,map_icon,map_color,count,
        ST_AsGeoJSON(point)::jsonb AS geometry,sum(count) OVER()::integer AS total,count(*) OVER()::integer AS groups FROM grouped ORDER BY count DESC LIMIT 2000`,
        [...params, 360 / 2 ** (zoom + 5)],
      );
      return {
        data: result.rows.map((r) => ({
          id: r.id,
          appId: r.app_id,
          projectAppId: r.app_id,
          projectId: r.project_id,
          projectName: r.project_name,
          appName: r.app_name,
          mapIcon: r.map_icon,
          mapColor: r.map_color,
          count: r.count,
          geometry: r.geometry,
          isCluster: true,
        })),
        clustered: true,
        totalRecords: result.rows[0]?.total ?? 0,
        truncated: (result.rows[0]?.groups ?? 0) > 2000,
      };
    }
    const result = await this.database.query<
      Row & { map_icon: string; map_color: string; total: number }
    >(
      `SELECT ${projection},a.map_icon,a.map_color,count(*) OVER()::integer AS total ${spatial} ORDER BY pr.id LIMIT 10000`,
      params,
    );
    return {
      data: result.rows.map((r) => {
        const effective = publicRow(r);
        return {
          ...effective,
          id: r.project_record_uuid,
          appId: r.project_app_id,
          mapIcon: r.map_icon,
          mapColor: r.map_color,
          count: 1,
          geometry: effective.displayGeometry,
        };
      }),
      clustered: false,
      totalRecords: result.rows[0]?.total ?? 0,
      truncated: (result.rows[0]?.total ?? 0) > 10000,
    };
  }
}
