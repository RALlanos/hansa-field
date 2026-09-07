import { describe, expect, it, vi } from "vitest";

import { ProjectAppsController } from "./project-apps.controller.js";

describe("ProjectAppsController", () => {
  it("creates a new version for one Project App", async () => {
    const createProjectAppVersion = vi.fn().mockResolvedValue({ version: 2 });
    const controller = new ProjectAppsController({
      createProjectAppVersion,
    } as never);
    const schema = {
      sections: [
        {
          id: "00000000-0000-4000-8000-000000000001",
          title: "Datos",
          fields: [],
        },
      ],
    };

    await expect(
      controller.createVersion("00000000-0000-4000-8000-000000000002", schema),
    ).resolves.toEqual({ version: 2 });
    expect(createProjectAppVersion).toHaveBeenCalledWith(
      "00000000-0000-4000-8000-000000000002",
      schema,
    );
  });
});
