import { describe, expect, it, vi } from "vitest";

import { ShapefileImportsController } from "./shapefile-imports.controller.js";

function requestWithFile(fileName: string, bytes: number[]) {
  return {
    file: vi.fn().mockResolvedValue({
      filename: fileName,
      toBuffer: vi.fn().mockResolvedValue(Buffer.from(bytes)),
    }),
  };
}

describe("ShapefileImportsController", () => {
  it("accepts a ZIP upload and delegates inspection with its original name", async () => {
    const inspect = vi.fn().mockResolvedValue({ featureCount: 6265 });
    const controller = new ShapefileImportsController({ inspect } as never);

    await expect(
      controller.inspect(
        requestWithFile("tigo.zip", [0x50, 0x4b, 0x03, 0x04]) as never,
        "standalone",
      ),
    ).resolves.toEqual({ featureCount: 6265 });
    expect(inspect).toHaveBeenCalledWith(
      "tigo.zip",
      Buffer.from([0x50, 0x4b, 0x03, 0x04]),
      { type: "standalone" },
    );
  });

  it("rejects a renamed non-ZIP payload before parsing it", async () => {
    const inspect = vi.fn();
    const controller = new ShapefileImportsController({ inspect } as never);

    await expect(
      controller.inspect(
        requestWithFile("tigo.zip", [0x7b, 0x22, 0x61, 0x22]) as never,
        "standalone",
      ),
    ).rejects.toMatchObject({
      response: { code: "INVALID_SHAPEFILE_ARCHIVE" },
    });
    expect(inspect).not.toHaveBeenCalled();
  });
});
