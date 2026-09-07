import { UnprocessableEntityException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";

import { RecordsMapController } from "./records-map.controller.js";

describe("RecordsMapController", () => {
  it("requests a bounded multi-App map at the current zoom", async () => {
    const listMapFeatures = vi.fn().mockResolvedValue({
      data: [],
      clustered: true,
      totalRecords: 0,
      truncated: false,
    });
    const controller = new RecordsMapController({ listMapFeatures } as never);
    const firstApp = "e94b8e9c-f347-4e93-9ac1-8159f3bd2151";
    const secondApp = "f7f6d7b3-1ed4-44c2-99a0-8d3c6e2af542";

    const projectId = "c4913898-358f-4769-8608-a64ecbcd1503";
    await controller.list(
      "-69,-23,-57,-9",
      "8",
      `${firstApp},${secondApp}`,
      projectId,
    );

    expect(listMapFeatures).toHaveBeenCalledWith({
      appIds: [firstApp, secondApp],
      bounds: [-69, -23, -57, -9],
      projectId,
      zoom: 8,
    });
  });

  it("rejects an unbounded map request", async () => {
    const controller = new RecordsMapController({
      listMapFeatures: vi.fn(),
    } as never);

    await expect(
      controller.list(undefined, "8", undefined, undefined),
    ).rejects.toBeInstanceOf(UnprocessableEntityException);
  });
});
