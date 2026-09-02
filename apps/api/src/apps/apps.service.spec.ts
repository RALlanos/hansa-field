import { describe, expect, it, vi } from "vitest";

import { AppsService } from "./apps.service.js";

describe("AppsService", () => {
  it("creates an app with a server-generated UUID", async () => {
    const query = vi.fn().mockResolvedValue({
      rows: [
        {
          id: "e514c4e7-1e9c-4c3d-88f4-e6b468613cec",
          code: "POSTES",
          name: "Postes",
          allowed_geometries: ["Point"],
          created_at: new Date("2026-09-02T00:00:00.000Z"),
        },
      ],
    });
    const service = new AppsService({ query } as never);

    await expect(
      service.create({
        code: "POSTES",
        name: "Postes",
        allowedGeometries: ["Point"],
      }),
    ).resolves.toMatchObject({ code: "POSTES", allowedGeometries: ["Point"] });
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining("INSERT INTO app_definitions"),
      ["POSTES", "Postes", ["Point"]],
    );
  });
});
