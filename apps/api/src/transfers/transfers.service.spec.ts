import { describe, expect, it, vi } from "vitest";

import { TransfersService, type TransferFeature } from "./transfers.service.js";

const point: TransferFeature = {
  type: "Feature",
  geometry: { type: "Point", coordinates: [-68.15, -16.5] },
  properties: { codigo: "P-01" },
};

describe("TransfersService", () => {
  it("previews new and existing UUID records without writing", async () => {
    const query = vi
      .fn()
      .mockResolvedValueOnce({
        rows: [{ version_id: "version-id", allowed_geometries: ["Point"] }],
      })
      .mockResolvedValueOnce({
        rows: [{ id: "7d00e945-8ef5-44b4-84f6-91aee29ec947" }],
      });
    const service = new TransfersService({ query } as never);

    await expect(
      service.preview("app-id", [
        point,
        { ...point, id: "7d00e945-8ef5-44b4-84f6-91aee29ec947" },
      ]),
    ).resolves.toMatchObject({ total: 2, creates: 1, updates: 1, errors: [] });
    expect(query).toHaveBeenCalledTimes(2);
  });

  it("rejects a supplied UUID that does not exist in the App", async () => {
    const query = vi
      .fn()
      .mockResolvedValueOnce({
        rows: [{ version_id: "version-id", allowed_geometries: ["Point"] }],
      })
      .mockResolvedValueOnce({ rows: [] });
    const service = new TransfersService({ query } as never);

    await expect(
      service.preview("app-id", [
        { ...point, id: "7d00e945-8ef5-44b4-84f6-91aee29ec947" },
      ]),
    ).resolves.toMatchObject({
      creates: 0,
      updates: 0,
      errors: [{ index: 0, message: expect.stringContaining("no existe") }],
    });
  });

  it("persists a confirmed preview inside one transaction", async () => {
    const query = vi.fn().mockResolvedValueOnce({
      rows: [{ version_id: "version-id", allowed_geometries: ["Point"] }],
    });
    const transactionQuery = vi
      .fn()
      .mockResolvedValueOnce({
        rows: [{ version_id: "version-id", allowed_geometries: ["Point"] }],
      })
      .mockResolvedValueOnce({ rows: [] });
    const withTransaction = vi.fn(async (operation) =>
      operation({ query: transactionQuery }),
    );
    const service = new TransfersService({ query, withTransaction } as never);

    await expect(service.confirm("app-id", [point])).resolves.toEqual({
      created: 1,
      updated: 0,
      failed: 0,
    });
    expect(withTransaction).toHaveBeenCalledOnce();
    expect(transactionQuery).toHaveBeenLastCalledWith(
      expect.stringContaining("INSERT INTO records"),
      ["app-id", "version-id", point.properties, point.geometry],
    );
  });
});
