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

  it("creates the next immutable schema version for an App", async () => {
    const query = vi.fn().mockResolvedValue({
      rows: [
        {
          id: "version-id",
          version: 1,
          schema_definition: { sections: [] },
          created_at: new Date("2026-09-02T00:00:00.000Z"),
        },
      ],
    });
    const service = new AppsService({ query } as never);

    await expect(
      service.createVersion("app-id", { sections: [] }),
    ).resolves.toMatchObject({ version: 1, schema: { sections: [] } });
  });

  it("returns the newest saved schema version", async () => {
    const query = vi.fn().mockResolvedValue({
      rows: [
        {
          id: "version-id",
          version: 3,
          schema_definition: { sections: [] },
          created_at: new Date("2026-09-02T00:00:00.000Z"),
        },
      ],
    });
    const service = new AppsService({ query } as never);

    await expect(service.latestVersion("app-id")).resolves.toMatchObject({
      version: 3,
      schema: { sections: [] },
    });
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining("ORDER BY version DESC"),
      ["app-id"],
    );
  });
});
