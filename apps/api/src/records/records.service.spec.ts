import { describe, expect, it, vi } from "vitest";

import { RecordsService } from "./records.service.js";

describe("RecordsService", () => {
  it("creates a manual point record with the current App version", async () => {
    const query = vi
      .fn()
      .mockResolvedValueOnce({ rows: [{ id: "version-id" }] })
      .mockResolvedValueOnce({
        rows: [
          {
            id: "record-id",
            app_id: "app-id",
            app_version_id: "version-id",
            attributes: { codigo: "P-01" },
            geometry: { type: "Point", coordinates: [-68.15, -16.5] },
            created_at: new Date("2026-09-02T00:00:00.000Z"),
            updated_at: new Date("2026-09-02T00:00:00.000Z"),
          },
        ],
      });
    const service = new RecordsService({ query } as never);

    await expect(
      service.create("app-id", {
        attributes: { codigo: "P-01" },
        geometry: { type: "Point", coordinates: [-68.15, -16.5] },
      }),
    ).resolves.toMatchObject({
      id: "record-id",
      attributes: { codigo: "P-01" },
    });
  });

  it("returns clustered map features without exposing every record", async () => {
    const query = vi.fn().mockResolvedValue({
      rows: [
        {
          id: "cluster:app-id:1",
          app_id: "app-id",
          app_name: "Postes",
          map_icon: "post",
          map_color: "#65a30d",
          feature_count: 847,
          total_records: 10_000,
          total_features: 1,
          geometry: { type: "Point", coordinates: [-63.1, -17.8] },
        },
      ],
    });
    const service = new RecordsService({ query } as never);

    await expect(
      service.listMapFeatures({
        appIds: ["app-id"],
        bounds: [-69, -23, -57, -9],
        zoom: 8,
      }),
    ).resolves.toEqual({
      data: [
        {
          id: "cluster:app-id:1",
          appId: "app-id",
          appName: "Postes",
          mapIcon: "post",
          mapColor: "#65a30d",
          count: 847,
          geometry: { type: "Point", coordinates: [-63.1, -17.8] },
        },
      ],
      clustered: true,
      totalRecords: 10_000,
      truncated: false,
    });
  });
});
