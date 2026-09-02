import { describe, expect, it, vi } from "vitest";

import { AppsController } from "./apps.controller.js";

describe("AppsController", () => {
  it("returns the Apps listed by its service", async () => {
    const list = vi.fn().mockResolvedValue([]);
    const controller = new AppsController({ list } as never);

    await expect(controller.list()).resolves.toEqual({ data: [] });
  });
});
