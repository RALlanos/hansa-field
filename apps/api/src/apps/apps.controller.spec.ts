import { describe, expect, it, vi } from "vitest";

import { AppsController } from "./apps.controller.js";

describe("AppsController", () => {
  it("returns the Apps listed by its service", async () => {
    const list = vi.fn().mockResolvedValue([]);
    const controller = new AppsController({ list } as never);

    await expect(controller.list()).resolves.toEqual({ data: [] });
  });

  it("accepts a section subtitle in a versioned form", async () => {
    const createVersion = vi.fn().mockResolvedValue({ version: 1 });
    const controller = new AppsController({ createVersion } as never);
    const appId = "f7f6d7b3-1ed4-44c2-99a0-8d3c6e2af542";
    const sectionId = "e94b8e9c-f347-4e93-9ac1-8159f3bd2151";

    await expect(
      controller.createVersion(appId, {
        sections: [
          {
            id: sectionId,
            title: "Postes",
            subtitle: "Datos generales",
            fields: [],
          },
        ],
      }),
    ).resolves.toEqual({ version: 1 });
    expect(createVersion).toHaveBeenCalledWith(appId, {
      sections: [
        {
          id: sectionId,
          title: "Postes",
          subtitle: "Datos generales",
          fields: [],
        },
      ],
    });
  });
});
