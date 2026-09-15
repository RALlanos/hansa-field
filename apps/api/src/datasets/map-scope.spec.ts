import { expect, it } from "vitest";
import type { DatabaseQuery } from "../database/database.service.js";
import { MapRecordsService } from "./map-records.service.js";
import { mapScopeSchema } from "./map-scope.js";

it("accepts segment filters alongside the current map scope", () => {
  const segmentId = "00000000-0000-4000-8000-000000000101";
  const scope = mapScopeSchema.parse({
    mode: "project",
    projectIds: ["00000000-0000-4000-8000-000000000102"],
    segmentIds: [segmentId],
    bbox: [-69, -18, -68, -17],
  });

  expect(scope.segmentIds).toEqual([segmentId]);
});

it("uses a selected segment and its descendants when querying the map", async () => {
  const segmentId = "00000000-0000-4000-8000-000000000101";
  const calls: { sql: string; values: readonly unknown[] | undefined }[] = [];
  const database: DatabaseQuery = {
    async query<T>(sql: string, values?: readonly unknown[]) {
      calls.push({ sql, values });
      return { rows: [] as T[] };
    },
  };
  const service = new MapRecordsService(database);

  await service.table(
    "00000000-0000-4000-8000-000000000001",
    mapScopeSchema.parse({
      mode: "project",
      projectIds: ["00000000-0000-4000-8000-000000000102"],
      segmentIds: [segmentId],
      bbox: [-69, -18, -68, -17],
    }),
    null,
    100,
  );

  expect(calls[0]?.sql).toContain("segment_memberships");
  expect(calls[0]?.sql).toContain("selected_segments");
  expect(calls[0]?.values).toContainEqual([segmentId]);
});

it("clusters only point geometries and leaves linear geometries as map features", async () => {
  const calls: { sql: string; values: readonly unknown[] | undefined }[] = [];
  const database: DatabaseQuery = {
    async query<T>(sql: string, values?: readonly unknown[]) {
      calls.push({ sql, values });
      if (sql.includes("point_total"))
        return { rows: [{ total: 4_001, point_total: 4_000 }] as T[] };
      if (sql.includes("ST_GeometryType(geometry) = 'ST_Point'"))
        return { rows: [] as T[] };
      if (sql.includes("ST_GeometryType(geometry) IN"))
        return {
          rows: [
            {
              record_uuid: "00000000-0000-4000-8000-000000000103",
              project_record_uuid: null,
              dataset_id: "00000000-0000-4000-8000-000000000104",
              app_id: null,
              project_id: null,
              project_app_id: null,
              revision: 1,
              attributes: {},
              geometry: {
                type: "LineString",
                coordinates: [
                  [-69, -18],
                  [-68, -17],
                ],
              },
              app_name: null,
              dataset_name: "Red FTTH",
              updated_at: "2026-09-15T00:00:00.000Z",
            },
          ] as T[],
        };
      return { rows: [] as T[] };
    },
  };
  const service = new MapRecordsService(database);

  const result = await service.map(
    "00000000-0000-4000-8000-000000000001",
    mapScopeSchema.parse({
      mode: "app",
      appIds: ["00000000-0000-4000-8000-000000000102"],
      bbox: [-69, -18, -68, -17],
      budget: 100,
    }),
  );

  expect(result.clustered).toBe(true);
  expect(
    result.data.some(
      (feature) => feature.geometry.type === "LineString" && !feature.isCluster,
    ),
  ).toBe(true);
  expect(
    calls.some((call) =>
      call.sql.includes(
        "ST_GeometryType(geometry) IN ('ST_LineString', 'ST_Polygon')",
      ),
    ),
  ).toBe(true);
});
