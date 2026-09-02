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
});
