import { z } from "zod";

export type MapMode = "app" | "project" | "universal";

export const attributeFilterSchema = z
  .object({
    fieldId: z.string().uuid(),
    operator: z.enum([
      "equals",
      "notEquals",
      "isEmpty",
      "isNotEmpty",
    ]),
    value: z.unknown().optional(),
  })
  .strict();

export const territoryRefSchema = z
  .object({
    schemeId: z.string().uuid(),
    territoryId: z.string().uuid(),
  })
  .strict();

/**
 * Public cartographic scope. Dataset is an internal resolution; the caller
 * works with product identities (app, project, local collection, territory).
 */
export const mapScopeSchema = z
  .object({
    mode: z.enum(["app", "project", "universal"]),
    appIds: z.array(z.string().uuid()).max(200).optional(),
    projectIds: z.array(z.string().uuid()).max(200).optional(),
    localCollectionIds: z.array(z.string().uuid()).max(200).optional(),
    territories: z.array(territoryRefSchema).max(200).optional(),
    filters: z.array(attributeFilterSchema).max(50).optional(),
    bbox: z.tuple([
      z.coerce.number().min(-180).max(180),
      z.coerce.number().min(-90).max(90),
      z.coerce.number().min(-180).max(180),
      z.coerce.number().min(-90).max(90),
    ]),
    zoom: z.coerce.number().int().min(0).max(24).default(12),
    budget: z.coerce.number().int().min(10).max(10_000).default(2_000),
  })
  .strict();

export type MapScope = z.infer<typeof mapScopeSchema>;
export type AttributeFilter = z.infer<typeof attributeFilterSchema>;
export type TerritoryRef = z.infer<typeof territoryRefSchema>;

export type MapSymbol = Readonly<{
  icon: string;
  color: string;
  label?: string;
}>;

/**
 * Non-ambiguous cartographic feature. Every representation carries its own
 * identities; a same record appearing through App and Project yields distinct
 * representations (contextRef) and is never treated as a duplicate here.
 */
export type MapFeatureDto = Readonly<{
  id: string;
  recordUuid: string | null;
  datasetId: string;
  appId: string | null;
  projectId: string | null;
  projectAppId: string | null;
  projectRecordUuid: string | null;
  contextRef: string | null;
  revision: number;
  geometry: GeoJsonMapGeometry;
  symbol: MapSymbol;
  count: number;
  isCluster?: boolean;
  attributes?: Readonly<Record<string, unknown>>;
}>;

export type MapFeatureResult = Readonly<{
  data: MapFeatureDto[];
  clustered: boolean;
  totalRecords: number;
  truncated: boolean;
}>;

export type MapTableRowDto = MapFeatureDto &
  Readonly<{
    attributes: Readonly<Record<string, unknown>>;
    updatedAt: string;
  }>;

export type MapTableResult = Readonly<{
  data: MapTableRowDto[];
  totalRecords: number;
  nextCursor: string | null;
}>;

export type GeoJsonMapGeometry =
  | Readonly<{ type: "Point"; coordinates: [number, number] }>
  | Readonly<{ type: "LineString"; coordinates: [number, number][] }>
  | Readonly<{ type: "Polygon"; coordinates: [number, number][][] }>;