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

  it("requires explicit table, georeference and field decisions before planning", async () => {
    const plan = vi.fn().mockResolvedValue({ total: 1, errors: [] });
    const controller = new ShapefileImportsController({ plan } as never);
    const jobId = "9c18b925-718f-4182-9ea4-fe0039c33a46";
    const selection = {
      georeferenceConfirmed: true,
      tableMappings: [
        {
          sourceStatus: "POSTES",
          targetAppId: "eb0faee2-4252-4dd3-b7b7-8a40d97129c1",
        },
      ],
      fieldMappings: [
        {
          targetAppId: "eb0faee2-4252-4dd3-b7b7-8a40d97129c1",
          sourceField: "hps",
          targetFieldKey: "hps",
        },
      ],
    } as const;

    await expect(controller.plan(jobId, selection)).resolves.toEqual({
      total: 1,
      errors: [],
    });
    expect(plan).toHaveBeenCalledWith(jobId, selection);
  });

  it("does not confirm when the final explicit confirmation is absent", async () => {
    const confirm = vi.fn();
    const controller = new ShapefileImportsController({ confirm } as never);

    await expect(
      controller.confirm("9c18b925-718f-4182-9ea4-fe0039c33a46", {}),
    ).rejects.toMatchObject({
      response: { code: "IMPORT_CONFIRMATION_REQUIRED" },
    });
    expect(confirm).not.toHaveBeenCalled();
  });
});
