import { describe, expect, it, vi } from "vitest";

import { BlocksController } from "./blocks.controller.js";

describe("BlocksController", () => {
  it("updates block composition through the public contract", async () => {
    const update = vi.fn().mockResolvedValue({ id: "block-id" });
    const controller = new BlocksController({ update } as never);

    await controller.update("block-id", {
      code: "RED_HFC",
      name: "Red HFC",
      description: "Composición operativa",
      members: [
        {
          appId: "11111111-1111-4111-8111-111111111111",
          appVersionId: "22222222-2222-4222-8222-222222222222",
        },
      ],
    });

    expect(update).toHaveBeenCalledWith(
      "block-id",
      expect.objectContaining({ code: "RED_HFC" }),
    );
  });
});
