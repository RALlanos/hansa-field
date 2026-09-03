import { describe, expect, it, vi } from "vitest";
import { UnprocessableEntityException } from "@nestjs/common";

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

  it("accepts a visual telecom symbol in the App settings", async () => {
    const updateSettings = vi.fn().mockResolvedValue({ mapIcon: "tower" });
    const controller = new AppsController({ updateSettings } as never);

    await expect(
      controller.updateSettings("app-id", {
        description: "Torres de telecomunicaciones",
        mapIcon: "tower",
        mapColor: "#245b8f",
      }),
    ).resolves.toEqual({ mapIcon: "tower" });
    expect(updateSettings).toHaveBeenCalledWith("app-id", {
      description: "Torres de telecomunicaciones",
      mapIcon: "tower",
      mapColor: "#245b8f",
    });
  });

  it("rejects a map symbol outside the visual catalog", async () => {
    const controller = new AppsController({ updateSettings: vi.fn() } as never);

    await expect(
      controller.updateSettings("app-id", {
        description: "",
        mapIcon: "texto-sin-simbolo",
        mapColor: "#245b8f",
      }),
    ).rejects.toBeInstanceOf(UnprocessableEntityException);
  });
});
