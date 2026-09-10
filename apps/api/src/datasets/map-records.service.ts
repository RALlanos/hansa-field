import { Inject, Injectable } from "@nestjs/common";

import {
  DatabaseService,
  type DatabaseQuery,
} from "../database/database.service.js";
import {
  type AttributeFilter,
  type GeoJsonMapGeometry,
  type MapFeatureDto,
  type MapFeatureResult,
  type MapScope,
  type MapTableResult,
  type MapSymbol,
} from "./map-scope.js";

type VisibleRow = {
  record_uuid: string;
  project_record_uuid: string | null;
  dataset_id: string;
  app_id: string | null;
  project_id: string | null;
  project_app_id: string | null;
  revision: number;
  attributes: Record<string, unknown>;
  geometry: GeoJsonMapGeometry;
  app_name: string | null;
  dataset_name: string;
  updated_at: string;
};

type ClusterRow = {
  gx: number;
  gy: number;
  count: number;
  geometry: GeoJsonMapGeometry;
  dataset_id: string;
  app_id: string | null;
  project_id: string | null;
  project_app_id: string | null;
  app_name: string | null;
  dataset_name: string;
};

type SettingsRow = { project_app_id: string; settings: unknown };

const defaultColor = "#3d7398";
const fallbackIcons = [
  "pin",
  "square",
  "triangle",
  "diamond",
  "node",
  "building",
  "post",
  "tower",
];

function hashText(value: string): number {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function stableColor(value: string): string {
  const hue = hashText(value) % 360;
  return `hsl(${hue} 55% 42%)`;
}

function stableIcon(value: string): string {
  return fallbackIcons[hashText(value) % fallbackIcons.length]!;
}

function resolveSymbol(
  overrides: Map<string, MapSymbol>,
  source: {
    projectAppId: string | null;
    appId: string | null;
    appName: string | null;
    datasetName: string;
  },
): MapSymbol {
  const contextual = source.projectAppId
    ? overrides.get(source.projectAppId)
    : undefined;
  if (contextual) return contextual;
  const base = source.appId && source.appName ? source.appName : null;
  if (base) {
    return {
      icon: stableIcon(base),
      color: stableColor(base),
      ...(source.appName ? { label: source.appName } : {}),
    };
  }
  return {
    icon: "pin",
    color: defaultColor,
    label: source.datasetName,
  };
}

/** Resolves public identities (appIds/localCollectionIds) into an internal dataset id filter. */
function resolveMode(scope: MapScope): "app" | "project" | "universal" {
  return scope.mode;
}

@Injectable()
export class MapRecordsService {
  constructor(
    @Inject(DatabaseService) private readonly database: DatabaseQuery,
  ) {}

  async map(organizationId: string, scope: MapScope): Promise<MapFeatureResult> {
    const mode = resolveMode(scope);
    const projectIds = scope.projectIds ?? null;
    const appIds = scope.appIds ?? null;
    const localIds = scope.localCollectionIds ?? null;
    const [west, south, east, north] = scope.bbox;
    const baseParams: unknown[] = [
      organizationId,
      projectIds,
      appIds,
      localIds,
      west,
      south,
      east,
      north,
    ];
    const base = {
      visible: this.visibleSql(mode),
      params: baseParams,
      bbox: scope.bbox,
    };
    const { where, filterParams } = this.buildFilters(scope.filters ?? []);
    const countParams = [...base.params, ...filterParams];
    const count = await this.database.query<{ total: number }>(
      `${base.visible} SELECT count(*)::integer total FROM visible WHERE ${where || "true"}`,
      countParams,
    );
    const totalRecords = count.rows[0]?.total ?? 0;
    if (totalRecords <= scope.budget) {
      return this.features(organizationId, base, where, filterParams, scope);
    }
    return this.clusters(organizationId, base, where, filterParams, scope);
  }

  async table(
    organizationId: string,
    scope: MapScope,
    cursor: string | null,
    limit: number,
  ): Promise<MapTableResult> {
    const mode = resolveMode(scope);
    const base = {
      visible: this.visibleSql(mode),
      params: [
        organizationId,
        scope.projectIds ?? null,
        scope.appIds ?? null,
        scope.localCollectionIds ?? null,
        ...scope.bbox,
      ],
    };
    const { where, filterParams } = this.buildFilters(scope.filters ?? []);
    const cursorParam = 9 + filterParams.length;
    const limitParam = cursorParam + 1;
    const result = await this.database.query<VisibleRow>(
      `${base.visible}, filtered AS (SELECT * FROM visible WHERE ${where || "true"})
       SELECT *, ST_AsGeoJSON(geometry)::jsonb geometry FROM filtered
       WHERE ($${cursorParam}::uuid IS NULL OR COALESCE(project_record_uuid,record_uuid) > $${cursorParam}::uuid)
       ORDER BY COALESCE(project_record_uuid,record_uuid) LIMIT $${limitParam}`,
      [...base.params, ...filterParams, cursor, limit + 1],
    );
    const hasMore = result.rows.length > limit;
    const rows = result.rows.slice(0, limit);
    const overrides = await this.loadOverrides(
      organizationId,
      [...new Set(rows.map((row) => row.project_app_id).filter(Boolean))] as string[],
    );
    return {
      data: rows.map((row) => ({
        ...this.toFeature(row, overrides, 1),
        attributes: row.attributes,
        updatedAt: row.updated_at,
      })),
      totalRecords: await this.scopeCount(base, where, filterParams),
      nextCursor: hasMore ? rows.at(-1)?.project_record_uuid ?? rows.at(-1)?.record_uuid ?? null : null,
    };
  }

  private async features(
    organizationId: string,
    base: { visible: string; params: unknown[] },
    where: string,
    filterParams: unknown[],
    scope: MapScope,
  ): Promise<MapFeatureResult> {
    const limit = scope.budget + 1;
    const limitParam = 9 + filterParams.length;
    const result = await this.database.query<VisibleRow>(
      `${base.visible}, filtered AS (SELECT * FROM visible WHERE ${where || "true"})
       SELECT *, ST_AsGeoJSON(geometry)::jsonb geometry FROM filtered ORDER BY dataset_id,record_uuid LIMIT $${limitParam}`,
      [...base.params, ...filterParams, limit],
    );
    const overrides = await this.loadOverrides(
      organizationId,
      [...new Set(result.rows.map((r) => r.project_app_id).filter(Boolean))] as string[],
    );
    const rows = result.rows.slice(0, scope.budget);
    return {
      data: rows.map((row) => this.toFeature(row, overrides, 1)),
      clustered: false,
      totalRecords: await this.scopeCount(base, where, filterParams),
      truncated: result.rows.length > scope.budget,
    };
  }

  private async clusters(
    organizationId: string,
    base: {
      visible: string;
      params: unknown[];
      bbox: readonly [number, number, number, number];
    },
    where: string,
    filterParams: unknown[],
    scope: MapScope,
  ): Promise<MapFeatureResult> {
    const cellWidth = Math.max((base.bbox[2] - base.bbox[0]) / 24, 0.00000001);
    const cellHeight = Math.max((base.bbox[3] - base.bbox[1]) / 24, 0.00000001);
    const cellWidthParam = 9 + filterParams.length;
    const cellHeightParam = cellWidthParam + 1;
    const budgetParam = cellHeightParam + 1;
    const result = await this.database.query<ClusterRow>(
      `${base.visible}, filtered AS (SELECT * FROM visible WHERE ${where || "true"}), points AS (
        SELECT floor((ST_X(ST_PointOnSurface(geometry))-$5)/$${cellWidthParam}) gx,
               floor((ST_Y(ST_PointOnSurface(geometry))-$6)/$${cellHeightParam}) gy,
               count(*)::integer count,
               ST_AsGeoJSON(ST_Centroid(ST_Collect(ST_PointOnSurface(geometry))))::jsonb geometry,
               dataset_id, app_id,
               project_id, project_app_id,
               min(app_name) app_name, min(dataset_name) dataset_name
        FROM filtered GROUP BY 1,2,dataset_id,app_id,project_id,project_app_id)
      SELECT * FROM points ORDER BY count DESC LIMIT $${budgetParam}`,
      [...base.params, ...filterParams, cellWidth, cellHeight, scope.budget],
    );
    const overrides = await this.loadOverrides(
      organizationId,
      [...new Set(result.rows.map((r) => r.project_app_id).filter(Boolean))] as string[],
    );
    return {
      data: result.rows.map((row) => {
        const symbol = resolveSymbol(overrides, {
          projectAppId: row.project_app_id,
          appId: row.app_id,
          appName: row.app_name,
          datasetName: row.dataset_name,
        });
        return {
          id: `cluster:${row.dataset_id}:${row.project_id ?? "app"}:${row.gx}:${row.gy}`,
          recordUuid: null,
          datasetId: row.dataset_id,
          appId: row.app_id,
          projectId: row.project_id,
          projectAppId: row.project_app_id,
          projectRecordUuid: null,
          contextRef: row.project_id
            ? `project:${row.project_id}`
            : "app",
          revision: 0,
          geometry: row.geometry,
          symbol,
          count: row.count,
          isCluster: true,
        } satisfies MapFeatureDto;
      }),
      clustered: true,
      totalRecords: await this.scopeCount(base, where, filterParams),
      truncated: result.rows.length >= scope.budget,
    };
  }

  private async scopeCount(
    base: { visible: string; params: unknown[] },
    where: string,
    filterParams: unknown[],
  ): Promise<number> {
    const result = await this.database.query<{ total: number }>(
      `${base.visible} SELECT count(*)::integer total FROM visible WHERE ${where || "true"}`,
      [...base.params, ...filterParams],
    );
    return result.rows[0]?.total ?? 0;
  }

  private toFeature(
    row: VisibleRow,
    overrides: Map<string, MapSymbol>,
    count: number,
  ): MapFeatureDto {
    const symbol = resolveSymbol(overrides, {
      projectAppId: row.project_app_id,
      appId: row.app_id,
      appName: row.app_name,
      datasetName: row.dataset_name,
    });
    return {
      id: row.project_record_uuid ?? row.record_uuid,
      recordUuid: row.record_uuid,
      datasetId: row.dataset_id,
      appId: row.app_id,
      projectId: row.project_id,
      projectAppId: row.project_app_id,
      projectRecordUuid: row.project_record_uuid,
      contextRef: row.project_id ? `project:${row.project_id}` : "app",
      revision: row.revision,
      geometry: row.geometry,
      symbol,
      count,
    };
  }

  private async loadOverrides(
    organizationId: string,
    projectAppIds: string[],
  ): Promise<Map<string, MapSymbol>> {
    const map = new Map<string, MapSymbol>();
    if (!projectAppIds.length) return map;
    const result = await this.database.query<SettingsRow>(
      `SELECT pa.id project_app_id, pv.settings FROM project_apps pa
       LEFT JOIN LATERAL (SELECT settings FROM project_app_versions WHERE project_app_id=pa.id ORDER BY version DESC LIMIT 1) pv ON true
       WHERE pa.organization_id=$1 AND pa.id=ANY($2::uuid[])`,
      [organizationId, projectAppIds],
    );
    for (const row of result.rows) {
      const symbol = this.readSymbolSettings(row.settings);
      if (symbol) map.set(row.project_app_id, symbol);
    }
    return map;
  }

  private readSymbolSettings(settings: unknown): MapSymbol | null {
    if (!settings || typeof settings !== "object") return null;
    const symbol = (settings as { symbol?: unknown }).symbol;
    if (!symbol || typeof symbol !== "object") return null;
    const candidate = symbol as { icon?: unknown; color?: unknown; label?: unknown };
    if (typeof candidate.icon !== "string" && typeof candidate.color !== "string")
      return null;
    return {
      icon: typeof candidate.icon === "string" ? candidate.icon : "pin",
      color: typeof candidate.color === "string" ? candidate.color : defaultColor,
      ...(typeof candidate.label === "string" ? { label: candidate.label } : {}),
    };
  }

  private buildFilters(filters: AttributeFilter[]): {
    where: string;
    filterParams: unknown[];
  } {
    const clauses: string[] = [];
    const filterParams: unknown[] = [];
    let index = 9;
    for (const filter of filters) {
      const key = filter.fieldId;
      const param = `$${index}`;
      switch (filter.operator) {
        case "isEmpty":
          clauses.push(`(attributes->>'${key}') IS NULL`);
          break;
        case "isNotEmpty":
          clauses.push(`(attributes->>'${key}') IS NOT NULL`);
          break;
        case "equals":
          if (filter.value === null || filter.value === undefined) {
            clauses.push(`(attributes->>'${key}') IS NULL`);
          } else {
            clauses.push(`attributes->'${key}' = ${param}::jsonb`);
            filterParams.push(JSON.stringify(filter.value));
            index++;
          }
          break;
        case "notEquals":
          if (filter.value === null || filter.value === undefined) {
            clauses.push(`(attributes->>'${key}') IS NOT NULL`);
          } else {
            clauses.push(
              `attributes->'${key}' IS DISTINCT FROM ${param}::jsonb`,
            );
            filterParams.push(JSON.stringify(filter.value));
            index++;
          }
          break;
      }
    }
    return { where: clauses.join(" AND "), filterParams };
  }

  private visibleSql(mode: "app" | "project" | "universal"): string {
    const project = `
      SELECT r.id record_uuid, pr.id project_record_uuid, d.id dataset_id, d.app_id, pr.project_id, pr.project_app_id,
             pr.revision revision,
             (r.attributes||COALESCE(pr.attributes_override,'{}')||COALESCE(pr.project_attributes,'{}')) attributes,
             pr.display_geometry_override geometry, a.name app_name, d.name dataset_name, r.updated_at
      FROM project_records pr JOIN records r ON r.id=pr.record_id AND r.organization_id=$1
      JOIN datasets d ON d.id=pr.dataset_id AND d.organization_id=$1
      LEFT JOIN apps a ON a.id=d.app_id
      WHERE pr.organization_id=$1 AND pr.status='active' AND r.lifecycle='active'
        AND ($2::uuid[] IS NULL OR pr.project_id=ANY($2))
        AND ($3::uuid[] IS NULL OR d.app_id=ANY($3))
        AND ($4::uuid[] IS NULL OR pr.dataset_id=ANY($4))
        AND ($2::uuid[] IS NOT NULL OR $4::uuid[] IS NOT NULL)
        AND pr.display_geometry_override IS NOT NULL
        AND ST_Intersects(pr.display_geometry_override, ST_MakeEnvelope($5,$6,$7,$8,4326))
      UNION ALL
      SELECT r.id record_uuid, pr.id project_record_uuid, d.id dataset_id, d.app_id, pr.project_id, pr.project_app_id,
             pr.revision revision,
             (r.attributes||COALESCE(pr.attributes_override,'{}')||COALESCE(pr.project_attributes,'{}')) attributes,
             pr.geometry_override geometry, a.name app_name, d.name dataset_name, r.updated_at
      FROM project_records pr JOIN records r ON r.id=pr.record_id AND r.organization_id=$1
      JOIN datasets d ON d.id=pr.dataset_id AND d.organization_id=$1
      LEFT JOIN apps a ON a.id=d.app_id
      WHERE pr.organization_id=$1 AND pr.status='active' AND r.lifecycle='active'
        AND ($2::uuid[] IS NULL OR pr.project_id=ANY($2))
        AND ($3::uuid[] IS NULL OR d.app_id=ANY($3))
        AND ($4::uuid[] IS NULL OR pr.dataset_id=ANY($4))
        AND ($2::uuid[] IS NOT NULL OR $4::uuid[] IS NOT NULL)
        AND pr.display_geometry_override IS NULL AND pr.geometry_override IS NOT NULL
        AND ST_Intersects(pr.geometry_override, ST_MakeEnvelope($5,$6,$7,$8,4326))
      UNION ALL
      SELECT r.id record_uuid, pr.id project_record_uuid, d.id dataset_id, d.app_id, pr.project_id, pr.project_app_id,
             pr.revision revision,
             (r.attributes||COALESCE(pr.attributes_override,'{}')||COALESCE(pr.project_attributes,'{}')) attributes,
             r.geometry geometry, a.name app_name, d.name dataset_name, r.updated_at
      FROM project_records pr JOIN records r ON r.id=pr.record_id AND r.organization_id=$1
      JOIN datasets d ON d.id=pr.dataset_id AND d.organization_id=$1
      LEFT JOIN apps a ON a.id=d.app_id
      WHERE pr.organization_id=$1 AND pr.status='active' AND r.lifecycle='active'
        AND ($2::uuid[] IS NULL OR pr.project_id=ANY($2))
        AND ($3::uuid[] IS NULL OR d.app_id=ANY($3))
        AND ($4::uuid[] IS NULL OR pr.dataset_id=ANY($4))
        AND ($2::uuid[] IS NOT NULL OR $4::uuid[] IS NOT NULL)
        AND pr.display_geometry_override IS NULL AND pr.geometry_override IS NULL AND r.geometry IS NOT NULL
        AND ST_Intersects(r.geometry, ST_MakeEnvelope($5,$6,$7,$8,4326))`;
    if (mode === "project") return `WITH visible AS (${project})`;
    const app = `
      SELECT r.id record_uuid, NULL::uuid project_record_uuid, d.id dataset_id, d.app_id, NULL::uuid project_id, NULL::uuid project_app_id,
             r.revision revision, r.attributes attributes, r.geometry geometry, a.name app_name, d.name dataset_name, r.updated_at
      FROM records r JOIN datasets d ON d.id=r.dataset_id AND d.organization_id=$1
      LEFT JOIN apps a ON a.id=d.app_id
      WHERE r.organization_id=$1 AND r.lifecycle='active' AND d.local_project_id IS NULL
        AND ($3::uuid[] IS NOT NULL AND d.app_id=ANY($3))
        AND r.geometry IS NOT NULL
        AND ST_Intersects(r.geometry, ST_MakeEnvelope($5,$6,$7,$8,4326))`;
    if (mode === "app") return `WITH scope_parameters AS (SELECT $2::uuid[] project_ids,$4::uuid[] local_ids), visible AS (${app})`;
    return `WITH visible AS (${app} UNION ALL ${project})`;
  }
}
