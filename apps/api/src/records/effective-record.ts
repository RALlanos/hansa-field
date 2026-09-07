import type { GeoJsonGeometry } from "./records.service.js";

/** SQL counterpart for filtering/aggregating effective values before pagination.
 * Queries using this projection must bind records as r and project_records as pr.
 */
export const effectiveRecordSql = {
  attributes:
    "r.canonical_attributes || pr.attributes_override || pr.project_attributes",
  geometry: "COALESCE(pr.geometry_override,r.geometry)",
  displayGeometry:
    "COALESCE(pr.display_geometry_override,pr.geometry_override,r.geometry)",
} as const;

export type EffectiveRecordInput = Readonly<{
  canonicalAttributes: Readonly<Record<string, unknown>>;
  attributesOverride: Readonly<Record<string, unknown>>;
  projectAttributes: Readonly<Record<string, unknown>>;
  canonicalGeometry: GeoJsonGeometry | null;
  geometryOverride: GeoJsonGeometry | null;
  displayGeometryOverride: GeoJsonGeometry | null;
}>;

export type EffectiveRecord = Readonly<{
  attributes: Readonly<Record<string, unknown>>;
  geometry: GeoJsonGeometry | null;
  displayGeometry: GeoJsonGeometry | null;
}>;

export function resolveEffectiveRecord(
  input: EffectiveRecordInput,
): EffectiveRecord {
  const geometry = input.geometryOverride ?? input.canonicalGeometry;
  return {
    attributes: {
      ...input.canonicalAttributes,
      ...input.attributesOverride,
      ...input.projectAttributes,
    },
    geometry,
    displayGeometry: input.displayGeometryOverride ?? geometry,
  };
}
