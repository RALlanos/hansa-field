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
