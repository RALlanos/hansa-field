import { Test } from "@nestjs/testing";
import { describe, expect, it } from "vitest";

import { HealthController } from "./health.controller.js";
import { HealthModule } from "./health.module.js";

describe("HealthModule", () => {
  it("injects the health service into its controller", async () => {
    const module = await Test.createTestingModule({
      imports: [HealthModule],
    }).compile();
    const controller = module.get(HealthController);

    expect(controller.getLiveStatus()).toEqual({
      service: "hansa-field-api",
      status: "ok",
    });
  });
});
